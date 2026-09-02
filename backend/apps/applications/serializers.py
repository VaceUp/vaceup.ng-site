"""Serializers for applications."""

from rest_framework import serializers

from apps.applications.models import Application
from apps.courses.models import Course


class CourseBasicSerializer(serializers.ModelSerializer):
    """Minimal course info for application lists."""

    instructor_name = serializers.CharField(source="instructor.full_name", read_only=True)

    class Meta:
        model = Course
        fields = ("id", "title", "instructor_name", "price")


class ApplicationSerializer(serializers.ModelSerializer):
    """Read shape for an application with related info."""

    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_email = serializers.CharField(source="student.email", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    reviewer_name = serializers.CharField(source="reviewed_by.full_name", read_only=True)

    class Meta:
        model = Application
        fields = (
            "id",
            "student",
            "student_name",
            "student_email",
            "course",
            "course_title",
            "status",
            "motivation",
            "reviewed_by",
            "reviewer_name",
            "reviewed_at",
            "rejection_reason",
            "created_at",
        )
        read_only_fields = ("student", "course", "reviewed_by", "reviewed_at")


class ApplicationCreateSerializer(serializers.ModelSerializer):
    """Write shape: student submits an application."""

    class Meta:
        model = Application
        fields = ("course", "motivation")

    def validate_course(self, course):
        user = self.context["request"].user
        # Check if student is already enrolled
        from apps.enrollment.models import Enrollment
        if Enrollment.objects.filter(student=user, course=course).exists():
            raise serializers.ValidationError("Already enrolled in this course.")
        return course

    def create(self, validated_data):
        validated_data["student"] = self.context["request"].user
        return super().create(validated_data)


class ApplicationReviewSerializer(serializers.Serializer):
    """Write shape: admin/instructor reviews an application."""

    action = serializers.ChoiceField(choices=["approve", "reject"])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["action"] == "reject" and not attrs.get("rejection_reason"):
            raise serializers.ValidationError({"rejection_reason": "Required when rejecting."})
        return attrs