"""Account-scoped student/tutor workspace reads. No demo data; the only write is
settling a checkout the payment provider already confirmed (see
``reconcile_locked_applications``)."""
import logging
from datetime import timedelta

from django.db.models import Count, Exists, F, Min, OuterRef, Q, Subquery, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.cache import patch_cache_control
from rest_framework import serializers
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.applications.models import Application
from apps.assignments.models import Assignment, Quiz, QuizAttempt, Submission
from apps.certificates.models import Certificate
from apps.core.exceptions import PaymentProviderUnavailable
from apps.courses.models import Course, Lesson
from apps.courses.serializers import CourseDetailSerializer
from apps.enrollment.models import Enrollment, LessonProgress
from apps.liveclasses.models import JOIN_GRACE, LiveClass
from apps.payments import services as payment_services
from apps.payments.models import Payment

logger = logging.getLogger(__name__)

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


class WorkspaceAgendaItemSerializer(serializers.Serializer):
    kind = serializers.CharField()
    id = serializers.IntegerField()
    title = serializers.CharField()
    course_id = serializers.IntegerField()
    course_title = serializers.CharField()
    when = serializers.DateTimeField(allow_null=True)
    state = serializers.CharField()
    detail = serializers.CharField()
    href = serializers.CharField()


class WorkspaceTaskSerializer(serializers.Serializer):
    kind = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()
    href = serializers.CharField()


class WorkspaceApplicationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    course = serializers.IntegerField(source="course_id")
    course_title = serializers.CharField(source="course.title")
    course_slug = serializers.CharField(source="course.slug")
    price = serializers.DecimalField(source="course.price", max_digits=10, decimal_places=2)
    reviewed_at = serializers.DateTimeField(allow_null=True)


def approved_applications(user):
    """Applications accepted by the academy that still need a paid checkout."""
    if user.is_instructor:
        return Application.objects.none()
    return (
        Application.objects.filter(student=user, status=Application.Status.APPROVED)
        .exclude(course__enrollments__student=user)
        .select_related("course")
        .order_by("-reviewed_at", "-pk")
    )


# A re-check is a provider round trip, so a payment the provider just answered
# about is not asked about again while the same page loads its panels.
_RECONCILE_AFTER = timedelta(seconds=30)
_RECONCILE_LIMIT = 5


def reconcile_pending_payments(user, *, course_ids=None, max_age=None):
    """Settle checkouts Paystack captured but this server never confirmed.

    The return page and the webhook are the fast paths, and both can be missed:
    the buyer may close the tab before returning, and a webhook only arrives
    while it is registered on the Paystack dashboard. Asking the provider
    directly is what lets a paid course unlock without a support ticket. A
    provider outage must never take the workspace down with it.
    """
    if user.is_instructor:
        return 0
    if course_ids is not None and not course_ids:
        return 0
    payments = Payment.objects.filter(
        student=user, status__in=payment_services.RECHECKABLE_STATUSES,
        updated_at__lt=timezone.now() - _RECONCILE_AFTER,
    )
    if course_ids is not None:
        payments = payments.filter(
            Q(course_id__in=course_ids) | Q(items__course_id__in=course_ids))
    if max_age is not None:
        payments = payments.filter(created_at__gte=timezone.now() - max_age)
    open_payments = list(payments.distinct().order_by("-created_at")[:_RECONCILE_LIMIT])
    if not open_payments:
        return 0
    try:
        return payment_services.reconcile_payments(open_payments)
    except PaymentProviderUnavailable:
        logger.warning("Paystack unreachable while reconciling payments for user %s", user.pk)
        return 0


def reconcile_locked_applications(user):
    """Re-check only the orders behind an accepted application still owed."""
    return reconcile_pending_payments(
        user,
        course_ids=list(approved_applications(user).values_list("course_id", flat=True)),
    )


def _agenda_item(kind, pk, title, course, when, state, detail, href):
    return {
        "kind": kind, "id": pk, "title": title, "course_id": course.pk,
        "course_title": course.title, "when": when, "state": state,
        "detail": detail, "href": href,
    }


def _class_agenda(courses, limit=3):
    now = timezone.now()
    classes = (LiveClass.objects.filter(course__in=courses)
               .filter(Q(status=LiveClass.Status.LIVE) |
                       Q(status=LiveClass.Status.SCHEDULED,
                         scheduled_start__gte=now - timedelta(hours=6)))
               .exclude(status__in=(LiveClass.Status.CANCELLED, LiveClass.Status.ENDED))
               .select_related("course").order_by("scheduled_start"))
    rows = []
    for session in classes:
        # A scheduled session whose window closed is no longer "next up".
        if (session.status == LiveClass.Status.SCHEDULED
                and session.scheduled_end + JOIN_GRACE < now):
            continue
        if session.status == LiveClass.Status.LIVE:
            state = "live"
        elif session.is_joinable(now):
            state = "join now"
        else:
            state = "scheduled"
        rows.append(_agenda_item(
            "class", session.pk, session.title, session.course,
            session.scheduled_start, state,
            f"{session.duration_minutes} minutes", "/dashboard/live-classes",
        ))
        if len(rows) == limit:
            break
    return rows


