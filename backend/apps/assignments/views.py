"""Assignment and quiz endpoints."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.assignments import services
from apps.assignments.models import Assignment, Submission, Quiz, QuizAttempt
from apps.assignments import services
from apps.assignments.serializers import (
    AssignmentSerializer,
    SubmissionSerializer,
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
        serializer.save(instructor=self.request.user)

    @action(detail=False, methods=["post"])
    def submit(self, request, pk=None):
        """POST /assignments/submit/ {assignment_id, file?, text_answer?}"""
        assignment_id = request.data.get("assignment")
        assignment = Assignment.objects.get(id=assignment_id)
        serializer = SubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = services.submission_create(
            student=request.user,
            assignment=assignment,
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
            submission=Submission.objects.get(id=serializer.validated_data["submission_id"]),
            score=serializer.validated_data["score"],
            feedback=serializer.validated_data.get("feedback", ""),
            marked_late=serializer.validated_data.get("marked_late", False),
        )
        return Response(SubmissionSerializer(submission).data)


class SubmissionViewSet(
    mixins.CreateModelMixin,
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
        serializer = SubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = services.submission_create(
            student=request.user,
            assignment=serializer.validated_data["assignment"],
            file=serializer.validated_data.get("file"),
            text_answer=serializer.validated_data.get("text_answer"),
        )
        return Response(SubmissionSerializer(submission).data)

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
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD for quizzes; students can take published quizzes."""

    serializer_class = QuizSerializer
    permission_classes = [IsInstructorOrAdmin]
    queryset = Quiz.objects.all()

    def get_serializer_class(self):
        if self.action == "create":
            return QuizWriteSerializer
        return QuizSerializer

    def perform_create(self, serializer):
        serializer.save(instructor=self.request.user)

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Quiz.objects.all()
        if user.is_instructor:
            return Quiz.objects.filter(course__instructor=user)
        # Students: quizzes of courses they're enrolled in
        return Quiz.objects.filter(
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
        serializer = QuestionSerializer(data=request.data, context={"quiz_id": quiz.id})
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        question.quiz = quiz
        question.save()
        return Response(QuestionSerializer(question).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """POST /quizzes/{id}/submit/ {answers}"""
        quiz = self.get_object()
        attempt = QuizAttempt.objects.get(
            student=request.user, quiz=quiz, status=QuizAttempt.Status.IN_PROGRESS
        )
        answers_data = request.data.get("answers", [])
        for ad in answers_data:
            question = quiz.questions.get(id=ad["question_id"])
            services.answer_submit(
                student=request.user,
                question=question,
                choice_id=ad.get("choice_id"),
                short_text=ad.get("short_text"),
            )
        # Mark attempt submitted (e.g., time limit check)
        services.attempt_submit(attempt=attempt, time_spent_seconds=0)
        # Grade the attempt
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
        return Question.objects.get(id=self.kwargs["question_id"]).choices.all()