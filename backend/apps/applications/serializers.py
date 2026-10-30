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
            "full_name",
            "phone",
            "country",
            "city",
            "education",
            "current_role",
            "experience",
            "linkedin_url",
            "github_url",
            "goals",
            "heard_from",
            "reviewed_by",
            "reviewer_name",
            "reviewed_at",
            "rejection_reason",
            "created_at",
        )
        read_only_fields = ("student", "course", "reviewed_by", "reviewed_at")


class ApplicationCreateSerializer(serializers.ModelSerializer):
    """Write shape: student submits an application.

    Accepts ``course`` or the legacy ``course_id`` alias so older clients keep
    working while the website uses the canonical field name.
    """

    def to_internal_value(self, data):
        if "course" not in data and "course_id" in data:
            data = data.copy()
            data["course"] = data["course_id"]
        return super().to_internal_value(data)

    class Meta:
        model = Application
        fields = (
            "course",
            "motivation",
            "full_name",
            "phone",
            "country",
            "city",
            "education",
            "current_role",
            "experience",
            "linkedin_url",
            "github_url",
            "goals",
            "heard_from",
        )
        extra_kwargs = {
            "motivation": {"required": False, "allow_blank": True},
            "full_name": {"required": False, "allow_blank": True},
            "phone": {"required": False, "allow_blank": True},
            "country": {"required": False, "allow_blank": True},
            "city": {"required": False, "allow_blank": True},
            "education": {"required": False, "allow_blank": True},
            "current_role": {"required": False, "allow_blank": True},
            "experience": {"required": False, "allow_blank": True},
            "linkedin_url": {"required": False, "allow_blank": True},
            "github_url": {"required": False, "allow_blank": True},
            "goals": {"required": False, "allow_blank": True},
            "heard_from": {"required": False, "allow_blank": True},
        }

    def validate_course(self, course):
        user = self.context["request"].user
        # Check if student is already enrolled
        from apps.enrollment.models import Enrollment
        if Enrollment.objects.filter(student=user, course=course).exists():
            raise serializers.ValidationError("Already enrolled in this course.")
        return course

    def validate_linkedin_url(self, value):
        return self._validate_optional_url(value, "linkedin.com")

    def validate_github_url(self, value):
        return self._validate_optional_url(value, "github.com")

    @staticmethod
    def _validate_optional_url(value, expected_host):
        value = (value or "").strip()
        if not value:
            return ""
        if not value.startswith(("https://", "http://")):
            value = "https://" + value
        if expected_host not in value.lower():
            raise serializers.ValidationError(f"Enter your {expected_host} profile URL.")
        return value

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