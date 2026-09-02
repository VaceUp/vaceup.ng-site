"""Instructor (tutor) management dashboard: aggregate stats + student roster."""
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsInstructorOrAdmin
from apps.courses.models import Course
from apps.dashboard.serializers import InstructorStudentSerializer
from apps.enrollment.models import Enrollment
from apps.liveclasses.models import LiveClass
from apps.payments.models import Payment


class InstructorDashboardView(APIView):
    """GET /instructor/dashboard/ → headline numbers for the logged-in tutor."""

    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        user = request.user
        courses = Course.objects.filter(instructor=user)
        enrollments = Enrollment.objects.filter(course__instructor=user)
        revenue = (
            Payment.objects.filter(
                course__instructor=user, status=Payment.Status.SUCCESS
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        ).quantize(Decimal("0.01"))

        recent = (
            enrollments.select_related("student", "course")
            .order_by("-enrolled_at")[:5]
        )
        recent_data = [
            {
                "student_name": e.student.full_name,
                "course_title": e.course.title,
                "progress_percent": str(e.progress_percent),
                "enrolled_at": e.enrolled_at,
            }
            for e in recent
        ]

        return Response({
            "courses": {
                "total": courses.count(),
                "published": courses.filter(is_published=True).count(),
            },
            "students": enrollments.values("student").distinct().count(),
            "enrollments": {
                "active": enrollments.filter(
                    status=Enrollment.Status.ACTIVE).count(),
                "completed": enrollments.filter(
                    status=Enrollment.Status.COMPLETED).count(),
            },
            "revenue": str(revenue),
            "upcoming_classes": LiveClass.objects.filter(
                course__instructor=user,
                scheduled_start__gte=timezone.now(),
                status=LiveClass.Status.SCHEDULED,
            ).count(),
            "recent_enrollments": recent_data,
        })


class InstructorStudentsView(ListAPIView):
    """GET /instructor/students/ → paginated roster across the tutor's courses."""

    permission_classes = [IsInstructorOrAdmin]
    serializer_class = InstructorStudentSerializer
    filterset_fields = ["course", "status"]

    def get_queryset(self):
        return (
            Enrollment.objects.filter(course__instructor=self.request.user)
            .select_related("student", "course")
            .order_by("-enrolled_at")
        )
