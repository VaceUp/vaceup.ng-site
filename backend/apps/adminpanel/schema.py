"""Explicit action contracts for the admin dashboard, without runtime changes."""
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer, OpenApiParameter
from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.adminpanel.serializers import (
    AdminCourseCreateSerializer, AdminCourseListSerializer,
    AdminCourseUpdateSerializer, AdminUserListSerializer,
    BulkPriceUpdateSerializer, StaffInviteSerializer,
)
from apps.core.schema import DetailSerializer, unpaginated_schema
from apps.payments.serializers import PaymentSerializer


class AdminUserActionSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class AdminPasswordActionSerializer(AdminUserActionSerializer):
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})


class AdminCourseUpdateRequestSerializer(AdminCourseUpdateSerializer):
    course_id = serializers.IntegerField()


class AdminEnrollmentRowSerializer(serializers.Serializer):
    id = serializers.CharField()
    student_name = serializers.CharField()
    student_email = serializers.EmailField()
    course_title = serializers.CharField()
    status = serializers.CharField()
    progress_percent = serializers.FloatField()
    enrolled_at = serializers.DateTimeField()


class AdminSubmissionRowSerializer(serializers.Serializer):
    id = serializers.CharField()
    student_name = serializers.CharField()
    assignment_title = serializers.CharField()
    status = serializers.CharField()
    score = serializers.CharField(allow_null=True)
    feedback = serializers.CharField(allow_blank=True)
    submitted_at = serializers.DateTimeField()


def counts(name, *fields):
    return inline_serializer(name=name, fields={field: serializers.IntegerField() for field in fields})


AdminStatsSerializer = inline_serializer(name="AdminStats", fields={
    "users": counts("AdminUserCounts", "total", "students", "instructors", "admins", "new_last_30_days"),
    "courses": counts("AdminCourseCounts", "total", "published", "draft"),
    "enrollments": inline_serializer(name="AdminEnrollmentCounts", fields={
        "total": serializers.IntegerField(), "active": serializers.IntegerField(),
        "completed": serializers.IntegerField(), "revenue_last_30_days": serializers.FloatField(),
    }),
    "live_classes": counts("AdminLiveClassCounts", "total", "upcoming", "live"),
    "assignments": counts("AdminAssignmentCounts", "total", "submissions_pending"),
    "applications": counts("AdminApplicationCounts", "pending"),
})


admin_dashboard_schema = extend_schema_view(
    stats=extend_schema(request=None, responses=AdminStatsSerializer),
    invite_staff=extend_schema(request=StaffInviteSerializer, responses={201: UserSerializer}),
    deactivate_staff=extend_schema(request=AdminUserActionSerializer, responses=DetailSerializer),
    activate_staff=extend_schema(request=AdminUserActionSerializer, responses=DetailSerializer),
    promote_staff=extend_schema(request=AdminUserActionSerializer, responses=DetailSerializer),
    user_password=extend_schema(request=AdminPasswordActionSerializer, responses=DetailSerializer),
    bulk_price_update=extend_schema(request=BulkPriceUpdateSerializer, responses=inline_serializer(
        name="BulkPriceUpdateResult", fields={
            "detail": serializers.CharField(), "updated_count": serializers.IntegerField(),
        },
    )),
    users_list=extend_schema(responses=AdminUserListSerializer(many=True), parameters=[
        OpenApiParameter("search", str), OpenApiParameter("role", str, enum=["student", "instructor", "admin"]),
    ]),
    enrollments_list=unpaginated_schema(responses=AdminEnrollmentRowSerializer(many=True)),
    submissions_list=unpaginated_schema(responses=AdminSubmissionRowSerializer(many=True)),
    payments_list=unpaginated_schema(responses=PaymentSerializer(many=True)),
    courses_list=unpaginated_schema(responses=AdminCourseListSerializer(many=True)),
    course_create=extend_schema(request=AdminCourseCreateSerializer, responses={201: AdminCourseListSerializer}),
    course_update=extend_schema(request=AdminCourseUpdateRequestSerializer, responses=AdminCourseListSerializer),
)
