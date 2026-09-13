"""Transactional mail outbox with bounded retries and recoverable claims.

SMTP is at-least-once: a process dying after SMTP accepts but before marking
sent can cause a duplicate. Dedupe keys prevent duplicate enqueue; claims stop
overlapping cron jobs normally delivering the same job simultaneously.
"""
from datetime import timedelta
import uuid

from django.conf import settings
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from apps.accounts.mail_delivery import classify_delivery_failure
from apps.accounts.models import MailJob

MAX_ATTEMPTS = 5
LEASE_SECONDS = 300


def enqueue_token(kind, record):
    job, _ = MailJob.objects.get_or_create(
        dedupe_key=f"{kind}:{record.pk}",
        defaults={"kind": kind, "object_id": record.pk, "user_id": record.user_id},
    )
    return job


def enqueue_reminders():
    from apps.enrollment.models import Enrollment
    from apps.liveclasses.models import LiveClass
    now = timezone.now()
    horizon = now + timedelta(minutes=settings.LIVE_CLASS_REMINDER_LEAD_MINUTES)
    count = 0
    # Re-scanning permits reschedules/new enrollments; the per-recipient key is
    # authoritative, not a class-wide flag set before delivery has happened.
    for live_class in LiveClass.objects.filter(
        status=LiveClass.Status.SCHEDULED, scheduled_start__gte=now, scheduled_start__lte=horizon,
    ).iterator():
        start = live_class.scheduled_start.isoformat()
        recipients = Enrollment.objects.filter(
            course_id=live_class.course_id, student__is_active=True,
            status__in=[Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED],
        ).values_list("student_id", flat=True)
        for user_id in recipients.iterator():
            _, created = MailJob.objects.get_or_create(
                dedupe_key=f"live_reminder:{live_class.pk}:{start}:{user_id}",
                defaults={"kind": "live_reminder", "object_id": live_class.pk,
                          "user_id": user_id, "metadata": {"scheduled_start": start}},
            )
            count += int(created)
    return count


def claim_job():
    now = timezone.now()
    eligible = Q(status=MailJob.Status.PENDING, available_at__lte=now) | Q(
        status=MailJob.Status.PROCESSING, claimed_at__lte=now - timedelta(seconds=LEASE_SECONDS),
    )
    with transaction.atomic():
        query = MailJob.objects.select_for_update(
            skip_locked=connection.features.has_select_for_update_skip_locked,
        ).filter(eligible).order_by("available_at", "pk")
        job = query.first()
        if job is None:
            return None
        if job.attempts >= MAX_ATTEMPTS:
            job.status = MailJob.Status.FAILED
            job.error_code = "attempt_limit"
            job.finished_at = now
            job.save(update_fields=["status", "error_code", "finished_at", "updated_at"])
            return job
        job.status = MailJob.Status.PROCESSING
        job.claimed_at = now
        job.claim_id = uuid.uuid4()
        job.attempts += 1
        job.save(update_fields=["status", "claimed_at", "claim_id", "attempts", "updated_at"])
        return job


def _deliver(job):
    if job.kind in {"verification", "password_reset"}:
        from apps.accounts.tasks import deliver_token_email
        return deliver_token_email(job.kind, token_id=job.object_id)
    if job.kind != "live_reminder":
        raise ValueError("Unsupported mail kind")
    from apps.enrollment.models import Enrollment
    from apps.liveclasses.models import LiveClass
    from apps.liveclasses.emails import send_live_class_reminder
    live_class = LiveClass.objects.select_related("course").filter(
        pk=job.object_id, status=LiveClass.Status.SCHEDULED,
        scheduled_start__gt=timezone.now(),
    ).first()
    if (live_class is None or not job.user.is_active
            or live_class.scheduled_start.isoformat() != job.metadata.get("scheduled_start")
            or not Enrollment.objects.filter(
                student_id=job.user_id, course_id=live_class.course_id,
                status__in=[Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED],
            ).exists()):
        return False
    # Never email a raw meeting URL that bypasses enrollment/time checks.
    send_live_class_reminder(
        email=job.user.email, class_title=live_class.title, course_title=live_class.course.title,
        when=live_class.scheduled_start,
        join_hint=f"Open {settings.FRONTEND_BASE_URL.rstrip('/')}/dashboard/live-classes/ to join.",
    )
    return True


def process_one():
    job = claim_job()
    if job is None:
        return None
    if job.status == MailJob.Status.FAILED:
        return job.status
    now = timezone.now()
    try:
        delivered = _deliver(job)
    except Exception as exc:
        failure = classify_delivery_failure(exc)
        retry = failure.retryable and job.attempts < MAX_ATTEMPTS
        updates = {
            "status": MailJob.Status.PENDING if retry else MailJob.Status.FAILED,
            "error_code": failure.code,
            "available_at": now + timedelta(seconds=min(3600, 60 * 2 ** (job.attempts - 1))),
            "finished_at": None if retry else now,
        }
    else:
        updates = {"status": MailJob.Status.SENT if delivered else MailJob.Status.SKIPPED,
                   "error_code": "", "finished_at": now}
    MailJob.objects.filter(pk=job.pk, status=MailJob.Status.PROCESSING, claim_id=job.claim_id).update(
        **updates, updated_at=now, claim_id=None, claimed_at=None,
    )
    return updates["status"]
