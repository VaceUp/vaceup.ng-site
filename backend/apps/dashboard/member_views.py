"""Account-scoped student/tutor workspace reads. No demo data or write side effects."""
from django.db.models import Count, F, OuterRef, Q, Subquery, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.cache import patch_cache_control
from rest_framework import serializers
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.certificates.models import Certificate
from apps.courses.models import Course, Lesson
from apps.courses.serializers import CourseDetailSerializer
from apps.enrollment.models import Enrollment, LessonProgress
from apps.liveclasses.models import LiveClass
from apps.payments.models import Payment

ACCESS_STATUSES = (Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED)


class PrivateWorkspaceResponse:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        patch_cache_control(response, private=True, no_store=True)
        return response


class IsWorkspaceMember(IsAuthenticated):
    def has_permission(self, request, view):
        return bool(super().has_permission(request, view) and
                    (request.user.is_student or request.user.is_instructor))


def accessible_courses(user):
    courses = Course.objects.all()
    if user.is_instructor:
        return courses.filter(instructor=user)
    return courses.filter(enrollments__student=user,
                          enrollments__status__in=ACCESS_STATUSES)


class WorkspaceCourseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()
    description = serializers.CharField()
    instructor_name = serializers.CharField(source="instructor.full_name")
    category_name = serializers.CharField(source="category.name")
    thumbnail = serializers.ImageField(allow_null=True)
    image_url = serializers.CharField()
    is_published = serializers.BooleanField()
    level = serializers.CharField()
    duration = serializers.CharField()
    lesson_count = serializers.IntegerField(allow_null=True)
    enrollment_status = serializers.CharField(allow_null=True)
    enrollment_id = serializers.IntegerField(allow_null=True)
    progress_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    student_count = serializers.IntegerField(allow_null=True)


def workspace_courses(user):
    # Correlated counts avoid lesson x enrollment joins and per-card queries.
    lesson_count = (Lesson.objects.filter(module__course=OuterRef("pk"))
                    .order_by().values("module__course").annotate(n=Count("pk")).values("n"))
    mine = Enrollment.objects.filter(student=user, course=OuterRef("pk"))
    students = (Enrollment.objects.filter(course=OuterRef("pk"), status__in=ACCESS_STATUSES)
                .order_by().values("course").annotate(n=Count("student", distinct=True)).values("n"))
    qs = Course.objects.select_related("instructor", "category").annotate(
        lesson_count=Subquery(lesson_count), enrollment_status=Subquery(mine.values("status")[:1]),
        enrollment_id=Subquery(mine.values("pk")[:1]),
        progress_percent=Subquery(mine.values("progress_percent")[:1]),
        student_count=Subquery(students),
    )
    if user.is_instructor:
        return qs.filter(instructor=user).order_by("-updated_at", "-pk")
    # Suspended enrollments remain visible, but never unlock course content.
    return qs.filter(enrollments__student=user).order_by("-enrollments__enrolled_at", "-pk")


class WorkspaceCourseListView(PrivateWorkspaceResponse, ListAPIView):
    permission_classes = [IsWorkspaceMember]
    serializer_class = WorkspaceCourseSerializer
    filterset_fields = ["is_published", "level"]
    search_fields = ["title", "description"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Course.objects.none()
        return workspace_courses(self.request.user)


class WorkspaceLiveClassSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title")
    joinable = serializers.BooleanField(source="is_joinable")

    class Meta:
        model = LiveClass
        fields = ("id", "title", "course_title", "scheduled_start", "duration_minutes", "status", "joinable")


class WorkspaceOverviewSerializer(serializers.Serializer):
    role = serializers.CharField()
    counts = serializers.DictField(child=serializers.IntegerField())
    recent_courses = WorkspaceCourseSerializer(many=True)
    upcoming_classes = WorkspaceLiveClassSerializer(many=True)
    updated_at = serializers.DateTimeField()


class WorkspaceOverviewView(PrivateWorkspaceResponse, GenericAPIView):
    permission_classes = [IsWorkspaceMember]
    serializer_class = WorkspaceOverviewSerializer

    def get(self, request):
        user = request.user
        courses = accessible_courses(user)
        if user.is_instructor:
            enrollments = Enrollment.objects.filter(course__instructor=user)
            counts = {
                "courses": courses.count(),
                "published_courses": courses.filter(is_published=True).count(),
                "students": enrollments.filter(status__in=ACCESS_STATUSES).values("student").distinct().count(),
                "completed_courses": enrollments.filter(status=Enrollment.Status.COMPLETED).count(),
            }
        else:
            enrollments = Enrollment.objects.filter(student=user)
            progress = LessonProgress.objects.filter(
                enrollment__student=user, enrollment__status__in=ACCESS_STATUSES,
                completed=True, lesson__module__course=F("enrollment__course"),
            ).aggregate(lessons=Count("pk"), seconds=Sum("lesson__duration_seconds"))
            counts = {
                "courses": courses.count(),
                "completed_courses": enrollments.filter(status=Enrollment.Status.COMPLETED).count(),
                "lessons_completed": progress["lessons"],
                # Curriculum duration, not tracked screen time or a fabricated streak.
                "completed_lesson_seconds": progress["seconds"] or 0,
                "certificates": Certificate.objects.filter(student=user, status=Certificate.Status.ISSUED)
                    .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).count(),
            }
        upcoming = (LiveClass.objects.filter(course__in=courses)
                    .filter(Q(status=LiveClass.Status.LIVE) |
                            Q(status=LiveClass.Status.SCHEDULED, scheduled_start__gte=timezone.now()))
                    .select_related("course").order_by("scheduled_start", "pk")[:4])
        return Response(self.get_serializer({
            "role": user.role, "counts": counts,
            "recent_courses": workspace_courses(user)[:3],
            "upcoming_classes": upcoming, "updated_at": timezone.now(),
        }).data)


class WorkspaceCourseDetailSerializer(serializers.Serializer):
    course = CourseDetailSerializer()
    enrollment_id = serializers.IntegerField(allow_null=True)
    completed_lesson_ids = serializers.ListField(child=serializers.IntegerField())


class WorkspaceCourseDetailView(PrivateWorkspaceResponse, GenericAPIView):
    permission_classes = [IsWorkspaceMember]
    serializer_class = WorkspaceCourseDetailSerializer

    def get(self, request, pk):
        course = get_object_or_404(accessible_courses(request.user)
                                  .select_related("category", "instructor")
                                  .prefetch_related("modules__lessons"), pk=pk)
        enrollment = None if request.user.is_instructor else get_object_or_404(
            Enrollment, student=request.user, course=course, status__in=ACCESS_STATUSES)
        completed = [] if enrollment is None else list(enrollment.lesson_progress.filter(
            completed=True, lesson__module__course=course).values_list("lesson_id", flat=True))
        return Response(self.get_serializer({
            "course": course, "enrollment_id": enrollment.pk if enrollment else None,
            "completed_lesson_ids": completed,
        }).data)


class WorkspacePaymentSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title")

    class Meta:
        model = Payment
        fields = ("reference", "course_title", "amount", "currency", "status", "paid_at", "created_at")


class WorkspacePaymentListView(PrivateWorkspaceResponse, ListAPIView):
    permission_classes = [IsWorkspaceMember]
    serializer_class = WorkspacePaymentSerializer
    filterset_fields = ["status"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Payment.objects.none()
        return Payment.objects.filter(student=self.request.user).select_related("course").order_by("-created_at", "-pk")
