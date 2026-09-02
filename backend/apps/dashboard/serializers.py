"""Serializers for the instructor (tutor) management dashboard."""
from rest_framework import serializers

from apps.enrollment.models import Enrollment


class InstructorStudentSerializer(serializers.ModelSerializer):
    """One enrolled student (flattened from an Enrollment row)."""

    student_id = serializers.IntegerField(source="student.id", read_only=True)
    student_name = serializers.CharField(
        source="student.full_name", read_only=True
    )
    email = serializers.EmailField(source="student.email", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = Enrollment
        fields = (
            "student_id", "student_name", "email", "course", "course_title",
            "status", "progress_percent", "enrolled_at",
        )
        read_only_fields = fields
