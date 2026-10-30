"""Serializers for assignments and quizzes."""
from rest_framework import serializers
from datetime import timedelta
from decimal import Decimal

from apps.assignments.models import (
    Assignment,
    Submission,
    Quiz,
    Question,
    MCQChoice,
    Answer,
    QuizAttempt,
)
from apps.courses.models import Course
from apps.enrollment.models import Enrollment


class SubmissionSerializer(serializers.ModelSerializer):
    """Read/write shape for an assignment submission."""

    student_name = serializers.CharField(source="student.full_name", read_only=True)
    assignment_title = serializers.CharField(
        source="assignment.title", read_only=True
    )
    file = serializers.SerializerMethodField()

    def get_file(self, obj):
        # Never expose public media/storage URLs for learner work.
        return f"/api/v1/submissions/{obj.pk}/download/" if obj.file else None

    class Meta:
        model = Submission
        fields = (
            "id",
            "student",
            "student_name",
            "assignment",
            "assignment_title",
            "file",
            "text_answer",
            "status",
            "score",
            "feedback",
            "is_late",
            "submitted_at",
        )
        read_only_fields = ("student", "assignment", "status", "submitted_at", "score", "feedback", "is_late")


class SubmissionCreateSerializer(serializers.Serializer):
    assignment = serializers.PrimaryKeyRelatedField(queryset=Assignment.objects.all())
    file = serializers.FileField(required=False)
    text_answer = serializers.CharField(required=False, allow_blank=True, max_length=50000)

    def validate(self, attrs):
        if not attrs.get("file") and not attrs.get("text_answer", "").strip():
            raise serializers.ValidationError("Provide a text answer or upload your assignment.")
        upload = attrs.get("file")
        if upload:
            from .storage import validate_assignment_file
            validate_assignment_file(upload)
        return attrs


