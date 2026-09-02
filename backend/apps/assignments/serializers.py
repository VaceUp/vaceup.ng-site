"""Serializers for assignments and quizzes."""
from rest_framework import serializers

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
        read_only_fields = ("student", "assignment", "status", "submitted_at")


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
        queryset=Course.objects.all(), write_only=True
    )

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
            "course",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = self.context["request"].user
        # Check if user is enrolled and has submitted
        if user.is_authenticated and user.is_student:
            try:
                enrollment = Enrollment.objects.get(
                    student=user, course=instance.course
                )
                submission = Submission.objects.filter(
                    student=user, assignment=instance
                ).first()
                if submission:
                    data["has_submitted"] = True
                    data["my_submission_score"] = submission.score
                    data["my_submission_status"] = submission.status
            except Exception:
                pass
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
        if obj.question_type == Question.Type.MCQ:
            from apps.assignments.serializers import MCQChoiceSerializer
            return MCQChoiceSerializer(
                obj.choices.all(), many=True, read_only=True
            ).data
        return []


class MCQChoiceSerializer(serializers.ModelSerializer):
    """Serializer for MCQ choices."""

    class Meta:
        model = MCQChoice
        fields = ("id", "choice_text", "is_correct", "order")
        read_only_fields = ("is_correct",)  # instructor sets correct answers


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
            data["can_attempt"] = not QuizAttempt.objects.filter(
                student=user, quiz=instance
            ).exists()
        else:
            data["can_attempt"] = False
        return data


class QuizWriteSerializer(serializers.ModelSerializer):
    """Write shape for creating a quiz (instructor only)."""

    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())

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

    question_id = serializers.IntegerField()
    # For MCQ/True-False: choice_id
    # For Short Answer: short_text
    choice_id = serializers.IntegerField(required=False)
    short_text = serializers.CharField(max_length=1000, required=False)


class QuizAttemptSerializer(serializers.ModelSerializer):
    """Read shape for a quiz attempt with question scores."""

    student_name = serializers.CharField(
        source="student.full_name", read_only=True
    )
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)

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
        )
        read_only_fields = fields


class AssignmentGradeSerializer(serializers.Serializer):
    """Write shape: grade a submission."""

    submission_id = serializers.IntegerField()
    score = serializers.DecimalField(max_digits=5, decimal_places=2)
    feedback = serializers.CharField(required=False, allow_blank=True)
    marked_late = serializers.BooleanField(default=False)