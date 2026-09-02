"""Serializers for enrollments and lesson progress."""
from rest_framework import serializers

from apps.courses.models import Course, Lesson
from apps.enrollment.models import Enrollment, LessonProgress


class EnrolledCourseSerializer(serializers.ModelSerializer):
    """Lightweight course shape embedded in an enrollment."""

    class Meta:
        model = Course
        fields = ("id", "title", "slug", "thumbnail")


class EnrollmentSerializer(serializers.ModelSerializer):
    """Read shape for a student's enrollment."""

    course = EnrolledCourseSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = (
            "id",
            "course",
            "status",
            "progress_percent",
            "enrolled_at",
            "completed_at",
        )
        read_only_fields = fields


class EnrollCreateSerializer(serializers.Serializer):
    """Write shape for enrolling: accepts a course id."""

    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.filter(is_published=True)
    )


class CompleteLessonSerializer(serializers.Serializer):
    """Write shape for marking a lesson complete."""

    lesson = serializers.PrimaryKeyRelatedField(queryset=Lesson.objects.all())


class LessonProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonProgress
        fields = ("id", "lesson", "completed", "completed_at")
        read_only_fields = fields