def _student_agenda(user, courses):
    now = timezone.now()
    rows = []
    mine = Submission.objects.filter(assignment=OuterRef("pk"), student=user)
    assignments = (Assignment.objects.filter(
        course__in=courses, is_published=True, due_at__gte=now - timedelta(days=14))
        .annotate(submission_status=Subquery(mine.values("status")[:1]))
        .filter(Q(submission_status__isnull=True) |
                ~Q(submission_status=Submission.Status.GRADED))
        .select_related("course").order_by("due_at")[:4])
    for assignment in assignments:
        status = assignment.submission_status
        if status in (Submission.Status.SUBMITTED, Submission.Status.LATE,
                      Submission.Status.REVIEW):
            state, detail = "awaiting grading", "Submitted. Your tutor has not recorded a grade yet."
        else:
            state = "overdue" if assignment.due_at < now else "due"
            detail = f"{assignment.max_score} marks. Due {assignment.due_at:%d %b %Y, %H:%M}."
        rows.append(_agenda_item(
            "assignment", assignment.pk, assignment.title, assignment.course,
            assignment.due_at, state, detail,
            f"/dashboard/assessments?view=list&assignment={assignment.pk}",
        ))

    attempts = QuizAttempt.objects.filter(quiz=OuterRef("pk"), student=user)
    quizzes = (Quiz.objects.filter(course__in=courses, status=Quiz.Status.PUBLISHED)
               .annotate(attempt_status=Subquery(attempts.values("status")[:1]))
               .filter(Q(attempt_status__isnull=True) |
                       Q(attempt_status=QuizAttempt.Status.IN_PROGRESS))
               .select_related("course").order_by("-created_at")[:3])
    for quiz in quizzes:
        state = "in progress" if quiz.attempt_status == QuizAttempt.Status.IN_PROGRESS else "available"
        rows.append(_agenda_item(
            "quiz", quiz.pk, quiz.title, quiz.course, None, state,
            f"{quiz.pass_mark}% to pass. {quiz.time_limit_minutes}-minute limit.",
            f"/dashboard/assessments?view=list&quiz={quiz.pk}",
        ))

    rows.extend(_class_agenda(courses))
    rows.sort(key=lambda row: row["when"] or now)
    return rows[:8]


def _tutor_agenda(user, courses):
    now = timezone.now()
    awaiting = Count("submissions", filter=Q(
        submissions__score__isnull=True,
        submissions__status__in=(Submission.Status.SUBMITTED, Submission.Status.LATE,
                                 Submission.Status.REVIEW),
    ))
    assignments = (Assignment.objects.filter(course__in=courses)
                   .annotate(awaiting=awaiting).filter(awaiting__gt=0)
                   .select_related("course").order_by("due_at")[:4])
    rows = []
    for assignment in assignments:
        state = "overdue" if assignment.due_at < now else "due"
        rows.append(_agenda_item(
            "assignment", assignment.pk, assignment.title, assignment.course,
            assignment.due_at, state,
            f"{assignment.awaiting} submission{'s' if assignment.awaiting != 1 else ''} awaiting grading.",
            f"/dashboard/assessments?view=list&assignment={assignment.pk}",
        ))
    rows.extend(_class_agenda(courses))
    rows.sort(key=lambda row: row["when"] or now)
    return rows[:8]


