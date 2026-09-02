"""Enrollment links a Student to a Course and tracks completion."""
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel

HUNDRED = Decimal("100.00")
CENTS = Decimal("0.01")


class Enrollment(TimeStampedModel):
    """A student's participation in one course, with a progress percentage."""

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        COMPLETED = "completed", _("Completed")
        SUSPENDED = "suspended", _("Suspended")

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    progress_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00")
    )
    enrolled_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # One enrollment per student per course.
            models.UniqueConstraint(
                fields=["student", "course"],
                name="uq_enrollment_student_course",
            )
        ]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["course", "status"]),
        ]

    def __str__(self):
        return f"{self.student} -> {self.course} ({self.progress_percent}%)"

    def recalculate_progress(self, *, save=True) -> Decimal:
        """Recompute completion % from LessonProgress rows.

        Progress is always *derived* from stored completions, never trusted
        from the client. Call this after marking a lesson complete.
        """
        total = self.course.total_lessons
        if total == 0:
            self.progress_percent = Decimal("0.00")
        else:
            done = self.lesson_progress.filter(completed=True).count()
            ratio = (Decimal(done) / Decimal(total)) * HUNDRED
            self.progress_percent = ratio.quantize(CENTS)

        # Auto-complete once the whole course is finished.
        finished = self.progress_percent >= HUNDRED
        if finished and self.status == self.Status.ACTIVE:
            self.status = self.Status.COMPLETED
            self.completed_at = timezone.now()

        if save:
            self.save(
                update_fields=[
                    "progress_percent",
                    "status",
                    "completed_at",
                    "updated_at",
                ]
            )
        return self.progress_percent


class LessonProgress(TimeStampedModel):
    """Per-lesson completion flag underpinning enrollment progress."""

    enrollment = models.ForeignKey(
        "enrollment.Enrollment",
        on_delete=models.CASCADE,
        related_name="lesson_progress",
    )
    lesson = models.ForeignKey(
        "courses.Lesson",
        on_delete=models.CASCADE,
        related_name="progress_records",
    )
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment", "lesson"], name="uq_lessonprogress"
            )
        ]
        indexes = [models.Index(fields=["enrollment", "completed"])]

    def __str__(self):
        state = "done" if self.completed else "pending"
        return f"{self.enrollment_id}:{self.lesson_id} [{state}]"
