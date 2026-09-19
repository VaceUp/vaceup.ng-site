"""Current access policy, database-bounded sends, and scoped acknowledgments."""
from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import Throttled, ValidationError

from apps.core.exceptions import DomainError
from apps.enrollment.models import Enrollment
from apps.messaging.models import Message, MessageBlock, MessageReport

User = get_user_model()
PERMITTED_STATUSES = (Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED)


class MessagingNotAllowed(DomainError):
    status_code = 403
    default_detail = "You are not allowed to message this user."
    default_code = "messaging_not_allowed"


class MessageIDConflict(DomainError):
    status_code = 409
    default_detail = "This client_message_id was already used for a different message."
    default_code = "message_id_conflict"


def active_account(user):
    """Reload role/activity: stale sessions and in-memory actors confer no access."""
    if not user or not user.is_authenticated or not user.pk:
        return None
    return User.objects.filter(pk=user.pk, is_active=True).first()


def authorized_contacts(user):
    """A SQL-only directory, never a materialized list of students or histories."""
    user = active_account(user)
    if user is None:
        return User.objects.none()
    contacts = User.objects.filter(is_active=True).exclude(pk=user.pk)
    enrolments = Enrollment.objects.filter(status__in=PERMITTED_STATUSES)
    policy = Q(role=User.Role.ADMIN)
    if user.is_admin:
        policy = Q()
    elif user.is_student:
        own = enrolments.filter(student_id=user.pk)
        policy |= Q(role=User.Role.INSTRUCTOR, pk__in=own.values("course__instructor_id"))
        classmates = enrolments.filter(course_id__in=own.values("course_id"))
        policy |= Q(role=User.Role.STUDENT, pk__in=classmates.values("student_id"))
    elif user.is_instructor:
        students = enrolments.filter(course__instructor_id=user.pk)
        policy |= Q(role=User.Role.STUDENT, pk__in=students.values("student_id"))
    # Blocks precede every role exception, including later role promotions.
    return contacts.filter(policy).exclude(
        pk__in=MessageBlock.objects.filter(blocker_id=user.pk).values("blocked_id")
    ).exclude(
        pk__in=MessageBlock.objects.filter(blocked_id=user.pk).values("blocker_id")
    )


def can_message(sender, recipient) -> bool:
    return bool(recipient and authorized_contacts(sender).filter(pk=recipient.pk).exists())


def require_contact(user, other):
    if not can_message(user, other):
        raise MessagingNotAllowed()


def _lock_accounts(*users):
    """Consistent lock order serializes sends and blocks across WSGI workers.

    MySQL/InnoDB and PostgreSQL provide row locks. SQLite is used only by the
    hermetic test suite; its write serialization differs from production.
    """
    return list(User.objects.select_for_update().filter(
        pk__in=[user.pk for user in users],
    ).order_by("pk"))


def _check_send_rate(sender):
    now = timezone.now()
    for duration, limit in ((60, 30), (3600, 300)):
        recent = Message.objects.filter(
            sender=sender, created_at__gt=now - timedelta(seconds=duration),
        ).order_by()
        if recent[:limit].count() >= limit:
            raise Throttled(wait=duration, detail="Message send limit reached. Please try again later.")


def _check_retry(message, recipient, body):
    if message.recipient_id != recipient.pk or message.body != body:
        raise MessageIDConflict()
    return message, False


@transaction.atomic
def send_message(*, sender, recipient, body, client_message_id):
    _lock_accounts(sender, recipient)
    require_contact(sender, recipient)
    if not isinstance(body, str) or not body.strip() or len(body.strip()) > 5000:
        raise ValidationError({"body": "Enter a message of 1 to 5000 characters."})
    body = body.strip()
    try:
        client_message_id = UUID(str(client_message_id))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({"client_message_id": "Enter a valid UUID."})
    existing = Message.objects.filter(sender=sender, client_message_id=client_message_id).first()
    if existing:
        return _check_retry(existing, recipient, body)
    _check_send_rate(sender)
    try:
        # Savepoint allows a unique-constraint race to resolve to the original.
        with transaction.atomic():
            message = Message.objects.create(
                sender=sender, recipient=recipient, body=body,
                client_message_id=client_message_id,
            )
    except IntegrityError:
        existing = Message.objects.filter(sender=sender, client_message_id=client_message_id).first()
        if existing is None:
            raise
        return _check_retry(existing, recipient, body)
    return message, True


def _thread(user, other):
    return Message.objects.filter(
        Q(sender=user, recipient=other) | Q(sender=other, recipient=user)
    )


def thread_between(user, other):
    require_contact(user, other)
    return _thread(user, other).select_related("sender").order_by("-id")


def mark_thread_read(*, user, other, through_id) -> int:
    require_contact(user, other)
    if not _thread(user, other).filter(pk=through_id).exists():
        raise ValidationError({"through_id": "Choose a message in this conversation."})
    return Message.objects.filter(
        recipient=user, sender=other, is_read=False, pk__lte=through_id,
    ).update(is_read=True, read_at=timezone.now())


def thread_summaries(user):
    """Correlated, indexed aggregates; pagination bounds hydrated rows.

    The database finds the latest message and unread count for each permitted
    counterpart. Python never walks the message history or queries per row.
    """
    exchanged = Message.objects.filter(
        Q(sender=user, recipient_id=OuterRef("pk"))
        | Q(recipient=user, sender_id=OuterRef("pk"))
    )
    latest = exchanged.order_by("-id")
    unread = Message.objects.filter(
        recipient=user, sender_id=OuterRef("pk"), is_read=False,
    ).order_by().values("sender_id").annotate(total=Count("pk")).values("total")
    return authorized_contacts(user).filter(Exists(exchanged)).annotate(
        last_id=Subquery(latest.values("id")[:1]),
        last_message=Subquery(latest.values("body")[:1]),
        last_at=Subquery(latest.values("created_at")[:1]),
        last_sender_id=Subquery(latest.values("sender_id")[:1]),
        unread=Coalesce(Subquery(unread, output_field=IntegerField()), Value(0)),
    ).only("id", "full_name", "role").order_by("-last_id", "-id")


def unread_count(user) -> int:
    return Message.objects.filter(
        recipient=user, is_read=False, sender_id__in=authorized_contacts(user).values("pk"),
    ).count()


@transaction.atomic
def block_user(*, user, other):
    locked = {account.pk: account for account in _lock_accounts(user, other)}
    actor, target = locked.get(user.pk), locked.get(other.pk)
    if not actor or not actor.is_active or not target or target.is_admin or user.pk == other.pk:
        raise MessagingNotAllowed("You may block another non-admin account.")
    existing = MessageBlock.objects.filter(blocker=user, blocked=other).first()
    if existing:
        return existing
    if not can_message(actor, target) and not _thread(actor, target).exists():
        raise MessagingNotAllowed()
    return MessageBlock.objects.create(blocker=actor, blocked=target)


@transaction.atomic
def unblock_user(*, user, other):
    _lock_accounts(user, other)
    if active_account(user) is None:
        raise MessagingNotAllowed()
    MessageBlock.objects.filter(blocker=user, blocked=other).delete()


def report_message(*, user, message_id, reason):
    if active_account(user) is None:
        raise MessagingNotAllowed()
    message = get_object_or_404(
        Message.objects.filter(Q(sender=user) | Q(recipient=user)), pk=message_id,
    )
    # The unique constraint makes concurrent retries safe without logging bodies.
    return MessageReport.objects.get_or_create(
        message=message, reporter=user, defaults={"reason": reason},
    )
