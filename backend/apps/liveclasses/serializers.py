"""Serializers for live classes and attendance."""
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from urllib.parse import urlsplit

from apps.courses.models import Course
from apps.liveclasses.models import Attendance, LiveClass


class LiveClassSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)
    scheduled_end = serializers.DateTimeField(read_only=True)
    joinable = serializers.SerializerMethodField()
    recording_status = serializers.CharField(read_only=True)
    recording_available = serializers.SerializerMethodField()
    attended = serializers.SerializerMethodField()
    duration_minutes = serializers.IntegerField(min_value=1, max_value=480, required=False)
    description = serializers.CharField(max_length=20000, required=False, allow_blank=True)

    class Meta:
        model = LiveClass
        fields = (
            "id",
            "course",
            "course_title",
            "title",
            "description",
            "scheduled_start",
            "duration_minutes",
            "scheduled_end",
            "provider",
            "join_url",
            "room_name",
            "status",
            "joinable",
            "recording_status",
            "recording_available",
            "attended",
            "created_at",
        )
        read_only_fields = ("recording_key",)

    def get_joinable(self, obj):
        return obj.is_joinable()

    def _request_user(self):
        return getattr(self.context.get("request"), "user", None)

    def get_recording_available(self, obj):
        if obj.recording_status != "ready" or not obj.recording_key:
            return False
        user = self._request_user()
        if not user or not user.is_authenticated:
            return False
        return obj._user_has_recording_access(user)

    def get_attended(self, obj):
        user = self._request_user()
        if not user or not user.is_authenticated or not user.is_student:
            return False
        if hasattr(obj, "member_attended"):
            return bool(obj.member_attended)
        return Attendance.objects.filter(live_class=obj, student=user).exists()

    def validate(self, attrs):
        provider = attrs.get("provider", getattr(self.instance, "provider", "external"))
        url = attrs.get("join_url", getattr(self.instance, "join_url", ""))
        if provider == "external":
            parsed = urlsplit(url)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                raise serializers.ValidationError({"join_url": "Enter a secure HTTPS meeting link without embedded credentials."})
        if self.instance and self.instance.attendances.exists():
            if "course" in attrs and attrs["course"].pk != self.instance.course_id:
                raise serializers.ValidationError("A session with attendance cannot move to another course.")
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = getattr(self.context.get("request"), "user", None)
        if not user or not (user.is_admin or instance.course.instructor_id == user.pk):
            data.pop("join_url", None)
            data.pop("room_name", None)
        return data

    def validate_course(self, course):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated and user.is_admin:
            return course
        if course.instructor_id != getattr(user, "id", None):
            raise PermissionDenied(
                "You can only schedule classes on your own courses."
            )
        return course


class AttendeeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.EmailField()


class AttendanceSerializer(serializers.ModelSerializer):
    student = AttendeeSerializer(read_only=True)

    class Meta:
        model = Attendance
        fields = ("id", "student", "joined_at")
        read_only_fields = fields
