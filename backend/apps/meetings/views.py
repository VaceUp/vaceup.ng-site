"""Staff meeting API: book a call, open the room, end it.

Every query here is scoped to the meetings the requester hosts or was invited to,
so a meeting the academy booked never appears in someone else's dashboard.
"""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsInstructorOrAdmin
from apps.meetings import emails, services
from apps.meetings.models import Meeting, MeetingParticipant
from apps.meetings.serializers import MeetingSerializer, PersonSerializer
from apps.website.join import JoinDenied

User = get_user_model()

STAFF_ROLES = (User.Role.ADMIN, User.Role.INSTRUCTOR)


class MeetingViewSet(viewsets.ModelViewSet):
    """The meetings a person belongs to, and the room behind each one."""

    serializer_class = MeetingSerializer
    permission_classes = [IsAuthenticated]
    # Cancelling is the honest end for a meeting; deleting would erase the record
    # that the call ever happened.
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return (
            Meeting.objects.visible_to(self.request.user)
            .select_related("host")
            .prefetch_related("participants__user")
        )

    @action(detail=False, methods=["get"])
    def readiness(self, request):
        """Say up front whether this server can open a room at all.

        Without this the dashboard would offer a button that only fails, which
        reads as a broken meeting rather than an unset-up server.
        """
        return Response({
            "ready": services.room_is_ready(),
            "detail": "" if services.room_is_ready() else services.room_off_notice(),
        })

    @action(detail=False, methods=["get"], permission_classes=[IsInstructorOrAdmin])
    def colleagues(self, request):
        """Who may be invited, for the picker on the booking form."""
        people = (
            User.objects.filter(role__in=STAFF_ROLES, is_active=True)
            .exclude(pk=request.user.pk)
            .order_by("full_name", "email")
        )
        return Response(PersonSerializer(people, many=True).data)

    def create(self, request, *args, **kwargs):
        if not (request.user.is_admin or request.user.is_instructor):
            raise PermissionDenied("Only the academy's own people can book a meeting.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        meeting = Meeting.objects.create(
            host=request.user,
            title=data["title"],
            agenda=data.get("agenda", ""),
            starts_at=data.get("starts_at") or timezone.now(),
            duration_minutes=data.get("duration_minutes", 45),
        )
        invited, failed = sync_invitees(meeting, data.get("invitees"))
        return Response(
            {**self.get_serializer(meeting).data,
             "invited": invited, "invitation_email_failed": failed},
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        meeting = self.get_object()
        if meeting.host_id != request.user.pk:
            raise PermissionDenied("Only the person who booked this meeting can change it.")
        if meeting.status != Meeting.Status.SCHEDULED:
            raise PermissionDenied("A meeting that has ended or was called off stays as it is.")
        self.synced = None
        response = super().partial_update(request, *args, **kwargs)
        # Saving a longer list must say whether the new people were actually
        # mailed, the same way a new booking does.
        if self.synced is not None:
            invited, failed = self.synced
            response.data = {
                **response.data,
                "invited": invited,
                "invitation_email_failed": failed,
            }
        return response

    def perform_update(self, serializer):
        invitees = serializer.validated_data.pop("invitees", None)
        with transaction.atomic():
            meeting = serializer.save()
            if invitees is not None:
                self.synced = sync_invitees(meeting, invitees)

    @action(detail=True, methods=["post"])
    def token(self, request, pk=None):
        """The room credentials for this person, and the fact they walked in."""
        meeting = self.get_object()
        try:
            access = services.meeting_access(meeting=meeting, user=request.user)
        except JoinDenied as error:
            return Response({"detail": error.detail}, status=error.status_code)
        MeetingParticipant.objects.filter(
            meeting=meeting, user=request.user, joined_at__isnull=True
        ).update(joined_at=timezone.now())
        return Response(access)

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        """Close the room so nobody can walk back into a finished call."""
        return self._close(request, Meeting.Status.ENDED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Call the meeting off and tell everyone who was invited."""
        return self._close(request, Meeting.Status.CANCELLED, notify=True)

    def _close(self, request, new_status, notify=False):
        meeting = self.get_object()
        if meeting.host_id != request.user.pk and not request.user.is_admin:
            raise PermissionDenied("Only the person who booked this meeting can close it.")
        if meeting.status != Meeting.Status.SCHEDULED:
            raise PermissionDenied("This meeting is already closed.")
        meeting.status = new_status
        if new_status == Meeting.Status.ENDED:
            meeting.ended_at = timezone.now()
        meeting.save(update_fields=["status", "ended_at", "updated_at"])
        failed = []
        if notify:
            for person in meeting.invited_users():
                try:
                    emails.send_meeting_cancelled(meeting=meeting, user=person)
                except Exception:  # noqa: BLE001 - a refused address cannot reopen a cancellation
                    failed.append(person.full_name or person.email)
        return Response({**self.get_serializer(meeting).data,
                         "cancellation_email_failed": failed})


def sync_invitees(meeting, people):
    """Make the invitation list exactly ``people``, and post what is new.

    A refusal from the mail relay is reported rather than retried: the meeting is
    already visible in the invitee's dashboard, so the call is not broken by a
    bounced note — but the screen must not claim it was emailed. The names come
    back as the people this call actually mailed, so "Mailed: ..." on screen is
    never a claim about somebody who was mailed weeks ago.
    """
    wanted = list(people or [])
    existing = {row.user_id: row for row in meeting.participants.all()}
    for user_id, row in existing.items():
        if user_id not in {person.pk for person in wanted}:
            # Being on the list is the access, so removing someone revokes it.
            row.delete()
    invited, failed = [], []
    for person in wanted:
        row = existing.get(person.pk)
        if row is None:
            row = MeetingParticipant.objects.create(meeting=meeting, user=person)
        if row.invited_at:
            continue
        try:
            emails.send_meeting_invite(meeting=meeting, user=person)
        except Exception:  # noqa: BLE001 - the invitation stands in the dashboard
            failed.append(person.full_name or person.email)
            continue
        row.invited_at = timezone.now()
        row.save(update_fields=["invited_at", "updated_at"])
        invited.append(person.full_name)
    return invited, failed
