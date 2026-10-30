"""Assignment and quiz endpoints."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.http import FileResponse
from django.utils.cache import patch_cache_control
from django.shortcuts import get_object_or_404
from django.db import transaction
from apps.enrollment.models import Enrollment

from apps.assignments import services, workflows
from apps.assignments.models import Assignment, Submission, Quiz, QuizAttempt
from apps.assignments.serializers import (
    AssignmentSerializer,
    SubmissionSerializer,
    SubmissionCreateSerializer,
    QuestionSerializer,
    MCQChoiceSerializer,
    QuizSerializer,
    QuizWriteSerializer,
    AnswerCreateSerializer,
    QuizAttemptSerializer,
    AssignmentGradeSerializer,
    QuestionsWriteSerializer, AnswersWriteSerializer, ShortGradesSerializer,
)


class PrivateAssessmentResponse:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        patch_cache_control(response, private=True, no_store=True)
        return response


class IsInstructorOrAdmin:
    """Permission: instructor of the course, or any admin."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and (user.is_instructor or user.is_admin)
        )

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_admin:
            return True
        # Instructor must own the course
        if hasattr(obj, "course"):
            return obj.course.instructor_id == user.id
        return False


class IsStudent(IsAuthenticated):
    """Permission: authenticated student only."""

    def has_permission(self, request, view):
        return bool(
            super().has_permission(request, view) and request.user.is_student
        )


