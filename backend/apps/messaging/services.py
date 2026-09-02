"""Messaging rules: who may message whom, sending, and read tracking.

Access policy (anti-spam / student safety):
  * Admins may message anyone; anyone may message an admin (support channel).
  * A student and an instructor may message each other ONLY if the student is
    enrolled in one of that instructor's courses.
  * student <-> student and instructor <-> instructor are NOT allowed.
"""
from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.core.exceptions import DomainError
from apps.enrollment.models import Enrollment
from apps.messaging.models import Message


class MessagingNotAllowed(DomainError):
    status_code = 403
    default_detail = "You are not allowed to message this user."
    default_code = "messaging_not_allowed"


def _instructor_teaches_student(instructor, student) -> bool:
    return Enrollment.objects.filter(
        student=student, course__instructor=instructor
    ).exists()


def can_message(sender, recipient) -> bool:
    if sender.id == recipient.id:
        return False
    if sender.is_admin or recipient.is_admin:
        return True
    if sender.is_instructor and recipient.is_student:
        return _instructor_teaches_student(sender, recipient)
    if sender.is_student and recipient.is_instructor:
        return _instructor_teaches_student(recipient, sender)
    return False


@transaction.atomic
def send_message(*, sender, recipient, body):
    if not can_message(sender, recipient):
        raise MessagingNotAllowed()
    body = (body or "").strip()
    if not body:
        raise DomainError("Message body cannot be empty.", code="empty_body")
    return Message.objects.create(sender=sender, recipient=recipient, body=body)


def mark_thread_read(*, user, other) -> int:
    """Mark all messages from ``other`` to ``user`` as read. Returns count."""
    return Message.objects.filter(
        recipient=user, sender=other, is_read=False
    ).update(is_read=True, read_at=timezone.now())


def thread_between(user, other):
    """All messages exchanged between two users, oldest first."""
    return (
        Message.objects.filter(
            Q(sender=user, recipient=other) | Q(sender=other, recipient=user)
        )
        .select_related("sender", "recipient")
        .order_by("created_at")
    )


def thread_between_all(user):
    """All messages involving ``user`` (either direction), oldest first.

    Drives the conversation-summary list. Fine at LMS scale; if a single user
    ever accumulates a very large message history, page or pre-aggregate this.
    """
    return (
        Message.objects.filter(Q(sender=user) | Q(recipient=user))
        .select_related("sender", "recipient")
        .order_by("created_at")
    )


def unread_count(user) -> int:
    return Message.objects.filter(recipient=user, is_read=False).count()
