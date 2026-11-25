from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q
from django.utils import timezone

from apps.accounts.mail_delivery import send_account_message
from apps.core.email_layout import render_email
from apps.liveclasses.models import LiveClass
from apps.website.models import CohortRegistration


class Command(BaseCommand):
    help = "Send periodic cohort-interest reminders and one daily class reminder to paid learners."

    def handle(self, *args, **options):
        now = timezone.now()
        today = timezone.localdate(now)
        interested = self._send_interest_reminders(now, today)
        classes = self._send_class_reminders(now, today)
        self.stdout.write(self.style.SUCCESS(
            f"Interest reminders sent: {interested}; class reminders sent: {classes}."
        ))

    def _send_interest_reminders(self, now, today):
        rows = CohortRegistration.objects.select_related("intake", "course").filter(
            status__in=(CohortRegistration.Status.INTERESTED, CohortRegistration.Status.PAYMENT_PENDING),
            consent_reminders=True,
            intake__is_archived=False,
            intake__ends_on__gte=today,
        ).filter(Q(next_interest_reminder_at__isnull=True) | Q(next_interest_reminder_at__lte=now))
        sent = 0
        for row in rows.iterator():
            checkout_path = f"/checkout?course_id={row.course_id}&intake={row.intake_id}"
            payment_path = f"/register?next={quote(checkout_path, safe='')}"
            subject = f"Still interested in {row.course.title}?"
            body = (
                f"Hello {row.full_name},\n\n"
                f"You registered your interest in {row.course.title} for {row.intake.title}. "
                f"The cohort runs from {row.intake.starts_on:%d %b %Y} to {row.intake.ends_on:%d %b %Y}.\n\n"
                f"When you are ready, sign in at VaceUp and continue here: {payment_path}\n\n"
                "Reply to this email if you need help.\n\nVaceUp"
            )
            try:
                message = EmailMultiAlternatives(
                    subject=subject,
                    body=body,
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                    to=[row.email],
                )
                message.attach_alternative(render_email(
                    title="Your cohort is still open",
                    text=f"Hello {row.full_name},\n\nYou registered interest in **{row.course.title}** for **{row.intake.title}**.\n\nThe cohort runs from {row.intake.starts_on:%d %b %Y} to {row.intake.ends_on:%d %b %Y}. When you are ready, sign in to continue.",
                    category="Academy reminder",
                    details=(("Cohort", row.intake.title), ("Course", row.course.title), ("Dates", f"{row.intake.starts_on:%d %b %Y} - {row.intake.ends_on:%d %b %Y}")),
                    cta_label="Continue to application",
                    cta_url=f"{settings.FRONTEND_LINK_BASE.rstrip('/')}{payment_path}",
                    footer="You received this reminder because you registered interest in this VaceUp cohort.",
                ), "text/html")
                send_account_message(message)
            except Exception:
                continue
            row.next_interest_reminder_at = now + timedelta(days=7)
            row.save(update_fields=("next_interest_reminder_at", "updated_at"))
            sent += 1
        return sent

    def _send_class_reminders(self, now, today):
        rows = CohortRegistration.objects.select_related("intake", "course").filter(
            status=CohortRegistration.Status.PAID,
            consent_reminders=True,
            intake__starts_on__lte=today,
            intake__ends_on__gte=today,
        ).filter(Q(last_class_reminder_on__isnull=True) | ~Q(last_class_reminder_on=today))
        sent = 0
        for row in rows.iterator():
            classes = list(LiveClass.objects.filter(
                course_id=row.course_id,
                scheduled_start__date=today,
                status__in=(LiveClass.Status.SCHEDULED, LiveClass.Status.LIVE),
            ).order_by("scheduled_start"))
            if not classes:
                continue
            schedule = "\n".join(
                f"- {lesson.title} at {timezone.localtime(lesson.scheduled_start):%H:%M} ({lesson.duration_minutes} minutes)"
                for lesson in classes
            )
            body = (
                f"Hello {row.full_name},\n\n"
                f"Your {row.course.title} class is scheduled for today, {today:%d %b %Y}:\n{schedule}\n\n"
                "Sign in to VaceUp shortly before the class to join. Your class recordings will be available in the platform after publication.\n\nVaceUp"
            )
            try:
                message = EmailMultiAlternatives(
                    subject=f"Your {row.course.title} class is today",
                    body=body,
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                    to=[row.email],
                )
                message.attach_alternative(render_email(
                    title=f"Your {row.course.title} class is today",
                    text=f"Hello {row.full_name},\n\nYour **{row.course.title}** class is scheduled for today.\n\n{schedule}\n\nSign in to VaceUp shortly before the class to join. Your recording will be available in the platform after publication.",
                    category="Class reminder",
                    details=(("Cohort", row.intake.title), ("Course", row.course.title), ("Class date", f"{today:%d %b %Y}")),
                    cta_label="Open VaceUp",
                    cta_url=f"{settings.FRONTEND_LINK_BASE.rstrip('/')}/dashboard/",
                    footer="You received this daily reminder because you registered for this VaceUp cohort.",
                ), "text/html")
                send_account_message(message)
            except Exception:
                continue
            row.last_class_reminder_on = today
            row.save(update_fields=("last_class_reminder_on", "updated_at"))
            sent += 1
        return sent
