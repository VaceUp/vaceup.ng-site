"""Kids Academy records kept separate from the adult learner lifecycle.

The shared Django user table is only the infrastructure identity. Kids
parents, learners, admissions, stage progress and completion records live in
this app and are reached through the Kids API namespace.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class KidsParentProfile(TimeStampedModel):
    class ConsentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REVOKED = "revoked", "Revoked"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="kids_parent_profile",
    )
    phone = models.CharField(max_length=40, blank=True)
    relationship = models.CharField(max_length=80, blank=True)
    consent_status = models.CharField(
        max_length=16, choices=ConsentStatus.choices, default=ConsentStatus.PENDING,
    )
    consented_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Kids parent: {self.user.full_name or self.user.email}"


class KidsLearner(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_HOLD = "on_hold", "On hold"
        COMPLETED = "completed", "Completed"
        WITHDRAWN = "withdrawn", "Withdrawn"

    parent = models.ForeignKey(
        KidsParentProfile,
        on_delete=models.CASCADE,
        related_name="learners",
    )
    full_name = models.CharField(max_length=150)
    preferred_name = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("full_name", "pk")
        indexes = [models.Index(fields=("parent", "status"))]

    def __str__(self):
        return f"{self.full_name} ({self.parent_id})"


class KidsSession(TimeStampedModel):
    """Opaque Kids-only session token; adult JWTs never authenticate it."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="kids_sessions",
    )
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField(db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=("user", "expires_at"))]

    @classmethod
    def issue(cls, user):
        raw = f"kids_{secrets.token_urlsafe(48)}"
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        session = cls.objects.create(
            user=user,
            token_hash=digest,
            expires_at=timezone.now() + timedelta(hours=settings.KIDS_SESSION_TTL_HOURS),
        )
        return session, raw

    @classmethod
    def hash_token(cls, raw):
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @property
    def is_valid(self):
        return self.revoked_at is None and timezone.now() < self.expires_at

    def revoke(self):
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=("revoked_at", "updated_at"))


class KidsAdmission(TimeStampedModel):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        REVIEW = "review", "Under review"
        APPROVED = "approved", "Approved"
        DECLINED = "declined", "Declined"
        WITHDRAWN = "withdrawn", "Withdrawn"

    class PaymentPreference(models.TextChoices):
        PAY_NOW = "pay_now", "Pay now"
        PAY_LATER = "pay_later", "Pay later"

    parent = models.ForeignKey(
        KidsParentProfile,
        on_delete=models.CASCADE,
        related_name="admissions",
    )
    learner = models.ForeignKey(KidsLearner, on_delete=models.CASCADE, related_name="admissions")
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="kids_admissions")
    intake = models.ForeignKey(
        "website.AcademyIntake",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="kids_admissions",
    )
    payment_preference = models.CharField(
        max_length=16, choices=PaymentPreference.choices, default=PaymentPreference.PAY_LATER,
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SUBMITTED, db_index=True)
    parent_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_kids_admissions",
    )

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("learner", "course", "intake"),
                name="uq_kids_admission_learner_course_intake",
            )
        ]
        indexes = [models.Index(fields=("parent", "status")), models.Index(fields=("course", "status"))]

    def __str__(self):
        return f"{self.learner.full_name} -> {self.course.title} ({self.status})"


class KidsEnrollment(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        PAUSED = "paused", "Paused"
        WITHDRAWN = "withdrawn", "Withdrawn"

    admission = models.OneToOneField(
        KidsAdmission,
        on_delete=models.PROTECT,
        related_name="enrollment",
    )
    parent = models.ForeignKey(KidsParentProfile, on_delete=models.PROTECT, related_name="enrollments")
    learner = models.ForeignKey(KidsLearner, on_delete=models.PROTECT, related_name="enrollments")
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="kids_enrollments")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    current_stage = models.PositiveSmallIntegerField(default=1)
    progress_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("parent", "status")), models.Index(fields=("learner", "status"))]

    def __str__(self):
        return f"{self.learner.full_name} -> {self.course.title} ({self.progress_percent}%)"


class KidsStageProgress(TimeStampedModel):
    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Not started"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETE = "complete", "Complete"

    enrollment = models.ForeignKey(KidsEnrollment, on_delete=models.CASCADE, related_name="stages")
    stage_number = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=160)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NOT_STARTED)
    progress_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tutor_feedback = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("stage_number",)
        constraints = [models.UniqueConstraint(fields=("enrollment", "stage_number"), name="uq_kids_stage_progress")]


class KidsClassSession(TimeStampedModel):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        LIVE = "live", "Live"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="kids_class_sessions")
    title = models.CharField(max_length=200)
    scheduled_start = models.DateTimeField(db_index=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="kids_class_sessions",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED)
    meeting_url = models.URLField(blank=True)
    recording_key = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("scheduled_start", "pk")
        indexes = [models.Index(fields=("course", "scheduled_start"))]


class KidsCertificate(TimeStampedModel):
    enrollment = models.OneToOneField(KidsEnrollment, on_delete=models.PROTECT, related_name="certificate")
    verification_code = models.CharField(max_length=80, unique=True)
    issued_at = models.DateTimeField(default=timezone.now)
    title = models.CharField(max_length=200)
    certificate_url = models.URLField(blank=True)

    def __str__(self):
        return f"{self.title} ({self.verification_code})"
