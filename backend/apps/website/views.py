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
from apps.website.emails import send_rsvp_confirmation
from apps.website.models import (
    AcademyProfile,
    BlogPost,
    BloggerSource,
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
        profile = AcademyProfile.load()
        serializer = AcademyProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TeamMemberViewSet(viewsets.ModelViewSet):
    """Published team profiles; admins see and manage every profile."""

    permission_classes = [IsAdminOrReadOnly]
    serializer_class = TeamMemberSerializer

    def get_queryset(self):
        queryset = TeamMember.objects.all()
        if _is_admin(self.request):
            return queryset
        return queryset.filter(is_published=True)


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
        transaction.on_commit(
            lambda: send_rsvp_confirmation(registration=registration)
        )
        return Response(
            {
                "detail": "You are registered. A confirmation email is on its way.",
                "seats_taken": event.seats_taken,
                "is_full": event.is_full,
            },
            status=status.HTTP_201_CREATED,
        )

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
