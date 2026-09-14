"""ViewSets for the course catalog with action-scoped permissions."""
import uuid
from io import StringIO
from django.core.management import call_command
from django.contrib.auth import get_user_model

from django.db import transaction
from django.db.models import Q, Max
from django.db.models.deletion import ProtectedError
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.core.permissions import (
    IsAdminOrReadOnly,
    IsAdmin,
    IsEnrolledStudent,
    IsInstructorOrAdmin,
)
from apps.core.storage import presigned_download_url, presigned_upload_url
from apps.core.exceptions import IllegalStateTransition
from apps.courses.models import Category, Course, Lesson, Module
from apps.courses.serializers import (
    CategorySerializer,
    CourseDetailSerializer,
    CourseListSerializer,
    LessonSerializer,
    ModuleSerializer,
)
from apps.enrollment.models import Enrollment


class CategoryViewSet(viewsets.ModelViewSet):
    """Catalog categories. Public reads; admin-only writes."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise IllegalStateTransition(
                "This category still has courses. Reassign those courses before deleting it."
            )


class CourseViewSet(viewsets.ModelViewSet):
    """CRUD for courses.

    Reads are public (anonymous users and students see published courses
    only); writes are restricted to the owning instructor or an admin.
    """

    lookup_field = "slug"
    # Catalog filtering for the frontend: ?category=<id>&level=beginner
    # &is_published=true&search=python&ordering=price (or -price, created_at…)
    filterset_fields = ["id", "category", "level", "is_published"]
    search_fields = ["title", "description"]
    ordering_fields = ["price", "created_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Eager-load the tree to avoid N+1 queries on detail reads.
        qs = Course.objects.select_related(
            "category", "instructor"
        ).prefetch_related("modules__lessons")

        user = self.request.user
        if user.is_authenticated and user.is_admin:
            return qs
        if user.is_authenticated and user.is_instructor:
            return qs.filter(Q(is_published=True) | Q(instructor=user))
        return qs.filter(is_published=True)

    def get_serializer_class(self):
        if self.action == "list":
            return CourseListSerializer
        return CourseDetailSerializer

    def get_permissions(self):
        if self.action == "import_homepage":
            return [IsAdmin()]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsInstructorOrAdmin()]
        return [IsAuthenticatedOrReadOnly()]

    @action(detail=False, methods=["post"], url_path="import-homepage")
    def import_homepage(self, request):
        try:
            tutor = get_user_model().objects.get(
                pk=request.data.get("instructor"), role="instructor", is_active=True
            )
        except (get_user_model().DoesNotExist, ValueError, TypeError):
            raise ValidationError({"instructor": "Select an existing active tutor."})
        output = StringIO()
        call_command("import_homepage_catalog", apply=True, instructor_email=tutor.email, stdout=output)
        return Response({"detail": output.getvalue()})

    def perform_create(self, serializer):
        if self.request.user.is_admin:
            serializer.save()
        else:
            serializer.save(instructor=self.request.user)

    @transaction.atomic
    def perform_destroy(self, instance):
        instance = Course.objects.select_for_update().get(pk=instance.pk)
        if instance.is_published:
            raise IllegalStateTransition("Unpublish the course before deleting it.")
        # Preserve learning and financial history. Unpublishing is the safe
        # option for courses that already have content or other linked records.
        for relation in instance._meta.related_objects:
            accessor = relation.get_accessor_name()
            if accessor and getattr(instance, accessor).exists():
                raise IllegalStateTransition(
                    "This course has content or linked records. Keep it unpublished instead of deleting it."
                )
        instance.delete()


class ModuleViewSet(viewsets.ModelViewSet):
    """CRUD for modules; ownership enforced by the serializer + permissions."""

    serializer_class = ModuleSerializer
    filterset_fields = ["course"]

    @transaction.atomic
    def perform_create(self, serializer):
        course = Course.objects.select_for_update().get(pk=serializer.validated_data["course"].pk)
        if "order" not in self.request.data:
            last = course.modules.aggregate(value=Max("order"))["value"]
            serializer.save(order=0 if last is None else last + 1)
        else:
            serializer.save()

    def get_queryset(self):
        qs = Module.objects.select_related("course").prefetch_related("lessons")
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if user.is_admin:
            return qs
        if user.is_instructor:
            return qs.filter(course__instructor=user)
        # Students: modules of courses they can access.
        return qs.filter(
            course__enrollments__student=user,
            course__enrollments__status__in=(
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
            ),
        ).distinct()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsInstructorOrAdmin()]
        return [IsAuthenticatedOrReadOnly()]


class LessonViewSet(viewsets.ModelViewSet):
    """CRUD for lessons; content reads are gated by active enrollment."""

    serializer_class = LessonSerializer
    filterset_fields = ["module"]

    @transaction.atomic
    def perform_create(self, serializer):
        module = Module.objects.select_for_update().get(pk=serializer.validated_data["module"].pk)
        if "order" not in self.request.data:
            last = module.lessons.aggregate(value=Max("order"))["value"]
            serializer.save(order=0 if last is None else last + 1)
        else:
            serializer.save()

    def get_queryset(self):
        qs = Lesson.objects.select_related("module__course")
        user = self.request.user

        if not user.is_authenticated:
            # Anonymous: only preview lessons of published courses.
            return qs.filter(
                is_preview=True, module__course__is_published=True
            )
        if user.is_admin:
            return qs
        if user.is_instructor:
            # Own courses' lessons, plus any published preview (to preview
            # peers' marketing lessons like a student would).
            return qs.filter(
                Q(module__course__instructor=user)
                | Q(is_preview=True, module__course__is_published=True)
            ).distinct()

        # Students: lessons from courses they're enrolled in (active or
        # completed), PLUS published preview lessons (the marketing hook).
        return qs.filter(
            Q(
                module__course__enrollments__student=user,
                module__course__enrollments__status__in=(
                    Enrollment.Status.ACTIVE,
                    Enrollment.Status.COMPLETED,
                ),
            )
            | Q(is_preview=True, module__course__is_published=True)
        ).distinct()

    def get_permissions(self):
        if self.action in (
            "create", "update", "partial_update", "destroy",
            "video_upload_url", "attach_video",
        ):
            return [IsInstructorOrAdmin()]
        return [IsEnrolledStudent()]

    # --- Video: direct-to-R2 upload + signed playback -----------------------
    _VIDEO_EXT = {"video/mp4": ".mp4", "video/webm": ".webm",
                  "video/quicktime": ".mov", "video/x-matroska": ".mkv"}

    @action(detail=True, methods=["post"], url_path="video-upload-url")
    def video_upload_url(self, request, pk=None):
        """POST /lessons/{id}/video-upload-url/ {content_type} → signed PUT URL.

        The client then PUTs the file straight to R2 with that URL and the same
        Content-Type header, and finally calls ``attach-video`` with the key.
        """
        lesson = self.get_object()  # enforces instructor ownership
        content_type = (request.data.get("content_type") or "").lower()
        if not content_type.startswith("video/"):
            raise ValidationError({"content_type": "Must be a video/* MIME type."})
        ext = self._VIDEO_EXT.get(content_type, "")
        key = f"lessons/{lesson.id}/{uuid.uuid4().hex}{ext}"
        url = presigned_upload_url(key, content_type)
        return Response({
            "key": key,
            "upload_url": url,
            "method": "PUT",
            "headers": {"Content-Type": content_type},
            "expires_in": 3600,
        })

    @action(detail=True, methods=["post"], url_path="attach-video")
    def attach_video(self, request, pk=None):
        """POST /lessons/{id}/attach-video/ {key} → bind the uploaded object."""
        lesson = self.get_object()
        key = request.data.get("key") or ""
        # Only accept a key under this lesson's own prefix (no arbitrary keys).
        if not key.startswith(f"lessons/{lesson.id}/"):
            raise ValidationError({"key": "Key does not belong to this lesson."})
        lesson.video_key = key
        lesson.save(update_fields=["video_key", "updated_at"])
        return Response(LessonSerializer(lesson).data)

    @action(detail=True, methods=["get"])
    def play(self, request, pk=None):
        """GET /lessons/{id}/play/ → short-lived playback URL (gated).

        Reachable only for lessons the caller may see (queryset-gated: preview,
        enrolled, own, or admin). Prefers an uploaded video; falls back to an
        external ``video_url``.
        """
        lesson = self.get_object()
        if lesson.video_key:
            return Response({
                "playback_url": presigned_download_url(lesson.video_key),
                "expires_in": 3600,
                "source": "upload",
            })
        if lesson.video_url:
            return Response({"playback_url": lesson.video_url,
                             "expires_in": None, "source": "external"})
        raise NotFound("This lesson has no video.")
