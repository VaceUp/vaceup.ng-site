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
    AdminCourseCreateSerializer,
    AdminCourseListSerializer,
    AdminCourseUpdateSerializer,
    AdminUserListSerializer,
)
from apps.courses.models import Course
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils.text import slugify
from apps.core.exceptions import AlreadyExists, DomainError
from apps.payments.serializers import PaymentSerializer
from apps.payments.models import Payment

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
                "new_last_30_days": User.objects.filter(date_joined__gte=thirty_days_ago).count(),
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
        except (User.DoesNotExist, ValueError, ValidationError):
            # ValueError/ValidationError: user_id is not a valid UUID
            raise DomainError("User not found (check the user id).", code="user_not_found")

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
        except (User.DoesNotExist, ValueError, ValidationError):
            # ValueError/ValidationError: user_id is not a valid UUID
            raise DomainError("User not found (check the user id).", code="user_not_found")

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
        except (User.DoesNotExist, ValueError, ValidationError):
            # ValueError/ValidationError: user_id is not a valid UUID
            raise DomainError("User not found (check the user id).", code="user_not_found")

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

    # ────────────────────────────────────────────── user directory (admin panel)
    @action(detail=False, methods=["post"], url_path="users/password")
    def user_password(self, request):
        """POST /admin/dashboard/users/password/ {user_id, new_password} — admin sets a password."""
        user_id = request.data.get("user_id")
        new_password = request.data.get("new_password")
        if not user_id or not new_password:
            raise DomainError("user_id and new_password are required.", code="password_params")

        from django.contrib.auth import password_validation
        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError, ValidationError):
            raise DomainError("User not found (check the user id).", code="user_not_found")

        try:
            password_validation.validate_password(new_password, user)
        except Exception as exc:
            raise DomainError(" ".join(str(exc).split()), code="weak_password")

        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
        return Response({"detail": f"Password updated for {user.full_name or user.email}."})

    @action(detail=False, methods=["post"], url_path="users/delete")
    def users_delete(self, request):
        """POST /admin/dashboard/users/delete/ {user_id} — permanently delete a user.

        Admins cannot be deleted. Users with payment history are refused
        (deactivate instead) — financial records must be kept.
        """
        user_id = request.data.get("user_id")
        if not user_id:
            raise DomainError("user_id is required.", code="user_id_required")
        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError, ValidationError):
            raise DomainError("User not found (check the user id).", code="user_not_found")

        if user.is_superuser or user.is_admin:
            raise DomainError(
                "Admin accounts cannot be deleted — deactivate instead.",
                code="cannot_delete_admin",
            )

        from django.db import transaction as db_transaction
        from django.db.models import ProtectedError

        try:
            with db_transaction.atomic():
                # Clear related rows that would block deletion (safe to remove).
                user.messages.all().delete() if hasattr(user, "messages") else None
                user.notifications.all().delete() if hasattr(user, "notifications") else None
                user.enrollments.all().delete() if hasattr(user, "enrollments") else None
                user.applications.all().delete() if hasattr(user, "applications") else None
                user.certificates.all().delete() if hasattr(user, "certificates") else None
                user.submissions.all().delete() if hasattr(user, "submissions") else None
                user.tokens.all().delete() if hasattr(user, "tokens") else None
                user.outstandingtoken_set.all().delete()
                if hasattr(user, "cart"):
                    user.cart.delete() if user.cart else None
                if hasattr(user, "tutor_profile"):
                    user.tutor_profile.delete() if user.tutor_profile else None
                user.delete()
        except ProtectedError:
            raise DomainError(
                "This user has records that prevent deletion (e.g. payment history). "
                "Use Deactivate instead.",
                code="protected",
            )

        services.log_admin_action(
            admin=request.user,
            action_type=AdminActionLog.ActionType.STAFF_DEACTIVATE,
            description=f"Deleted user {user_id}",
            request=request,
        )
        return Response({"detail": "User deleted permanently."})

    @action(detail=False, methods=["post"], url_path="certificates/issue")
    def certificates_issue(self, request):
        """POST /admin/dashboard/certificates/issue/ {student_id, course_id}.

        Issues a certificate for the student on the given course. Marks the
        enrollment completed if it isn't already. PDF generation failures are
        non-fatal — the certificate (and its verify page) still exists.
        """
        student_id = request.data.get("student_id")
        course_id = request.data.get("course_id")
        if not student_id or not course_id:
            raise DomainError("student_id and course_id are required.", code="params")

        from apps.certificates.services import issue_certificate
        from apps.enrollment.models import Enrollment
        from apps.certificates.models import Certificate

        try:
            student = User.objects.get(id=student_id)
            course = Course.objects.get(id=course_id)
        except (User.DoesNotExist, Course.DoesNotExist, ValueError, ValidationError):
            raise DomainError("Student or course not found.", code="not_found")

        enrollment = Enrollment.objects.filter(student=student, course=course).first()
        if not enrollment:
            raise DomainError(
                "That student is not enrolled in this course.", code="not_enrolled"
            )

        if enrollment.status != Enrollment.Status.COMPLETED:
            enrollment.status = Enrollment.Status.COMPLETED
            if not enrollment.completed_at:
                from django.utils import timezone as _tz
                enrollment.completed_at = _tz.now()
            enrollment.save(update_fields=["status", "completed_at", "updated_at"])

        try:
            certificate = issue_certificate(enrollment=enrollment)
        except Exception:
            certificate = Certificate.objects.filter(enrollment=enrollment).first()
            if not certificate:
                raise DomainError(
                    "Certificate could not be generated (PDF engine unavailable on this host).",
                    code="pdf_failed",
                )
            # Certificate record exists — the PDF just failed. Good enough.

        return Response({
            "detail": "Certificate issued.",
            "certificate_number": certificate.certificate_number,
            "verification_code": certificate.verification_code,
            "student_name": certificate.student_name_at_issue,
            "course_title": certificate.course_title_at_issue,
        })

    @action(detail=False, methods=["get"], url_path="users")
    def users_list(self, request):
        """GET /admin/dashboard/users/?search=&role= — the user directory."""
        qs = User.objects.order_by("-date_joined")
        search = request.query_params.get("search")
        role = request.query_params.get("role")
        if search:
            qs = qs.filter(Q(email__icontains=search) | Q(full_name__icontains=search))
        if role:
            qs = qs.filter(role=role)
        page = self.paginate_queryset(qs)
        serializer = AdminUserListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="enrollments")
    def enrollments_list(self, request):
        """GET /admin/dashboard/enrollments/ — every enrollment on the platform."""
        from apps.enrollment.models import Enrollment
        enrollments = Enrollment.objects.select_related("student", "course").order_by(
            "-enrolled_at"
        )[:300]
        data = [
            {
                "id": str(e.id),
                "student_name": e.student.full_name,
                "student_email": e.student.email,
                "course_title": e.course.title,
                "status": e.status,
                "progress_percent": e.progress_percent,
                "enrolled_at": e.enrolled_at,
            }
            for e in enrollments
        ]
        return Response(data)

    @action(detail=False, methods=["get"], url_path="submissions")
    def submissions_list(self, request):
        """GET /admin/dashboard/submissions/ — every assignment submission (for grading)."""
        from apps.assignments.models import Submission
        subs = Submission.objects.select_related("student", "assignment").order_by(
            "-created_at"
        )[:300]
        data = [
            {
                "id": str(sub.id),
                "student_name": sub.student.full_name,
                "assignment_title": sub.assignment.title,
                "status": sub.status,
                "score": str(sub.score) if sub.score is not None else None,
                "feedback": sub.feedback,
                "submitted_at": sub.created_at,
            }
            for sub in subs
        ]
        return Response(data)

    @action(detail=False, methods=["get"], url_path="payments")
    def payments_list(self, request):
        """GET /admin/dashboard/payments/ — every payment on the platform."""
        payments = Payment.objects.select_related("student", "course").order_by("-created_at")[:200]
        return Response(PaymentSerializer(payments, many=True).data)

    # ────────────────────────────────────────────── course management (admin panel)
    @action(detail=False, methods=["get"], url_path="courses")
    def courses_list(self, request):
        """GET /admin/dashboard/courses/ — all courses including drafts."""
        courses = Course.objects.select_related("category", "instructor").order_by("-created_at")
        return Response(AdminCourseListSerializer(courses, many=True).data)

    @action(detail=False, methods=["post"], url_path="courses/create")
    def course_create(self, request):
        """POST /admin/dashboard/courses/create/ — create a course."""
        serializer = AdminCourseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from apps.courses.models import Category
        try:
            category = Category.objects.get(id=data["category_id"])
        except Category.DoesNotExist:
            raise DomainError("Category not found.", code="category_not_found")

        try:
            instructor = User.objects.get(id=data["instructor_id"], role=User.Role.INSTRUCTOR)
        except User.DoesNotExist:
            raise DomainError(
                "Instructor not found — invite a tutor first, then assign them.",
                code="instructor_not_found",
            )

        title = data["title"].strip()
        slug = slugify(title)[:220] or f"course-{User.objects.count()}"
        if Course.objects.filter(slug=slug).exists():
            import uuid as _uuid
            slug = f"{slug}-{_uuid.uuid4().hex[:6]}"

        course = Course.objects.create(
            title=title,
            slug=slug,
            category=category,
            instructor=instructor,
            description=data.get("description", ""),
            level=data["level"],
            price=data["price"],
            is_published=data["is_published"],
            duration=data.get("duration", ""),
            image_url=data.get("image_url", ""),
        )
        return Response(AdminCourseListSerializer(course).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="courses/update")
    def course_update(self, request):
        """POST /admin/dashboard/courses/update/ {course_id, price?, is_published?, title?}."""
        course_id = request.data.get("course_id")
        if not course_id:
            raise DomainError("course_id is required.", code="course_id_required")
        try:
            course = Course.objects.get(id=course_id)
        except (Course.DoesNotExist, ValueError, ValidationError):
            raise DomainError("Course not found (check the course id).", code="course_not_found")

        serializer = AdminCourseUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(course, field, value)

        course.save()
        return Response(AdminCourseListSerializer(course).data)
