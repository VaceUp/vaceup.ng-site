"""Applications for course admission (student applies, admin/instructor approves)."""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.courses.models import Course


class Application(TimeStampedModel):
    """A student's application to enroll in a course."""

    class Status(models.TextChoices):
        SUBMITTED = "submitted", _("Submitted")
        UNDER_REVIEW = "under_review", _("Under Review")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")
        WITHDRAWN = "withdrawn", _("Withdrawn")

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_applications",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
        db_index=True,
    )
    motivation = models.TextField(blank=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    country = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    education = models.CharField(max_length=200, blank=True)
    current_role = models.CharField(max_length=200, blank=True)
    experience = models.CharField(max_length=80, blank=True)
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    goals = models.TextField(blank=True)
    heard_from = models.CharField(max_length=200, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_applications",
        limit_choices_to={"role__in": ["admin", "instructor"]},
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["student", "course"], name="uq_student_course_application"
            )
        ]
        indexes = [
            models.Index(fields=["course", "status"]),
            models.Index(fields=["student", "status"]),
        ]

    def __str__(self):
        return f"{self.student} -> {self.course} ({self.status})"