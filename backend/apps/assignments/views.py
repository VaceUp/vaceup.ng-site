"""Assignment and quiz endpoints."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db import transaction
from apps.enrollment.models import Enrollment

from apps.assignments import services
from apps.assignments.models import Assignment, Submission, Quiz, QuizAttempt
from apps.assignments import services
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
)


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
        if hasattr(obj, "instructor"):
            return obj.instructor_id == user.id
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
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD for assignments; students see their submission status."""

    serializer_class = AssignmentSerializer
    permission_classes = [IsInstructorOrAdmin]

    def get_permissions(self):
        if self.action == "submit":
            return [IsStudent()]
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return [IsInstructorOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Assignment.objects.all()
        if user.is_instructor:
            return Assignment.objects.filter(course__instructor=user)
        # Students: assignments of courses they're enrolled in
        return Assignment.objects.filter(
            course__enrollments__student=user,
            course__enrollments__status__in=(
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
            ),
        ).distinct()

    def perform_create(self, serializer):
        course = serializer.validated_data["course"]
        if not self.request.user.is_admin and course.instructor_id != self.request.user.pk:
            raise PermissionDenied("You may only create assignments for your own courses.")
        serializer.save(instructor=self.request.user)

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
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Enrollment submit / view their assignment submissions."""

    serializer_class = SubmissionSerializer
    permission_classes = [IsStudent]

    def get_queryset(self):
        return Submission.objects.filter(
            student=self.request.user
        ).select_related("assignment", "assignment__course")

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
        submission = Submission.objects.filter(
            student=request.user, assignment_id=pk
        ).first()
        if submission is None:
            return Response(
                {"detail": "No submission found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(SubmissionSerializer(submission).data)


class QuizViewSet(
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

    def get_permissions(self):
        if self.action in {"start", "submit"}:
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
        serializer.save(instructor=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.attempts.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("This quiz has attempts and cannot be edited. Create a new quiz.")
        course = serializer.validated_data.get("course", serializer.instance.course)
        if not self.request.user.is_admin and course.instructor_id != self.request.user.pk:
            raise PermissionDenied("You may only use your own courses.")
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
    def question(self, request, pk=None):
        """POST /quizzes/{pk}/questions/ — add a question to a quiz."""
        quiz = self.get_object()
        if quiz.status != Quiz.Status.DRAFT or quiz.attempts.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Questions may only be added to an unused draft quiz.")
        serializer = QuestionSerializer(data=request.data, context={"quiz_id": quiz.id, "request": request})
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        question.quiz = quiz
        question.save()
        return Response(QuestionSerializer(question, context={"request": request}).data, status=status.HTTP_201_CREATED)

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
        serializer = AnswerCreateSerializer(data=request.data.get("answers", []), many=True)
        serializer.is_valid(raise_exception=True)
        services.check_attempt_deadline(attempt)
        seen = set()
        for answer in serializer.validated_data:
            question = get_object_or_404(quiz.questions, id=answer["question_id"])
            if question.pk in seen:
                from rest_framework.exceptions import ValidationError
                raise ValidationError("Submit each question only once.")
            seen.add(question.pk)
            services.answer_submit(student=request.user, question=question,
                                   choice_id=answer.get("choice_id"), short_text=answer.get("short_text"))
        services.attempt_submit(attempt=attempt)
        services.attempt_grade(attempt=attempt, auto_grade=True)
        return Response(QuizAttemptSerializer(attempt).data)


class QuizAttemptViewSet(
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """View a student's quiz attempt results."""

    serializer_class = QuizAttemptSerializer
    permission_classes = [IsStudent]

    def get_queryset(self):
        return QuizAttempt.objects.filter(
            student=self.request.user
        ).select_related("quiz", "quiz__course")


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
