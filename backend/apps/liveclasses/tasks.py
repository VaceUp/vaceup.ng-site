"""Scheduled reminders for upcoming live classes (Celery Beat).

``send_live_class_reminders`` is run periodically by beat: it finds classes
starting within the lead window that haven't been reminded, fans out a reminder
email per enrolled student, and marks the class reminded. Idempotent — the
``reminder_sent`` flag + a row lock stop a class being reminded twice.
"""
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.enrollment.models import Enrollment
from apps.liveclasses.emails import send_live_class_reminder
from apps.liveclasses.models import LiveClass


@shared_task(name="liveclasses.send_live_class_reminders")
def send_live_class_reminders():
    lead = getattr(settings, "LIVE_CLASS_REMINDER_LEAD_MINUTES", 30)
    now = timezone.now()
    horizon = now + timedelta(minutes=lead)
    enqueued = 0

    with transaction.atomic():
        due = (
            LiveClass.objects.select_for_update()
            .select_related("course")
            .filter(
                status=LiveClass.Status.SCHEDULED,
                reminder_sent=False,
                scheduled_start__gte=now,
                scheduled_start__lte=horizon,
            )
        )
        for live_class in due:
            students = Enrollment.objects.filter(
                course=live_class.course,
                status__in=(
                    Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED,
                ),
            ).values_list("student__email", flat=True)
            for email in students:
                send_live_class_reminder_email.delay(email, live_class.id)
                enqueued += 1
            live_class.reminder_sent = True
            live_class.save(update_fields=["reminder_sent", "updated_at"])
    return enqueued


@shared_task(
    name="liveclasses.send_live_class_reminder_email",
    autoretry_for=(Exception,), retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_live_class_reminder_email(email, live_class_id):
    live_class = (
        LiveClass.objects.select_related("course")
        .filter(id=live_class_id).first()
    )
    if live_class is None:
        return
    if live_class.provider == LiveClass.Provider.EXTERNAL and live_class.join_url:
        join_hint = f"Join link: {live_class.join_url}"
    else:
        join_hint = "The join button will appear on the class page."
    send_live_class_reminder(
        email=email,
        class_title=live_class.title,
        course_title=live_class.course.title,
        when=live_class.scheduled_start,
        join_hint=join_hint,
    )
