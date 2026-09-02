"""Payment records for course purchases via Paystack.

One ``Payment`` row per checkout attempt. The ``reference`` is the idempotency
key shared with Paystack — verification and webhooks are keyed on it, so the
same event processed twice never double-enrols or double-counts.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


def generate_reference() -> str:
    """Unguessable, unique payment reference (sent to Paystack)."""
    return f"vaceup_{uuid.uuid4().hex}"


class Payment(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        SUCCESS = "success", _("Success")
        FAILED = "failed", _("Failed")
        ABANDONED = "abandoned", _("Abandoned")

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payments",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(
        "courses.Course", on_delete=models.CASCADE, related_name="payments"
    )
    reference = models.CharField(
        max_length=64, unique=True, default=generate_reference, editable=False
    )
    # Amount snapshotted at initialization — the price the student agreed to,
    # immune to later course-price edits. Stored in the major unit (Naira).
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="NGN")
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.PENDING, db_index=True,
    )
    authorization_url = models.URLField(max_length=500, blank=True)
    access_code = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    # Raw gateway verify payload, kept for audit/reconciliation.
    gateway_response = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["course", "status"]),
        ]

    def __str__(self):
        return f"{self.reference} ({self.status})"

    def mark_success(self, gateway_response=None):
        self.status = self.Status.SUCCESS
        self.paid_at = timezone.now()
        if gateway_response is not None:
            self.gateway_response = gateway_response
        self.save(update_fields=["status", "paid_at", "gateway_response",
                                 "updated_at"])

    def mark_failed(self, status=Status.FAILED, gateway_response=None):
        self.status = status
        if gateway_response is not None:
            self.gateway_response = gateway_response
        self.save(update_fields=["status", "gateway_response", "updated_at"])
