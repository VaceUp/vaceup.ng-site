"""Assignments and quizzes for student assessment."""
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.courses.models import Course


class Assignment(TimeStampedModel):
    """An assignment given by an instructor with a deadline and grading."""

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        IN_PROGRESS = "in_progress", _("In Progress")
        SUBMITTED = "submitted", _("Submitted")
        GRADED = "graded", _("Graded")
        LATE = "late", _("Late")

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assigned_assignments",
        limit_choices_to={"role": "instructor"},
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_at = models.DateTimeField()
    max_score = models.DecimalField(
        max_digits=5, decimal_places=2, default=100.00
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    allow_late_submission = models.BooleanField(default=True)

    class Meta:
        ordering = ("due_at",)
        indexes = [
            models.Index(fields=["course", "due_at"]),
            models.Index(fields=["status", "due_at"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.course.title})"


class Submission(TimeStampedModel):
    """A student's submission for an assignment."""

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        REVIEW = "review", _("Under Review")
        SUBMITTED = "submitted", _("Submitted")
        GRADED = "graded", _("Graded")
        LATE = "late", _("Late")

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assignment_submissions",
        limit_choices_to={"role": "student"},
    )
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    file = models.FileField(
        upload_to="assignment_submissions/",
        blank=True,
        null=True,
    )
    text_answer = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    feedback = models.TextField(blank=True)
    is_late = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-submitted_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["student", "assignment"], name="uq_student_assignment_submit"
            )
        ]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["assignment", "status"]),
        ]

    def __str__(self):
        return f"{self.student} -> {self.assignment} ({self.status})"


class Quiz(TimeStampedModel):
    """A quiz with questions (MCQ, true-false, short-answer) for a course."""

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        PUBLISHED = "published", _("Published")
        COMPLETED = "completed", _("Completed")

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="quizzes",
    )
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_quizzes",
        limit_choices_to={"role": "instructor"},
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    pass_mark = models.DecimalField(
        max_digits=5, decimal_places=2, default=50.00
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    time_limit_minutes = models.PositiveIntegerField(default=60)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["course", "status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.course.title})"


class Question(TimeStampedModel):
    """A single quiz question."""

    class Type(models.TextChoices):
        MCQ = "mcq", _("Multiple Choice")
        TRUE_FALSE = "true_false", _("True / False")
        SHORT_ANSWER = "short_answer", _("Short Answer")

    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    question_text = models.TextField()
    question_type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.MCQ
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=["quiz", "order"], name="uq_quiz_question_order"
            )
        ]

    def __str__(self):
        return f"Q{self.order}: {self.question_text[:40]}"


MCQChoiceChoice = (
        ("correct", _("Correct")),
        ("incorrect", _("Incorrect")),
    )


class MCQChoice(TimeStampedModel):
    """A multiple-choice option for a question."""

    class CorrectChoice(models.TextChoices):
        CORRECT = "correct", _("Correct")
        INCORRECT = "incorrect", _("Incorrect")

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="choices",
    )
    choice_text = models.CharField(max_length=500)
    is_correct = models.CharField(
        max_length=20,
        choices=CorrectChoice.choices,
        default=CorrectChoice.INCORRECT,
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=["question", "order"], name="uq_mcq_choice_order"
            )
        ]

    def __str__(self):
        return f"{self.choice_text[:50]}"


class Answer(TimeStampedModel):
    """A student's answer to a quiz question."""

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quiz_answers",
        limit_choices_to={"role": "student"},
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    # For MCQ/True-False: the chosen choice/text
    # For Short Answer: the student's text
    choice = models.ForeignKey(
        MCQChoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    short_text = models.TextField(blank=True, null=True)
    is_correct = models.BooleanField(default=None, null=True)
    score_earned = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["student", "question"], name="uq_student_question_answer"
            )
        ]

    def __str__(self):
        if self.question.question_type == Question.Type.SHORT_ANSWER:
            return f"{self.student} -> {self.question.id}: short_answer"
        choice_text = self.choice.choice_text if self.choice else "no choice"
        return f"{self.student} -> {self.question.id}: {choice_text}"


class QuizAttempt(TimeStampedModel):
    """A student's attempt at a quiz."""

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", _("In Progress")
        SUBMITTED = "submitted", _("Submitted")
        GRADED = "graded", _("Graded")

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quiz_attempts",
        limit_choices_to={"role": "student"},
    )
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name="attempts",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS,
        db_index=True,
    )
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_spent_seconds = models.PositiveIntegerField(null=True, blank=True)
    total_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    passed = models.BooleanField(default=False)

    class Meta:
        ordering = ("-started_at",)
        indexes = [
            models.Index(fields=["student", "quiz", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "quiz"], name="uq_student_quiz_attempt"
            )
        ]

    def __str__(self):
        return f"{self.student} -> {self.quiz} ({self.status})"