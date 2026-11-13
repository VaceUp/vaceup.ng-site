"""Email bodies for live-class notifications."""
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from apps.accounts.mail_delivery import send_account_message
from apps.core.email_layout import render_email


def send_live_class_reminder(*, email, class_title, course_title, when, join_hint):
    message = EmailMultiAlternatives(
        subject=f"Reminder: “{class_title}” starts soon",
        body=(
            f"Your live class for {course_title} is starting soon.\n\n"
            f"Class: {class_title}\n"
            f"Starts: {when:%Y-%m-%d %H:%M %Z}\n\n"
            f"{join_hint}\n\n"
            "Open VaceUp and go to the class to join when it opens."
        ),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[email],
    )
    message.attach_alternative(render_email(
        title=f"{class_title} starts soon", text=message.body, category="Class reminder",
        cta_label="Open live classes", cta_url=settings.FRONTEND_LINK_BASE.rstrip('/') + '/dashboard/live-classes/',
    ), "text/html")
    send_account_message(message)
