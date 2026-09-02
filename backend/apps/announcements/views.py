"""Announcement endpoints: CRUD, publishing, comments, read tracking."""
from django.db import models
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.announcements import services
from apps.announcements.models import Announcement, AnnouncementComment, AnnouncementReadReceipt
from apps.announcements.serializers import (
    AnnouncementSerializer,
    AnnouncementCreateSerializer,
    AnnouncementCommentSerializer,
    AnnouncementCommentCreateSerializer,
    AnnouncementReadReceiptSerializer,
)
from apps.core.permissions import IsAdmin


class IsAuthorOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        return user.is_admin or obj.author_id == user.id


class AnnouncementViewSet(viewsets.ModelViewSet):
    """Announcement CRUD and publishing."""

    permission_classes = [IsAuthenticated]
    serializer_class = AnnouncementSerializer

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AnnouncementCreateSerializer
        return AnnouncementSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "publish", "unpublish", "send_email", "send_push"):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        now = timezone.now()

        if user.is_admin:
            return Announcement.objects.select_related("author").prefetch_related("target_courses").all()

        # Build queryset based on user role and announcement targeting
        qs = Announcement.objects.select_related("author").prefetch_related("target_courses")

        if user.is_instructor:
            # Instructors see: their own announcements + announcements targeting their courses + global announcements
            return qs.filter(
                models.Q(author=user) |
                models.Q(target__in=[Announcement.Target.ALL, Announcement.Target.INSTRUCTORS, Announcement.Target.ADMINS]) |
                models.Q(target_courses__instructor=user)
            ).distinct()
        else:
            # Students see: announcements targeting them + announcements targeting their enrolled courses
            from apps.enrollment.models import Enrollment
            enrolled_courses = Enrollment.objects.filter(
                student=self.request.user,
                status__in=(Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED)
            ).values_list("course_id", flat=True)

            return qs.filter(
                models.Q(target__in=[Announcement.Target.ALL, Announcement.Target.STUDENTS, Announcement.Target.ENROLLED_USERS]) |
                models.Q(target=Announcement.Target.COURSE_STUDENTS, target_courses__in=enrolled_courses) |
                models.Q(target=Announcement.Target.ENROLLED_USERS, target_courses__in=enrolled_courses)
            ).distinct()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "publish", "unpublish", "send_email", "send_push"):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def list(self, request, *args, **kwargs):
        """Override to add unread count and filter."""
        queryset = self.filter_queryset(self.get_queryset())

        # Filter by status
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        # Filter by target
        target = self.request.query_params.get("target")
        if target:
            queryset = queryset.filter(target=target)

        # Filter by course
        course_id = self.request.query_params.get("course")
        if course_id:
            queryset = queryset.filter(target_courses__id=course_id)

        # Filter published only
        show_published = self.request.query_params.get("published")
        if show_published == "true":
            queryset = queryset.filter(
                status=Announcement.Status.PUBLISHED,
                publish_at__lte=timezone.now(),
            ).filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=timezone.now())
            )

        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        response = self.get_paginated_response(serializer.data)

        # Add unread count
        if self.request.user.is_authenticated:
            unread_count = Announcement.objects.filter(
                models.Q(target__in=[Announcement.Target.ALL, Announcement.Target.STUDENTS, Announcement.Target.ENROLLED_USERS]) |
                models.Q(target=Announcement.Target.COURSE_STUDENTS, target_courses__enrollment__student=request.user)
            ).filter(
                status=Announcement.Status.PUBLISHED,
                publish_at__lte=timezone.now(),
            ).filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=timezone.now())
            ).exclude(
                id__in=AnnouncementReadReceipt.objects.filter(user=request.user).values_list("announcement_id", flat=True)
            ).count()

            response.data["unread_count"] = unread_count

        return response

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        """POST /announcements/{id}/publish/ - publish announcement."""
        announcement = self.get_object()
        if announcement.status == Announcement.Status.PUBLISHED:
            return Response({"detail": "Already published."}, status=400)

        announcement.status = Announcement.Status.PUBLISHED
        if not announcement.publish_at:
            announcement.publish_at = timezone.now()
        announcement.save(update_fields=["status", "publish_at", "updated_at"])

        # Trigger async email/push
        from apps.announcements.tasks import send_announcement_notifications
        send_announcement_notifications.delay(announcement.id)

        return Response({"detail": "Announcement published."})

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, pk=None):
        """POST /announcements/{id}/unpublish/ - unpublish announcement."""
        announcement = self.get_object()
        announcement.status = Announcement.Status.DRAFT
        announcement.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Announcement unpublished."})

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        """POST /announcements/{id}/send-email/ - send email notification."""
        announcement = self.get_object()
        if not announcement.send_email:
            return Response({"detail": "Email notifications disabled for this announcement."}, status=400)

        from apps.announcements.tasks import send_announcement_email
        send_announcement_email.delay(announcement.id)
        return Response({"detail": "Email notification queued."})

    @action(detail=True, methods=["post"], url_path="send-push")
    def send_push(self, request, pk=None):
        """POST /announcements/{id}/send-push/ - send push notification."""
        announcement = self.get_object()
        if not announcement.send_push:
            return Response({"detail": "Push notifications disabled for this announcement."}, status=400)

        from apps.announcements.tasks import send_announcement_push
        send_announcement_push.delay(announcement.id)
        return Response({"detail": "Push notification queued."})

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        """POST /announcements/{id}/read/ - mark as read."""
        announcement = self.get_object()
        receipt, created = AnnouncementReadReceipt.objects.get_or_create(
            announcement=announcement,
            user=request.user,
        )
        return Response({
            "read_at": receipt.read_at,
            "created": created,
        })

    @action(detail=True, methods=["get"], url_path="readers")
    def readers(self, request, pk=None):
        """GET /announcements/{id}/readers/ - list users who read this."""
        announcement = self.get_object()
        if not (request.user.is_admin or announcement.author == request.user):
            return Response({"detail": "Not authorized."}, status=403)

        receipts = AnnouncementReadReceipt.objects.filter(
            announcement=pk
        ).select_related("user").order_by("-read_at")
        page = self.paginate_queryset(receipts)
        serializer = AnnouncementReadReceiptSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["get"], url_path="comments")
    def comments(self, request, pk=None):
        """GET /announcements/{id}/comments/ - list comments."""
        announcement = self.get_object()
        comments = AnnouncementComment.objects.filter(
            announcement=pk, parent__isnull=True
        ).select_related("author").order_by("created_at")
        page = self.paginate_queryset(comments)
        serializer = AnnouncementCommentSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["post"], url_path="comments")
    def add_comment(self, request, pk=None):
        """POST /announcements/{id}/comments/ - add comment."""
        announcement = self.get_object()
        if not announcement.allow_comments:
            return Response({"detail": "Comments disabled for this announcement."}, status=400)

        serializer = AnnouncementCommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = AnnouncementComment.objects.create(
            announcement=announcement,
            author=request.user,
            body=serializer.validated_data["body"],
            parent_id=serializer.validated_data.get("parent_id"),
        )
        return Response(AnnouncementCommentSerializer(comment).data, status=201)

    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        """GET /announcements/{id}/stats/ - delivery/read stats."""
        announcement = self.get_object()
        if not (request.user.is_admin or announcement.author == request.user):
            return Response({"detail": "Not authorized."}, status=403)

        total_recipients = services.get_recipient_count(announcement)
        read_count = AnnouncementReadReceipt.objects.filter(announcement=pk).count()
        email_sent = announcement.email_sent
        push_sent = announcement.push_sent

        return Response({
            "total_recipients": total_recipients,
            "read_count": read_count,
            "read_rate": read_count / total_recipients if total_recipients else 0,
            "email_sent": email_sent,
            "push_sent": push_sent,
        })


class AnnouncementCommentViewSet(viewsets.ModelViewSet):
    """Manage comments on announcements."""

    serializer_class = AnnouncementCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        announcement_id = self.kwargs.get("announcement_pk") or self.request.query_params.get("announcement")
        return AnnouncementComment.objects.filter(
            announcement_id=announcement_id,
            parent__isnull=True,
        ).select_related("author").order_by("created_at")

    def perform_create(self, serializer):
        announcement_id = self.kwargs.get("announcement_pk")
        from apps.announcements.models import Announcement
        announcement = get_object_or_404(Announcement, pk=announcement_id)
        if not announcement.allow_comments:
            raise ValidationError("Comments disabled for this announcement.")
        serializer.save(author=self.request.user, announcement=announcement)


class AnnouncementReadReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    """Track who read which announcements."""

    serializer_class = AnnouncementReadReceiptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return AnnouncementReadReceipt.objects.select_related("announcement", "user").all()
        return AnnouncementReadReceipt.objects.filter(user=user).select_related("announcement")