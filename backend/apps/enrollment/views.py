"""Enrollment endpoints: enroll, list my enrollments, mark lessons complete."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.enrollment import services
from apps.enrollment.models import Enrollment, LessonProgress
from apps.enrollment.serializers import (
    CompleteLessonSerializer,
    EnrollCreateSerializer,
    EnrollmentSerializer,
    LessonProgressSerializer,
)


class IsStudent(IsAuthenticated):
    """Authenticated users acting in the student role."""

    def has_permission(self, request, view):
        return bool(
            super().has_permission(request, view) and request.user.is_student
        )


class EnrollmentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """A student's own enrollments, plus enroll and progress actions."""

    permission_classes = [IsStudent]
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        return (
            Enrollment.objects.filter(student=self.request.user)
            .select_related("course")
            .order_by("-enrolled_at")
        )

    def create(self, request, *args, **kwargs):
        """POST /enrollments/ {course} — enrol in a (free, published) course."""
        serializer = EnrollCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enrollment = services.enroll(
            student=request.user, course=serializer.validated_data["course"]
        )
        return Response(
            EnrollmentSerializer(enrollment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="complete-lesson")
    def complete_lesson(self, request):
        """POST /enrollments/complete-lesson/ {lesson} — mark complete."""
        serializer = CompleteLessonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enrollment = services.mark_lesson_complete(
            student=request.user, lesson=serializer.validated_data["lesson"]
        )
        return Response(EnrollmentSerializer(enrollment).data)

    @action(detail=True, methods=["get"], url_path="progress")
    def progress(self, request, pk=None):
        """GET /enrollments/{id}/progress/ — per-lesson completion rows."""
        enrollment = self.get_object()
        rows = LessonProgress.objects.filter(enrollment=enrollment)
        return Response(LessonProgressSerializer(rows, many=True).data)