class AssignmentSerializer(serializers.ModelSerializer):
    """Read shape for an assignment with submission status for a student."""

    instructor_name = serializers.CharField(
        source="instructor.full_name", read_only=True
    )
    course_title = serializers.CharField(source="course.title", read_only=True)
    # Track whether the enrolled student has submitted
    has_submitted = serializers.BooleanField(default=False, read_only=True)
    my_submission_score = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True, default=None
    )
    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all()
    )
    max_score = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("0.01"), required=False)
    description = serializers.CharField(max_length=50000, allow_blank=True, required=False)

    class Meta:
        model = Assignment
        fields = (
            "id",
            "title",
            "description",
            "due_at",
            "max_score",
            "status",
            "instructor_name",
            "course_title",
            "has_submitted",
            "my_submission_score",
            "allow_late_submission",
            "is_published",
            "course",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = self.context["request"].user
        # Check if user is enrolled and has submitted
        if user.is_authenticated and user.is_student:
            submission = Submission.objects.filter(student=user, assignment=instance).first()
            if submission:
                data["has_submitted"] = True
                data["my_submission_score"] = submission.score
                data["my_submission_status"] = submission.status
        return data


class QuestionSerializer(serializers.ModelSerializer):
    """Read shape for a quiz question with choices (MCQ only)."""

    choices = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = (
            "id",
            "question_text",
            "question_type",
            "order",
            "choices",
        )

    def create(self, validated_data):
        quiz_id = self.context.get("quiz_id")
        if quiz_id:
            from apps.assignments.models import Quiz
            quiz = Quiz.objects.get(id=quiz_id)
            validated_data["quiz"] = quiz
        return super().create(validated_data)

    def get_choices(self, obj):
        # Only return choices for MCQ; for other types return empty list
        if obj.question_type in (Question.Type.MCQ, Question.Type.TRUE_FALSE):
            from apps.assignments.serializers import MCQChoiceSerializer
            return MCQChoiceSerializer(
                obj.choices.all(), many=True, read_only=True, context=self.context,
            ).data
        return []


class MCQChoiceSerializer(serializers.ModelSerializer):
    """Serializer for MCQ choices."""

    class Meta:
        model = MCQChoice
        fields = ("id", "choice_text", "is_correct", "order")
        read_only_fields = ("is_correct",)  # instructor sets correct answers

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = getattr(self.context.get("request"), "user", None)
        if not user or not (user.is_admin or (user.is_instructor and instance.question.quiz.course.instructor_id == user.pk)):
            data.pop("is_correct", None)
        return data


class QuizSerializer(serializers.ModelSerializer):
    """Read shape for a quiz with nested questions."""

    instructor_name = serializers.CharField(
        source="instructor.full_name", read_only=True
    )
    course_title = serializers.CharField(source="course.title", read_only=True)
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = (
            "id",
            "course",
            "title",
            "description",
            "pass_mark",
            "status",
            "instructor_name",
            "course_title",
            "time_limit_minutes",
            "questions",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = self.context["request"].user
        if user.is_authenticated and user.is_student:
            attempt = QuizAttempt.objects.filter(student=user, quiz=instance).first()
            data["can_attempt"] = attempt is None or attempt.status == QuizAttempt.Status.IN_PROGRESS
            data["my_attempt"] = QuizAttemptSerializer(attempt).data if attempt else None
        else:
            data["can_attempt"] = False
        return data


class QuizWriteSerializer(serializers.ModelSerializer):
    """Write shape for creating a quiz (instructor only)."""

    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    description = serializers.CharField(max_length=50000, allow_blank=True, required=False)
    pass_mark = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100, required=False)
    time_limit_minutes = serializers.IntegerField(min_value=1, max_value=1440, required=False)

    class Meta:
        model = Quiz
        fields = (
            "id",
            "title",
            "description",
            "pass_mark",
            "status",
            "time_limit_minutes",
            "course",
        )


class AnswerCreateSerializer(serializers.Serializer):
    """Write shape: student submits answers for a question."""

    question_id = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
    # For MCQ/True-False: choice_id
    # For Short Answer: short_text
    choice_id = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=9223372036854775807)
    short_text = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class QuizAttemptSerializer(serializers.ModelSerializer):
    """Read shape for a quiz attempt with question scores."""

    student_name = serializers.CharField(
        source="student.full_name", read_only=True
    )
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)
    answers = serializers.SerializerMethodField()
    deadline = serializers.SerializerMethodField()

    def get_deadline(self, obj):
        return obj.started_at + timedelta(minutes=obj.quiz.time_limit_minutes)

    def get_answers(self, obj):
        # Only a scoped attempt endpoint supplies this serializer; never keys.
        rows = Answer.objects.filter(student=obj.student, question__quiz=obj.quiz)
        return [{"question_id": a.question_id, "choice_id": a.choice_id, "short_text": a.short_text or "",
                 "score_earned": a.score_earned if obj.status == QuizAttempt.Status.GRADED else None} for a in rows]

    class Meta:
        model = QuizAttempt
        fields = (
            "id",
            "student",
            "student_name",
            "quiz",
            "quiz_title",
            "status",
            "started_at",
            "completed_at",
            "time_spent_seconds",
            "total_score",
            "passed",
            "answers",
            "deadline",
        )
        read_only_fields = fields


class AssignmentGradeSerializer(serializers.Serializer):
    """Write shape: grade a submission."""

    submission_id = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
    score = serializers.DecimalField(max_digits=5, decimal_places=2)
    feedback = serializers.CharField(required=False, allow_blank=True, max_length=10000)
    marked_late = serializers.BooleanField(default=False)


class ChoiceWriteSerializer(serializers.Serializer):
    choice_text = serializers.CharField(max_length=500)
    is_correct = serializers.ChoiceField(choices=MCQChoice.CorrectChoice.choices)


class QuestionWriteSerializer(serializers.Serializer):
    question_text = serializers.CharField(max_length=10000)
    question_type = serializers.ChoiceField(choices=Question.Type.choices)
    choices = ChoiceWriteSerializer(many=True, max_length=8)


class QuestionsWriteSerializer(serializers.Serializer):
    questions = QuestionWriteSerializer(many=True, allow_empty=False, max_length=100)


class AnswersWriteSerializer(serializers.Serializer):
    answers = AnswerCreateSerializer(many=True, max_length=100)


class ShortGradeSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
    score = serializers.DecimalField(max_digits=3, decimal_places=2, min_value=0, max_value=1)


class ShortGradesSerializer(serializers.Serializer):
    grades = ShortGradeSerializer(many=True, allow_empty=False, max_length=100)
