"""Admin Panel endpoints."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction, models
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.adminpanel import services
from apps.adminpanel.models import AdminActionLog, AdminSettings, SystemAnnouncement
from apps.adminpanel.serializers import (
    AdminActionLogSerializer,
    AdminSettingsSerializer,
    SystemAnnouncementSerializer,
    SystemAnnouncementCreateSerializer,
    AdminActionLogCreateSerializer,
    BulkPriceUpdateSerializer,
    StaffInviteSerializer,
)
from apps.courses.models import Course
from apps.core.exceptions import AlreadyExists, DomainError

User = get_user_model()


class IsAdmin(BasePermission):
    """Permission: admin only."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_admin
        )


class IsAdminOrInstructor(BasePermission):
    """Permission: admin or instructor."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and 
            (request.user.is_admin or request.user.is_instructor)
        )


class AdminActionLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit log for admin actions (admin only)."""

    permission_classes = [IsAdmin]
    serializer_class = AdminActionLogSerializer
    filterset_fields = ["action_type", "admin", "target_user", "target_course"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return AdminActionLog.objects.select_related(
            "admin", "target_user", "target_course"
        ).all()


class AdminSettingsViewSet(viewsets.ModelViewSet):
    """Global admin settings (admin only)."""

    permission_classes = [IsAdmin]
    serializer_class = AdminSettingsSerializer
    queryset = AdminSettings.objects.all()
    lookup_field = "key"


class SystemAnnouncementViewSet(viewsets.ModelViewSet):
    """System-wide announcements."""

    permission_classes = [IsAdmin]
    serializer_class = SystemAnnouncementSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return SystemAnnouncementCreateSerializer
        return SystemAnnouncementSerializer

    def get_queryset(self):
        return SystemAnnouncement.objects.select_related("author").all()

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        """POST /announcements/{id}/publish/ - publish announcement."""
        announcement = self.get_object()
        announcement.is_published = True
        announcement.publish_at = timezone.now()
        announcement.save(update_fields=["is_published", "publish_at", "updated_at"])
        return Response(SystemAnnouncementSerializer(announcement).data)

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, pk=None):
        """POST /announcements/{id}/unpublish/ - unpublish announcement."""
        announcement = self.get_object()
        announcement.is_published = False
        announcement.save(update_fields=["is_published", "updated_at"])
        return Response(SystemAnnouncementSerializer(announcement).data)


