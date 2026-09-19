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
    body = models.TextField(max_length=5000)
    # NULL keeps pre-idempotency history intact; API sends require a UUID.
    client_message_id = models.UUIDField(null=True, blank=True, editable=False)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=["sender", "client_message_id"],
                name="uq_message_sender_client_id",
            ),
        ]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["sender", "recipient"]),
            models.Index(fields=["recipient", "sender"]),
            models.Index(fields=["sender", "recipient", "id"], name="msg_thread_id_idx"),
            models.Index(fields=["sender", "created_at"], name="msg_sender_time_idx"),
            models.Index(fields=["recipient", "sender", "is_read", "id"], name="msg_unread_thread_idx"),
        ]

    def __str__(self):
        return f"Message {self.pk}: {self.sender_id}->{self.recipient_id}"


class MessageBlock(TimeStampedModel):
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="message_blocks_created",
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="message_blocks_received",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="uq_message_block"),
            models.CheckConstraint(check=~models.Q(blocker=models.F("blocked")), name="message_block_not_self"),
        ]

    def __str__(self):
        return f"Block {self.pk}: {self.blocker_id}->{self.blocked_id}"


class MessageReport(TimeStampedModel):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="message_reports",
    )
    reason = models.TextField(max_length=1000)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["message", "reporter"], name="uq_message_report"),
        ]

    def __str__(self):
        return f"Report {self.pk}: message {self.message_id}, reporter {self.reporter_id}"


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