def _student_tasks(user, courses):
    now = timezone.now()
    mine = Submission.objects.filter(assignment=OuterRef("pk"), student=user)
    assignments = (Assignment.objects.filter(
        course__in=courses, is_published=True, due_at__gte=now - timedelta(days=30))
        .annotate(has_submission=Exists(mine)).filter(has_submission=False).count())
    attempts = QuizAttempt.objects.filter(quiz=OuterRef("pk"), student=user)
    quizzes = (Quiz.objects.filter(course__in=courses, status=Quiz.Status.PUBLISHED)
               .annotate(attempt_status=Subquery(attempts.values("status")[:1]))
               .filter(Q(attempt_status__isnull=True) |
                       Q(attempt_status=QuizAttempt.Status.IN_PROGRESS)).count())
    classes = (LiveClass.objects.filter(
        course__in=courses, status=LiveClass.Status.SCHEDULED,
        scheduled_start__gte=now, scheduled_start__lte=now + timedelta(days=7)).count())
    total_lessons = Lesson.objects.filter(module__course__in=courses).count()
    completed = LessonProgress.objects.filter(
        enrollment__student=user, enrollment__course__in=courses,
        enrollment__status__in=ACCESS_STATUSES, completed=True).count()
    return [
        {"kind": "assignments", "label": "Assignments to submit", "count": assignments,
         "href": "/dashboard/assessments?view=list"},
        {"kind": "quizzes", "label": "Quizzes to take", "count": quizzes,
         "href": "/dashboard/assessments?view=list"},
        {"kind": "classes", "label": "Classes this week", "count": classes,
         "href": "/dashboard/live-classes"},
        {"kind": "lessons", "label": "Lessons remaining", "count": max(total_lessons - completed, 0),
         "href": "/dashboard/courses"},
    ]


def _tutor_tasks(user, courses):
    now = timezone.now()
    ungraded = Submission.objects.filter(
        assignment__course__in=courses, score__isnull=True,
        status__in=(Submission.Status.SUBMITTED, Submission.Status.LATE,
                    Submission.Status.REVIEW)).count()
    drafts = courses.filter(is_published=False).count()
    quiz_drafts = Quiz.objects.filter(course__in=courses, status=Quiz.Status.DRAFT).count()
    classes = LiveClass.objects.filter(
        course__in=courses, status=LiveClass.Status.SCHEDULED,
        scheduled_start__gte=now, scheduled_start__lte=now + timedelta(days=7)).count()
    return [
        {"kind": "grading", "label": "Submissions to grade", "count": ungraded,
         "href": "/dashboard/assessments?view=list"},
        {"kind": "drafts", "label": "Unpublished courses", "count": drafts,
         "href": "/dashboard/content"},
        {"kind": "quizzes", "label": "Quiz drafts", "count": quiz_drafts,
         "href": "/dashboard/assessments?view=list"},
        {"kind": "classes", "label": "Classes this week", "count": classes,
         "href": "/dashboard/live-classes"},
    ]


class WorkspaceOverviewSerializer(serializers.Serializer):
    role = serializers.CharField()
    counts = serializers.DictField(child=serializers.IntegerField())
    recent_courses = WorkspaceCourseSerializer(many=True)
    upcoming_classes = WorkspaceLiveClassSerializer(many=True)
    agenda = WorkspaceAgendaItemSerializer(many=True)
    tasks = WorkspaceTaskSerializer(many=True)
    approved_applications = WorkspaceApplicationSerializer(many=True)
    updated_at = serializers.DateTimeField()


class WorkspaceOverviewView(PrivateWorkspaceResponse, GenericAPIView):
    permission_classes = [IsWorkspaceMember]
    serializer_class = WorkspaceOverviewSerializer

    def get(self, request):
        user = request.user
        reconcile_locked_applications(user)
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
        agenda = (_tutor_agenda(user, courses) if user.is_instructor
                  else _student_agenda(user, courses))
        tasks = (_tutor_tasks(user, courses) if user.is_instructor
                 else _student_tasks(user, courses))
        awaiting = approved_applications(user)
        awaiting_count = awaiting.count()
        if awaiting_count:
            tasks = [{
                "kind": "payment", "label": "Accepted courses to pay for",
                "count": awaiting_count, "href": "/dashboard/courses",
            }, *tasks]
        return Response(self.get_serializer({
            "role": user.role, "counts": counts,
            "recent_courses": workspace_courses(user)[:3],
            "upcoming_classes": upcoming, "agenda": agenda, "tasks": tasks,
            "approved_applications": awaiting[:5],
            "updated_at": timezone.now(),
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

    def list(self, request, *args, **kwargs):
        # The history is where a learner checks "did my payment go through", so
        # an order the provider confirms is settled before the list is built.
        reconcile_pending_payments(request.user, max_age=timedelta(days=90))
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Payment.objects.none()
        return Payment.objects.filter(student=self.request.user).select_related("course").order_by("-created_at", "-pk")


class WorkspaceApplicationListView(PrivateWorkspaceResponse, ListAPIView):
    """Accepted applications whose course still needs a payment or grant."""

    permission_classes = [IsWorkspaceMember]
    serializer_class = WorkspaceApplicationSerializer

    def list(self, request, *args, **kwargs):
        # Runs before the queryset is read, so a payment confirmed here is gone
        # from this response instead of surfacing one request later.
        reconcile_locked_applications(request.user)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Application.objects.none()
        return approved_applications(self.request.user)