class AssignmentViewSet(
    PrivateAssessmentResponse,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD for assignments; students see their submission status."""

    serializer_class = AssignmentSerializer
    permission_classes = [IsInstructorOrAdmin]
    filterset_fields = ["course"]
    search_fields = ["title"]

    def get_permissions(self):
        if self.action == "submit":
            return [IsStudent()]
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return [IsInstructorOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Assignment.objects.select_related("course", "instructor").all()
        if user.is_instructor:
            return Assignment.objects.filter(course__instructor=user)
        # Students: published assignments of courses they're enrolled in
        return Assignment.objects.filter(
            is_published=True,
            course__enrollments__student=user,
            course__enrollments__status__in=(
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
            ),
        ).distinct()

    def perform_create(self, serializer):
        course = serializer.validated_data["course"]
        user = self.request.user
        if not user.is_admin and course.instructor_id != user.pk:
            raise PermissionDenied("You may only create assignments for your own courses.")
        # Admins author on behalf of the course tutor so gradebooks stay scoped.
        serializer.save(instructor=course.instructor if user.is_admin else user)

    @action(detail=True, methods=["post"], permission_classes=[IsInstructorOrAdmin])
    def publish(self, request, pk=None):
        assignment = self.get_object()
        if not assignment.is_published:
            assignment.is_published = True
            assignment.save(update_fields=["is_published", "updated_at"])
        return Response(self.get_serializer(assignment).data)

    @action(detail=True, methods=["post"], permission_classes=[IsInstructorOrAdmin])
    def unpublish(self, request, pk=None):
        assignment = self.get_object()
        if assignment.is_published:
            assignment.is_published = False
            assignment.save(update_fields=["is_published", "updated_at"])
        return Response(self.get_serializer(assignment).data)

    @transaction.atomic
    def perform_update(self, serializer):
        assignment = Assignment.objects.select_for_update().get(pk=serializer.instance.pk)
        course = serializer.validated_data.get("course", assignment.course)
        workflows.teaching_access(self.request.user, course)
        if assignment.submissions.exists():
            raise ValidationError("This assignment has submissions. Create a new assignment to preserve existing work.")
        serializer.instance = assignment
        serializer.save()

    @action(detail=True, methods=["get"])
    def submissions(self, request, pk=None):
        assignment = self.get_object()
        rows = assignment.submissions.select_related("student", "assignment").order_by("-submitted_at", "-pk")
        page = self.paginate_queryset(rows)
        return self.get_paginated_response(SubmissionSerializer(page, many=True).data)

    @action(detail=False, methods=["post"])
    def submit(self, request, pk=None):
        """POST /assignments/submit/ {assignment_id, file?, text_answer?}"""
        serializer = SubmissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = services.submission_create(
            student=request.user,
            assignment=serializer.validated_data["assignment"],
            file=serializer.validated_data.get("file"),
            text_answer=serializer.validated_data.get("text_answer"),
        )
        return Response(SubmissionSerializer(submission).data)

    @action(detail=True, methods=["post"])
    def grade(self, request, pk=None):
        """POST /assignments/{id}/grade/ {score, feedback, marked_late}"""
        assignment = self.get_object()
        serializer = AssignmentGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = services.submission_grade(
            submission=get_object_or_404(Submission, id=serializer.validated_data["submission_id"], assignment=assignment),
            grader=request.user,
            score=serializer.validated_data["score"],
            feedback=serializer.validated_data.get("feedback", ""),
            marked_late=serializer.validated_data.get("marked_late", False),
        )
        return Response(SubmissionSerializer(submission).data)


class SubmissionViewSet(
    PrivateAssessmentResponse,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Enrollment submit / view their assignment submissions."""

    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["assignment", "status"]

    def get_permissions(self):
        return [IsStudent()] if self.action in {"create", "submit"} else [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        rows = Submission.objects.select_related("assignment__course", "student")
        if user.is_admin:
            return rows
        if user.is_instructor:
            return rows.filter(assignment__course__instructor=user)
        return rows.filter(student=user, assignment__course__enrollments__student=user,
                           assignment__course__enrollments__status__in=("active", "completed")).distinct()

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        submission = self.get_object()
        if not submission.file:
            from rest_framework.exceptions import NotFound
            raise NotFound("No attachment was submitted.")
        try:
            response = FileResponse(submission.file.open("rb"), as_attachment=True,
                                    filename=submission.file.name.rsplit("/", 1)[-1], content_type="application/octet-stream")
        except FileNotFoundError:
            from rest_framework.exceptions import NotFound
            raise NotFound("The attachment is unavailable. Contact the academy.")
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @action(detail=False, methods=["post"])
    def submit(self, request):
        """POST /assignments/submit/ {assignment_id, file?, text_answer?}"""
        serializer = SubmissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = services.submission_create(
            student=request.user,
            assignment=serializer.validated_data["assignment"],
            file=serializer.validated_data.get("file"),
            text_answer=serializer.validated_data.get("text_answer"),
        )
        return Response(SubmissionSerializer(submission).data)

    def create(self, request):
        return self.submit(request)

    @action(detail=True, methods=["get"])
    def status(self, request, pk=None):
        """GET /assignments/{id}/status/ — my submission status"""
        submission = self.get_queryset().filter(student=request.user, assignment_id=pk).first()
        if submission is None:
            return Response(
                {"detail": "No submission found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(SubmissionSerializer(submission).data)


class QuizViewSet(
    PrivateAssessmentResponse,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD for quizzes; students can take published quizzes."""

    serializer_class = QuizSerializer
    permission_classes = [IsInstructorOrAdmin]
    queryset = Quiz.objects.all()
    filterset_fields = ["course", "status"]
    search_fields = ["title"]

    def get_permissions(self):
        if self.action in {"start", "submit", "save_answers", "finish_expired"}:
            return [IsStudent()]
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return [IsInstructorOrAdmin()]

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return QuizWriteSerializer
        return QuizSerializer

    def perform_create(self, serializer):
        course = serializer.validated_data["course"]
        if not self.request.user.is_admin and course.instructor_id != self.request.user.pk:
            raise PermissionDenied("You may only create quizzes for your own courses.")
        if serializer.validated_data.get("status", "draft") != "draft":
            raise ValidationError("Create a draft, add its questions, then publish it.")
        serializer.save(instructor=self.request.user)

    @transaction.atomic
    def perform_update(self, serializer):
        quiz = Quiz.objects.select_for_update().get(pk=serializer.instance.pk)
        if quiz.attempts.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("This quiz has attempts and cannot be edited. Create a new quiz.")
        course = serializer.validated_data.get("course", serializer.instance.course)
        if not self.request.user.is_admin and course.instructor_id != self.request.user.pk:
            raise PermissionDenied("You may only use your own courses.")
        if serializer.validated_data.get("status") == Quiz.Status.PUBLISHED:
            workflows.ensure_publishable(quiz)
        serializer.instance = quiz
        serializer.save()

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Quiz.objects.all()
        if user.is_instructor:
            return Quiz.objects.filter(course__instructor=user)
        # Students: quizzes of courses they're enrolled in
        return Quiz.objects.filter(
            status=Quiz.Status.PUBLISHED,
            course__enrollments__student=user,
            course__enrollments__status__in=(
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
            ),
        ).distinct()

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def question(self, request, pk=None):
        """POST /quizzes/{pk}/questions/ — add a question to a quiz."""
        quiz = Quiz.objects.select_for_update().get(pk=self.get_object().pk)
        if quiz.status != Quiz.Status.DRAFT or quiz.attempts.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Questions may only be added to an unused draft quiz.")
        serializer = QuestionSerializer(data=request.data, context={"quiz_id": quiz.id, "request": request})
        serializer.is_valid(raise_exception=True)
        if quiz.questions.filter(order=serializer.validated_data.get("order", 0)).exists():
            raise ValidationError("That question order is already used. Choose a different order.")
        question = serializer.save()
        question.quiz = quiz
        question.save()
        return Response(QuestionSerializer(question, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["put"])
    def builder(self, request, pk=None):
        serializer = QuestionsWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quiz = workflows.replace_questions(self.get_object(), request.user, serializer.validated_data["questions"])
        return Response(QuizSerializer(quiz, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """Start/resume the one permitted attempt; never submit implicitly."""
        quiz = self.get_object()
        attempt = services.attempt_create(student=request.user, quiz=quiz)
        return Response(QuizAttemptSerializer(attempt).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def submit(self, request, pk=None):
        quiz = self.get_object()
        attempt = get_object_or_404(QuizAttempt.objects.select_for_update(), student=request.user, quiz=quiz)
        if attempt.status != QuizAttempt.Status.IN_PROGRESS:
            return Response(QuizAttemptSerializer(attempt).data)
        serializer = AnswersWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.check_attempt_deadline(attempt)
        workflows.save_answers(attempt, serializer.validated_data["answers"])
        services.attempt_submit(attempt=attempt)
        services.attempt_grade(attempt=attempt, auto_grade=True)
        return Response(QuizAttemptSerializer(attempt).data)

    @action(detail=True, methods=["put"], url_path="save-answers")
    @transaction.atomic
    def save_answers(self, request, pk=None):
        quiz = self.get_object()
        attempt = get_object_or_404(QuizAttempt.objects.select_for_update(), student=request.user, quiz=quiz)
        if attempt.status != QuizAttempt.Status.IN_PROGRESS:
            raise ValidationError("This attempt has already been submitted.")
        services.check_attempt_deadline(attempt)
        serializer = AnswersWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workflows.save_answers(attempt, serializer.validated_data["answers"])
        return Response(QuizAttemptSerializer(attempt).data)

    @action(detail=True, methods=["post"], url_path="finish-expired")
    @transaction.atomic
    def finish_expired(self, request, pk=None):
        from django.utils import timezone
        quiz = self.get_object()
        attempt = get_object_or_404(QuizAttempt.objects.select_for_update(), student=request.user, quiz=quiz)
        if attempt.status == QuizAttempt.Status.IN_PROGRESS:
            if (timezone.now() - attempt.started_at).total_seconds() <= quiz.time_limit_minutes * 60:
                raise ValidationError("This attempt still has time remaining. Use Submit answers.")
            services.attempt_submit(attempt=attempt)
            workflows.calculate_grade(attempt)
        return Response(QuizAttemptSerializer(attempt).data)


class QuizAttemptViewSet(
    PrivateAssessmentResponse,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """View a student's quiz attempt results."""

    serializer_class = QuizAttemptSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["quiz", "status"]

    def get_queryset(self):
        user = self.request.user
        rows = QuizAttempt.objects.select_related("quiz__course", "student")
        if user.is_admin:
            return rows
        if user.is_instructor:
            return rows.filter(quiz__course__instructor=user)
        return rows.filter(student=user, quiz__course__enrollments__student=user,
                           quiz__course__enrollments__status__in=("active", "completed")).distinct()

    @action(detail=True, methods=["post"])
    def grade(self, request, pk=None):
        serializer = ShortGradesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attempt = workflows.mark_short_answers(self.get_object(), request.user, serializer.validated_data["grades"])
        return Response(self.get_serializer(attempt).data)


class MCQChoiceListView(ListAPIView):
    """GET /questions/{question_id}/choices/ — list choices for a question (MCQ only)."""

    serializer_class = MCQChoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from apps.assignments.models import Question
        user = self.request.user
        questions = Question.objects.all()
        if user.is_instructor:
            questions = questions.filter(quiz__course__instructor=user)
        elif not user.is_admin:
            questions = questions.filter(
                quiz__status=Quiz.Status.PUBLISHED, quiz__course__enrollments__student=user,
                quiz__course__enrollments__status__in=[Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED],
            )
        return get_object_or_404(questions, id=self.kwargs["question_id"]).choices.all()