class AdminDashboardViewSet(viewsets.GenericViewSet):
    """Admin dashboard stats and actions."""

    permission_classes = [IsAdmin]

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """GET /admin/dashboard/stats/ - platform metrics."""
        from apps.courses.models import Course
        from apps.enrollment.models import Enrollment
        from apps.payments.models import Payment
        from apps.liveclasses.models import LiveClass
        from apps.assignments.models import Assignment, Submission
        from apps.applications.models import Application

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        return Response({
            "users": {
                "total": User.objects.count(),
                "students": User.objects.filter(role=User.Role.STUDENT).count(),
                "instructors": User.objects.filter(role=User.Role.INSTRUCTOR).count(),
                "admins": User.objects.filter(role=User.Role.ADMIN).count(),
                "new_last_30_days": User.objects.filter(created_at__gte=thirty_days_ago).count(),
            },
            "courses": {
                "total": Course.objects.count(),
                "published": Course.objects.filter(is_published=True).count(),
                "draft": Course.objects.filter(is_published=False).count(),
            },
            "enrollments": {
                "total": Enrollment.objects.count(),
                "active": Enrollment.objects.filter(status=Enrollment.Status.ACTIVE).count(),
                "completed": Enrollment.objects.filter(status=Enrollment.Status.COMPLETED).count(),
                "revenue_last_30_days": Payment.objects.filter(
                    status=Payment.Status.SUCCESS, created_at__gte=thirty_days_ago
                ).aggregate(total=models.Sum("amount"))["total"] or 0,
            },
            "live_classes": {
                "total": LiveClass.objects.count(),
                "upcoming": LiveClass.objects.filter(scheduled_start__gt=timezone.now()).count(),
                "live": LiveClass.objects.filter(status=LiveClass.Status.LIVE).count(),
            },
            "assignments": {
                "total": Assignment.objects.count(),
                "submissions_pending": Submission.objects.filter(status=Submission.Status.SUBMITTED).count(),
            },
            "applications": {
                "pending": Application.objects.filter(status=Application.Status.SUBMITTED).count(),
            },
        })

    @action(detail=False, methods=["post"], url_path="staff/invite")
    def invite_staff(self, request):
        """POST /admin/dashboard/staff/invite/ - invite tutor/staff."""
        serializer = StaffInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        email = data["email"]
        full_name = data["full_name"]
        role = data["role"]
        tutor_profile = data.get("tutor_profile", {})

        # Check if user already exists
        if User.objects.filter(email=email).exists():
            raise AlreadyExists("A user with this email already exists.")

        # Create user
        user = User.objects.create_user(
            email=email,
            full_name=full_name,
            role=User.Role.INSTRUCTOR if role == "instructor" else User.Role.ADMIN,
            is_active=True,
        )

        # Create tutor profile if instructor
        if role == "instructor":
            from apps.accounts.models import TutorProfile
            TutorProfile.objects.create(
                user=user,
                bio=tutor_profile.get("bio", ""),
                expertise=tutor_profile.get("expertise", []),
                experience_years=tutor_profile.get("experience_years", 0),
                hourly_rate_usd=tutor_profile.get("hourly_rate_usd"),
                timezone=tutor_profile.get("timezone", "UTC"),
                languages=tutor_profile.get("languages", ["English"]),
            )

        # Log action
        services.log_admin_action(
            admin=request.user,
            action_type=AdminActionLog.ActionType.TUTOR_INVITE if role == "instructor" 
                       else AdminActionLog.ActionType.STAFF_INVITE,
            target_user=user,
            description=f"Invited {full_name} as {role}",
            metadata={"tutor_profile": tutor_profile},
            request=request,
        )

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="staff/deactivate")
    def deactivate_staff(self, request):
        """POST /admin/dashboard/staff/deactivate/ {user_id} - deactivate staff."""
        user_id = request.data.get("user_id")
        if not user_id:
            raise DomainError("user_id is required.", code="user_id_required")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise DomainError("User not found.", code="user_not_found")

        if user.is_admin and user != request.user:
            raise DomainError("Cannot deactivate another admin.", code="cannot_deactivate_admin")

        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])

        # Revoke tokens (blacklist refresh tokens)
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
        OutstandingToken.objects.filter(user=user).delete()

        # Log action
        services.log_admin_action(
            admin=request.user,
            action_type=AdminActionLog.ActionType.STAFF_DEACTIVATE,
            target_user=user,
            description=f"Deactivated {user.full_name}",
            request=request,
        )

        return Response({"detail": "Staff deactivated successfully."})

    @action(detail=False, methods=["post"], url_path="staff/activate")
    def activate_staff(self, request):
        """POST /admin/dashboard/staff/activate/ {user_id} - activate staff."""
        user_id = request.data.get("user_id")
        if not user_id:
            raise DomainError("user_id is required.", code="user_id_required")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise DomainError("User not found.", code="user_not_found")

        user.is_active = True
        user.save(update_fields=["is_active", "updated_at"])

        services.log_admin_action(
            admin=request.user,
            action_type=AdminActionLog.ActionType.STAFF_ACTIVATE,
            target_user=user,
            description=f"Activated {user.full_name}",
            request=request,
        )

        return Response({"detail": "Staff activated successfully."})

    @action(detail=False, methods=["post"], url_path="staff/promote")
    def promote_staff(self, request):
        """POST /admin/dashboard/staff/promote/ {user_id} - promote to admin."""
        user_id = request.data.get("user_id")
        if not user_id:
            raise DomainError("user_id is required.", code="user_id_required")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise DomainError("User not found.", code="user_not_found")

        user.role = User.Role.ADMIN
        user.is_staff = True
        user.save(update_fields=["role", "is_staff", "updated_at"])

        services.log_admin_action(
            admin=request.user,
            action_type=AdminActionLog.ActionType.STAFF_PROMOTE,
            target_user=user,
            description=f"Promoted {user.full_name} to admin",
            request=request,
        )

        return Response({"detail": "Staff promoted to admin."})

    @action(detail=False, methods=["post"], url_path="courses/bulk-price")
    def bulk_price_update(self, request):
        """POST /admin/dashboard/courses/bulk-price/ - bulk price update."""
        serializer = BulkPriceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        course_ids = data["course_ids"]
        adjustment = data["price_adjustment"]
        is_percentage = data["is_percentage"]

        courses = Course.objects.filter(id__in=course_ids)
        updated = 0

        with transaction.atomic():
            for course in courses:
                if is_percentage:
                    course.price = course.price * (Decimal("1.00") + adjustment / Decimal("100.00"))
                else:
                    course.price = course.price + adjustment
                course.save(update_fields=["price", "updated_at"])
                updated += 1

        services.log_admin_action(
            admin=request.user,
            action_type=AdminActionLog.ActionType.COURSE_BULK_PRICE,
            description=f"Bulk price update for {updated} courses (adjustment: {adjustment}{'%' if data['is_percentage'] else ''})",
            metadata={"course_ids": [str(c) for c in course_ids], "adjustment": str(adjustment), "is_percentage": data["is_percentage"]},
            request=request,
        )

        return Response({"detail": f"Updated {updated} courses.", "updated_count": updated})