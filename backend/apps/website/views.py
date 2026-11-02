"""Public website API: profile, team, events, registrations and blog."""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin, IsAdminOrReadOnly
from apps.core.throttling import DatabaseAnonRateThrottle
from apps.website import revisions
from apps.website.emails import (
    send_event_broadcast,
    send_join_link_email,
    send_rsvp_confirmation,
)
from apps.website.join import JoinDenied, join_access, room_is_ready
from apps.website.models import (
    AcademyProfile,
    BlogPost,
    BloggerSource,
    ContentRevision,
    Event,
    EventRegistration,
    TeamMember,
)
from apps.website.roster import roster_csv
from apps.website.serializers import (
    AcademyProfileSerializer,
    BloggerSourceSerializer,
    BlogPostDetailSerializer,
    BlogPostListSerializer,
    ContentRevisionSerializer,
    EventAdminSerializer,
    EventPublicSerializer,
    EventRegistrationAdminSerializer,
    EventRegistrationCreateSerializer,
    TeamMemberSerializer,
)
from apps.website.services import BloggerSyncError, sync_blogger


def _is_admin(request):
    user = request.user
    return bool(user and user.is_authenticated and user.is_admin)


# Registrant notes go out in batches: the relay takes a fresh session per
# message, and a roster the size of a workshop must not outlast the request.
BROADCAST_BATCH = 25
BROADCAST_MAX_BATCH = 50


def _clean_header(value):
    """A subject becomes a mail header, so a newline there is a second header."""
    return " ".join(str(value or "").split())


class AcademyProfileView(APIView):
    """GET the public About profile; admins may update it."""

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT"):
            return [IsAdmin()]
        return [AllowAny()]

    def get(self, request):
        profile = AcademyProfile.load() or AcademyProfile()
        return Response(AcademyProfileSerializer(profile).data)

    def patch(self, request):
        serializer = revisions.save_and_record(
            ContentRevision.Target.PROFILE,
            instance=AcademyProfile.load(),
            data=request.data,
            changed_by=request.user,
        )
        return Response(serializer.data)


