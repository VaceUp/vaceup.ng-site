"""Direct messages between users (student <-> their instructor, or admin).

A flat message log keyed on (sender, recipient); "threads" are derived by
grouping on the counterpart. Real-time delivery (WebSockets/Channels) is a
future enhancement — for now clients poll the unread-count endpoint.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Message(TimeStampedModel):
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="sent_messages",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="received_messages",
    )
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["sender", "recipient"]),
            models.Index(fields=["recipient", "sender"]),
        ]

    def __str__(self):
        return f"{self.sender_id}->{self.recipient_id}: {self.body[:30]}"


class Notification(TimeStampedModel):
    """In-app notification feed for system events (grade posted, class scheduled, etc.)."""

    class Type(models.TextChoices):
        GRADE_POSTED = "grade_posted", _("Grade Posted")
        CLASS_SCHEDULED = "class_scheduled", _("Class Scheduled")
        PAYMENT_CONFIRMED = "payment_confirmed", _("Payment Confirmed")
        COURSE_PUBLISHED = "course_published", _("Course Published")
        ASSIGNMENT_SUBMITTED = "assignment_submitted", _("Assignment Submitted")
        QUIZ_COMPLETED = "quiz_completed", _("Quiz Completed")

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(
        max_length=30, choices=Type.choices, default=Type.GRADE_POSTED
    )
    title = models.CharField(max_length=200)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    content_type = models.ForeignKey(
        "contenttypes.ContentType", on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    # Generic relation to the related object (assignment, quiz, etc.)
    # Note: we'll use a simple FK approach instead of GenericForeignKey for simplicity

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.recipient_id} [{self.type}]: {self.title}"
