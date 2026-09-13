"""Email bodies for live-class notifications."""
from django.conf import settings
from django.core.mail import EmailMessage
from apps.accounts.mail_delivery import send_account_message


def send_live_class_reminder(*, email, class_title, course_title, when, join_hint):
    message = EmailMessage(
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
    send_account_message(message)