class ContentRevisionListView(APIView):
    """GET the About-page edit history (admins only)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = ContentRevision.objects.select_related("changed_by")
        target = request.query_params.get("target")
        if target in ContentRevision.Target.values:
            queryset = queryset.filter(target=target)
        return Response(ContentRevisionSerializer(queryset[:200], many=True).data)


class ContentRevisionRestoreView(APIView):
    """POST: put one stored revision back on the About page."""

    permission_classes = [IsAdmin]

    def post(self, request, pk):
        revision = get_object_or_404(ContentRevision, pk=pk)
        try:
            serializer = revisions.restore(revision, changed_by=request.user)
        except revisions.RevisionError as error:
            return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
        return Response({
            "detail": f"{revision.label} was restored to the wording before "
                      f"{revision.created_at:%d %B %Y} at {revision.created_at:%H:%M}.",
            "restored": ContentRevisionSerializer(revision).data,
            "profile": serializer.data if revision.target == ContentRevision.Target.PROFILE else None,
            "member": serializer.data if revision.target == ContentRevision.Target.TEAM else None,
        })


class ContentRevisionUndoView(APIView):
    """POST: undo the most recent About-page edit.

    Body is optional; {"target": "team", "object_id": 7} undoes the last edit
    to that profile, and an empty body undoes the academy profile.
    """

    permission_classes = [IsAdmin]

    def post(self, request):
        target = request.data.get("target") or ContentRevision.Target.PROFILE
        if target not in ContentRevision.Target.values:
            return Response({"detail": "Unknown content area."}, status=status.HTTP_400_BAD_REQUEST)
        object_id = request.data.get("object_id") if target == ContentRevision.Target.TEAM else None
        if target == ContentRevision.Target.TEAM and not str(object_id or "").isdigit():
            return Response({"detail": "A team profile id is required."}, status=status.HTTP_400_BAD_REQUEST)
        revision = revisions.latest(target, int(object_id) if object_id else None)
        if revision is None:
            return Response(
                {"detail": "There is no earlier version of this text to go back to."},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            serializer = revisions.restore(revision, changed_by=request.user)
        except revisions.RevisionError as error:
            return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
        return Response({
            "detail": f"Undid the last change to {revision.label}.",
            "restored": ContentRevisionSerializer(revision).data,
            "profile": serializer.data if revision.target == ContentRevision.Target.PROFILE else None,
            "member": serializer.data if revision.target == ContentRevision.Target.TEAM else None,
        })


class TeamMemberViewSet(viewsets.ModelViewSet):
    """Published team profiles; admins see and manage every profile."""

    permission_classes = [IsAdminOrReadOnly]
    serializer_class = TeamMemberSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = revisions.save_and_record(
            ContentRevision.Target.TEAM,
            instance=instance,
            data=request.data,
            changed_by=request.user,
        )
        return Response(serializer.data)

    def get_queryset(self):
        queryset = TeamMember.objects.all()
        if _is_admin(self.request):
            return queryset
        return queryset.filter(is_published=True)


class ResendSeatThrottle(DatabaseAnonRateThrottle):
    """Re-issuing a seat is unauthenticated, so it runs slower than a page view.

    A scoped throttle would need ``throttle_scope`` on the whole viewset, which
    would then apply to every event route; its own scope keeps the limit on the
    one action that can send mail.
    """

    scope = "event_resend"


class EventViewSet(viewsets.ModelViewSet):
    """Published events for the website; admins manage drafts."""

    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"

    def get_serializer_class(self):
        # Admins need is_published and meeting_url in the list, not only on
        # retrieve, otherwise the manager cannot see which events are drafts.
        if _is_admin(self.request):
            return EventAdminSerializer
        return EventPublicSerializer

    def get_queryset(self):
        queryset = Event.objects.all()
        if not _is_admin(self.request):
            queryset = queryset.filter(is_published=True)

        scope = self.request.query_params.get("scope")
        now = timezone.now()
        if scope == "upcoming":
            queryset = queryset.filter(Q(starts_at__gte=now) | Q(ends_at__gte=now))
        elif scope == "past":
            queryset = queryset.filter(starts_at__lt=now).filter(
                Q(ends_at__isnull=True) | Q(ends_at__lt=now)
            )
        return queryset

    @action(detail=True, methods=["post"], permission_classes=[AllowAny], url_path="register")
    def register(self, request, slug=None):
        event = self.get_object()
        if event.registration_url:
            return Response(
                {"detail": "This event uses an external registration page."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if event.is_past:
            return Response(
                {"detail": "This event has already taken place."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if event.is_full:
            return Response(
                {"detail": "This event is fully booked."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EventRegistrationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                # Lock the event while the seats are counted, otherwise two
                # sign-ups in the same instant can both take the last seat.
                locked = Event.objects.select_for_update().get(pk=event.pk)
                if locked.is_full:
                    return Response(
                        {"detail": "This event is fully booked."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                registration = EventRegistration.objects.create(
                    event=event,
                    user=request.user if request.user.is_authenticated else None,
                    **serializer.validated_data,
                )
        except IntegrityError:
            return Response(
                {"detail": "This email is already registered for the event."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        def confirm():
            # The confirmation already carries the personal joining link, so a
            # delivered one counts as a sent link.
            if send_rsvp_confirmation(registration=registration):
                EventRegistration.objects.filter(pk=registration.pk).update(
                    join_link_sent_at=timezone.now()
                )

        transaction.on_commit(confirm)
        payload = {
            "detail": "You are registered. A confirmation email is on its way.",
            "seats_taken": event.seats_taken,
            "is_full": event.is_full,
        }
        if event.is_online:
            # The success screen can hand over the seat immediately instead of
            # telling people to wait for an email that may take a moment.
            payload["join_link"] = registration.join_link()
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[AllowAny], url_path="join")
    def join(self, request, slug=None):
        """Open the room for whoever holds this event's personal join link."""
        event = self.get_object()
        token = str(request.data.get("token") or "").strip()
        registration = (
            event.registrations.filter(join_token=token).first() if token else None
        )
        try:
            access = join_access(event=event, registration=registration, user=request.user)
        except JoinDenied as denied:
            return Response({"detail": denied.detail}, status=denied.status_code)
        return Response(access)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[AllowAny],
        throttle_classes=[ResendSeatThrottle],
        url_path="resend-link",
    )
    def resend_link(self, request, slug=None):
        """Re-send a seat's joining link to the email that booked it.

        The confirmation can sit in spam or be deleted while the attendee
        hunts for it, and an event ticket should not require an account to
        recover. The answer is the same whether or not the email is on the
        list, so this is not a way to test who registered.
        """
        event = self.get_object()
        email = str(request.data.get("email") or "").strip().lower()
        if not event.is_online:
            return Response(
                {"detail": "This event is not online, so there is no link to send."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sent = 0
        if email:
            registration = event.registrations.filter(email__iexact=email).first()
            if registration and send_join_link_email(registration=registration):
                EventRegistration.objects.filter(pk=registration.pk).update(
                    join_link_sent_at=timezone.now()
                )
                sent = 1
        return Response({
            "detail": (
                "Your joining link is on its way. Check the inbox for that address."
                if sent else
                "If that email registered for this event, the joining link is on its way."
            ),
        })

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdmin],
        url_path="send-link",
    )
    def send_join_link(self, request, slug=None):
        """Email every registrant the link that opens the room.

        Confirmations go out before the academy has set the meeting details,
        which is usually days later, so this is how that promise gets kept.
        """
        event = self.get_object()
        if not event.is_online:
            return Response(
                {"detail": "This event is not online, so there is no link to send."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not room_is_ready(event):
            return Response(
                {
                    "detail": "Set the joining link, or choose the VaceUp Live Room, "
                              "before sending it."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        registrations = list(event.registrations.order_by("pk"))
        if not registrations:
            return Response(
                {"detail": "Nobody has registered for this event yet.",
                 "sent": 0, "failed": 0, "total": 0},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sent = 0
        now = timezone.now()
        for registration in registrations:
            if send_join_link_email(registration=registration):
                EventRegistration.objects.filter(pk=registration.pk).update(
                    join_link_sent_at=now
                )
                sent += 1
        failed = len(registrations) - sent
        detail = f"{sent} of {len(registrations)} registrants were emailed their joining link."
        if failed:
            detail += f" {failed} could not be sent, so the mail setup needs a look."
        return Response({"detail": detail, "sent": sent, "failed": failed,
                         "total": len(registrations)})

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdmin],
        url_path="broadcast",
    )
    def broadcast(self, request, slug=None):
        """Mail the academy's own note to this event's registrants.

        The relay starts a fresh session per message, so the roster is walked in
        bounded batches and the panel asks for the next batch until none is
        left. One request per roster would outlive the server's timeout and
        leave the admin guessing whether it went out at all.
        """
        event = self.get_object()
        subject = _clean_header(request.data.get("subject"))
        note = str(request.data.get("message") or "").strip()
        errors = {}
        if not subject:
            errors["subject"] = "Write a subject line."
        elif len(subject) > 150:
            errors["subject"] = "Keep the subject under 150 characters."
        if not note:
            errors["message"] = "Write the message your registrants will read."
        elif len(note) > 4000:
            errors["message"] = "Keep the message under 4,000 characters."
        try:
            batch = int(request.data.get("batch") or BROADCAST_BATCH)
        except (TypeError, ValueError):
            errors["batch"] = "Choose a batch size between 1 and 50."
        else:
            batch = min(max(batch, 1), BROADCAST_MAX_BATCH)
        only_unmailed = str(request.data.get("only_unmailed", "true")).lower() not in {
            "false", "0", "no",
        }
        include_link = str(request.data.get("include_link", "true")).lower() not in {
            "false", "0", "no",
        }
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        pending = event.registrations.order_by("pk")
        if only_unmailed:
            pending = pending.filter(broadcast_sent_at__isnull=True)
        total = event.registrations.count()
        if not total:
            return Response(
                {"detail": "Nobody has registered for this event yet.",
                 "sent": 0, "failed": 0, "remaining": 0, "total": 0},
                status=status.HTTP_400_BAD_REQUEST,
            )
        rows = list(pending[:batch])
        if not rows:
            return Response({
                "detail": "Everyone in this group has already been mailed from here.",
                "sent": 0, "failed": 0, "remaining": 0, "total": total, "done": True,
            })
        sent = 0
        now = timezone.now()
        for registration in rows:
            if send_event_broadcast(
                registration=registration, subject=subject, note=note,
                include_link=include_link,
            ):
                # The marker moves even on a refused address: it records that the
                # note was handed to the relay, which is all this screen can know.
                EventRegistration.objects.filter(pk=registration.pk).update(
                    broadcast_sent_at=now
                )
                sent += 1
        failed = len(rows) - sent
        if only_unmailed:
            # A refused address keeps its empty marker, so it is reached again on
            # the next batch instead of silently dropping out of the roster.
            remaining = event.registrations.filter(broadcast_sent_at__isnull=True).count()
        else:
            remaining = event.registrations.filter(pk__gt=rows[-1].pk).count()
        detail = (
            f"{sent} of {len(rows)} in this batch were emailed"
            + (f", {failed} were not." if failed else ".")
        )
        if remaining:
            detail += f" {remaining} still to send."
        return Response({
            "detail": detail, "sent": sent, "failed": failed,
            "remaining": remaining, "total": total, "done": not remaining,
        })

    @action(detail=True, methods=["get"], permission_classes=[IsAdmin], url_path="registrations")
    def registrations(self, request, slug=None):
        event = self.get_object()
        return Response(
            {
                "event": event.title,
                "count": event.seats_taken,
                "capacity": event.capacity,
                "results": EventRegistrationAdminSerializer(
                    event.registrations.all(), many=True
                ).data,
            }
        )

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[IsAdmin],
        url_path="registrations/export",
    )
    def export_registrations(self, request, slug=None):
        event = self.get_object()
        response = HttpResponse(
            roster_csv(event), content_type="text/csv; charset=utf-8"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{event.slug}-registrations.csv"'
        )
        return response

    @action(
        detail=True,
        methods=["delete"],
        permission_classes=[IsAdmin],
        url_path="registrations/(?P<registration_id>[0-9]+)",
    )
    def delete_registration(self, request, slug=None, registration_id=None):
        event = self.get_object()
        registration = get_object_or_404(event.registrations, pk=registration_id)
        registration.delete()
        return Response(
            {
                "detail": f"{registration.name} was removed from the list.",
                "seats_taken": event.seats_taken,
            }
        )


class BlogPostViewSet(viewsets.ModelViewSet):
    """Synced Blogger posts; public reads, admin visibility control and sync."""

    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["is_visible"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return BlogPostDetailSerializer
        return BlogPostListSerializer

    def get_queryset(self):
        queryset = BlogPost.objects.all()
        if not _is_admin(self.request):
            queryset = queryset.filter(is_visible=True)
        return queryset

    @action(detail=False, methods=["post"], permission_classes=[IsAdmin], url_path="sync")
    def sync(self, request):
        source = BloggerSource.load()
        try:
            result = sync_blogger(source)
        except BloggerSyncError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


class BloggerSourceView(APIView):
    """Read or update the Blogger connection settings (admins only)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        source = BloggerSource.load() or BloggerSource()
        return Response(BloggerSourceSerializer(source).data)

    def patch(self, request):
        source = BloggerSource.load()
        if source is None:
            source = BloggerSource()
        serializer = BloggerSourceSerializer(source, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(BloggerSourceSerializer(source).data)
