"""Learner lifecycle emails: congratulations on completion, gentle reminders.

Both go through the account delivery path, so the configured mode
(sync/async/database) governs them and no marketing consent is involved.
"""
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from apps.accounts.mail_delivery import send_account_message
from apps.core.email_layout import render_email
from apps.marketing.models import EmailUnsubscribe

logger = logging.getLogger(__name__)


def _learner_url(course):
    return f"{settings.FRONTEND_LINK_BASE.rstrip('/')}/dashboard/learn/?course={course.slug}"


def _send(student, *, subject, text, category, cta_label, cta_url):
    if not student.email or not student.is_active:
        return False
    if EmailUnsubscribe.objects.filter(user=student, unsubscribe_all=True).exists():
        return False
    message = EmailMultiAlternatives(subject=subject, body=text, to=[student.email])
    message.attach_alternative(render_email(
        title=subject, text=text, category=category, cta_label=cta_label, cta_url=cta_url,
        footer="You are receiving this because you are enrolled in a VaceUp course.",
    ), "text/html")
    send_account_message(message)
    return True


def send_completion_congratulations(enrollment):
    """One email the moment an enrollment transitions active to completed."""
    course = enrollment.course
    first_name = (enrollment.student.full_name or "").split(" ")[0] or "there"
    subject = f"Congratulations, {first_name}: {course.title} is complete"
    text = (
        f"Hi {first_name},\n\nYou have completed every lesson in {course.title}. "
        "That is real, finished work worth showing.\n\n"
        "# What you can do next\n"
        "- Download your certificate from your dashboard\n"
        "- Add the new skill to your CV or portfolio\n"
        "- Start the next course while the momentum is fresh\n\n"
        "Well done,\nThe VaceUp team"
    )
    try:
        return _send(enrollment.student, subject=subject, text=text, category="Course milestone",
                     cta_label="Collect your certificate", cta_url=f"{settings.FRONTEND_LINK_BASE.rstrip('/')}/dashboard/certificates/")
    except Exception:
        # A milestone email must never break the lesson-completion flow.
        logger.exception("completion_congratulations enrollment=%s failed", enrollment.pk)
        return False


def send_progress_reminder(enrollment):
    """A gentle nudge for a learner who stalled mid-course."""
    course = enrollment.course
    first_name = (enrollment.student.full_name or "").split(" ")[0] or "there"
    percent = enrollment.progress_percent.quantize(__import__("decimal").Decimal("1"))
    subject = f"Pick {course.title} back up, {first_name}"
    text = (
        f"Hi {first_name},\n\nYou are {percent}% of the way through {course.title}. "
        "Your next lesson is waiting exactly where you left it.\n\n"
        "# Make fifteen minutes today\n"
        "- Open the course and finish one lesson\n"
        "- Small sessions add up faster than one long catch-up\n\n"
        "You started this for a reason. Keep going,\nThe VaceUp team"
    )
    try:
        return _send(enrollment.student, subject=subject, text=text, category="Course progress",
                     cta_label="Continue the course", cta_url=_learner_url(course))
    except Exception:
        logger.exception("progress_reminder enrollment=%s failed", enrollment.pk)
        return False
