"""Serializers for admin panel."""
from django.contrib.auth import get_user_model
from apps.accounts.models import User
from apps.courses.models import Category, Course
from rest_framework import serializers

from apps.adminpanel.models import AdminActionLog, AdminSettings, SystemAnnouncement
from apps.courses.serializers import CourseBasicSerializer
from apps.accounts.serializers import UserSerializer


class AdminActionLogSerializer(serializers.ModelSerializer):
    """Serializer for admin action logs."""

    admin_name = serializers.CharField(source="admin.full_name", read_only=True)
    admin_email = serializers.CharField(source="admin.email", read_only=True)
    target_user_name = serializers.CharField(source="target_user.full_name", read_only=True)
    target_course_title = serializers.CharField(source="target_course.title", read_only=True)

    class Meta:
        model = AdminActionLog
        fields = (
            "id",
            "admin",
            "admin_name",
            "admin_email",
            "action_type",
            "target_user",
            "target_user_name",
            "target_course",
            "target_course_title",
            "description",
            "metadata",
            "ip_address",
            "user_agent",
            "created_at",
        )
        read_only_fields = fields


class AdminSettingsSerializer(serializers.ModelSerializer):
    """Serializer for admin settings."""

    class Meta:
        model = AdminSettings
        fields = (
            "key",
            "value",
            "description",
            "is_public",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class SystemAnnouncementSerializer(serializers.ModelSerializer):
    """Serializer for system announcements."""

    author_name = serializers.CharField(source="author.full_name", read_only=True)

    class Meta:
        model = SystemAnnouncement
        fields = (
            "id",
            "title",
            "body",
            "priority",
            "target",
            "is_published",
            "publish_at",
            "expires_at",
            "author",
            "author_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("author", "created_at", "updated_at")


class SystemAnnouncementCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating system announcements."""

    class Meta:
        model = SystemAnnouncement
        fields = (
            "title",
            "body",
            "priority",
            "target",
            "is_published",
            "publish_at",
            "expires_at",
        )

    def create(self, validated_data):
        validated_data["author"] = self.context["request"].user
        return super().create(validated_data)


class AdminActionLogCreateSerializer(serializers.Serializer):
    """Serializer for logging admin actions."""

    action_type = serializers.ChoiceField(choices=AdminActionLog.ActionType.choices)
    target_user_id = serializers.UUIDField(required=False, allow_null=True)
    target_course_id = serializers.UUIDField(required=False, allow_null=True)
    description = serializers.CharField()
    metadata = serializers.JSONField(required=False, default=dict)
    ip_address = serializers.IPAddressField(required=False, allow_null=True)
    user_agent = serializers.CharField(required=False, allow_blank=True)


class BulkPriceUpdateSerializer(serializers.Serializer):
    """Serializer for bulk course price updates."""

    course_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=100,
    )
    price_adjustment = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Positive to increase, negative to decrease"
    )
    is_percentage = serializers.BooleanField(
        default=False,
        help_text="If true, adjustment is a percentage; otherwise absolute amount"
    )


class StaffInviteSerializer(serializers.Serializer):
    """Serializer for inviting staff/tutors."""

    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=[
        ("instructor", "Instructor"),
        ("admin", "Admin"),
    ])
    tutor_profile = serializers.JSONField(
        required=False,
        help_text="Required if role is instructor: bio, expertise, experience_years, etc."
    )

class AdminUserListSerializer(serializers.ModelSerializer):
    """Read shape for the admin user directory."""

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "role", "is_active", "date_joined")
        read_only_fields = fields


class AdminCourseListSerializer(serializers.ModelSerializer):
    """Read shape for admin course management (includes drafts)."""

    class Meta:
        model = Course
        fields = ("id", "title", "slug", "price", "level", "category", "instructor",
                  "is_published", "description", "thumbnail", "duration", "image_url")
        read_only_fields = fields


class AdminCourseCreateSerializer(serializers.Serializer):
    """Write shape: create a course from the admin panel."""

    title = serializers.CharField(max_length=200)
    category_id = serializers.IntegerField(min_value=1)
    instructor_id = serializers.IntegerField(min_value=1)
    description = serializers.CharField(required=False, allow_blank=True)
    level = serializers.ChoiceField(choices=["beginner", "intermediate", "advanced"],
                                    default="beginner")
    price = serializers.DecimalField(max_digits=10, decimal_places=2, default=0, min_value=0)
    duration = serializers.CharField(max_length=80, required=False, allow_blank=True)
    image_url = serializers.URLField(required=False, allow_blank=True)
    is_published = serializers.BooleanField(default=False)


class AdminCourseUpdateSerializer(serializers.Serializer):
    """Write shape: edit price / publish state / title from the admin panel."""

    title = serializers.CharField(max_length=200, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=0)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False)
    instructor = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role=User.Role.INSTRUCTOR, is_active=True), required=False)
    duration = serializers.CharField(max_length=80, required=False, allow_blank=True)
    image_url = serializers.URLField(required=False, allow_blank=True)
    is_published = serializers.BooleanField(required=False)
