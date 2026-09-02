"""Serializers for announcements."""
from rest_framework import serializers

from apps.announcements.models import Announcement, AnnouncementComment, AnnouncementReadReceipt
from apps.courses.serializers import CourseBasicSerializer


class AnnouncementCommentSerializer(serializers.ModelSerializer):
    """Serializer for announcement comments."""

    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_avatar = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()

    class Meta:
        model = AnnouncementComment
        fields = (
            "id",
            "announcement",
            "author",
            "author_name",
            "author_avatar",
            "body",
            "parent",
            "replies_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("author", "created_at", "updated_at")

    def get_author_avatar(self, obj):
        # Placeholder for avatar URL
        return None

    def get_replies_count(self, obj):
        return obj.replies.count()


class AnnouncementSerializer(serializers.ModelSerializer):
    """Read serializer for announcements."""

    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_avatar = serializers.SerializerMethodField()
    author_role = serializers.CharField(source="author.role", read_only=True)
    target_courses_detail = CourseBasicSerializer(source="target_courses", many=True, read_only=True)
    is_published = serializers.BooleanField(read_only=True)
    comments_count = serializers.SerializerMethodField()
    has_read = serializers.SerializerMethodField()
    unread = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "body",
            "target",
            "target_courses",
            "target_courses_detail",
            "priority",
            "status",
            "publish_at",
            "expires_at",
            "author",
            "author_name",
            "author_role",
            "author_avatar",
            "email_sent",
            "push_sent",
            "pin_to_top",
            "allow_comments",
            "send_email",
            "send_push",
            "is_published",
            "comments_count",
            "has_read",
            "unread",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "author",
            "email_sent",
            "push_sent",
            "created_at",
            "updated_at",
        )

    def get_author_avatar(self, obj):
        return None

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_has_read(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return AnnouncementReadReceipt.objects.filter(
                announcement=obj, user=request.user
            ).exists()
        return False

    def get_unread(self, obj):
        return not self.get_has_read(obj)


class AnnouncementCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating/updating announcements."""

    target_courses = serializers.PrimaryKeyRelatedField(
        queryset="courses.Course.objects.all()",
        many=True,
        required=False,
    )

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "body",
            "target",
            "target_courses",
            "priority",
            "status",
            "publish_at",
            "expires_at",
            "pin_to_top",
            "allow_comments",
            "send_email",
            "send_push",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        target = attrs.get("target", self.instance.target if self.instance else None)
        target_courses = attrs.get("target_courses", [])

        if target in [
            Announcement.Target.COURSE_STUDENTS,
            Announcement.Target.COURSE_INSTRUCTORS,
            Announcement.Target.ENROLLED_USERS,
        ]:
            if not target_courses:
                raise serializers.ValidationError(
                    {"target_courses": "At least one course is required for this target."}
                )

        return attrs


class AnnouncementReadReceiptSerializer(serializers.ModelSerializer):
    """Serializer for read receipts."""

    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = AnnouncementReadReceipt
        fields = ("id", "announcement", "user", "user_name", "read_at")
        read_only_fields = fields


class AnnouncementCommentSerializer(serializers.ModelSerializer):
    """Serializer for comments (read/write)."""

    author_name = serializers.CharField(source="author.full_name", read_only=True)

    class Meta:
        model = AnnouncementComment
        fields = (
            "id",
            "announcement",
            "author",
            "author_name",
            "body",
            "parent",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("author", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["author"] = self.context["request"].user
        return super().create(validated_data)


class AnnouncementCommentCreateSerializer(serializers.Serializer):
    """Serializer for creating comments."""

    body = serializers.CharField()
    parent_id = serializers.IntegerField(required=False, allow_null=True)