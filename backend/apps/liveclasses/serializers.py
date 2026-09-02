"""Serializers for live classes and attendance."""
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.courses.models import Course
from apps.liveclasses.models import Attendance, LiveClass


class LiveClassSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)
    scheduled_end = serializers.DateTimeField(read_only=True)
    joinable = serializers.SerializerMethodField()

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
            "created_at",
        )
        read_only_fields = ("recording_key",)

    def get_joinable(self, obj):
        return obj.is_joinable()

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
