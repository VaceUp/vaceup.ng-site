"""Email bodies for live-class notifications."""
from django.conf import settings
from django.core.mail import send_mail


def send_live_class_reminder(*, email, class_title, course_title, when, join_hint):
    send_mail(
        subject=f"Reminder: “{class_title}” starts soon",
        message=(
            f"Your live class for {course_title} is starting soon.\n\n"
            f"Class: {class_title}\n"
            f"Starts: {when:%Y-%m-%d %H:%M %Z}\n\n"
            f"{join_hint}\n\n"
            "Open VaceUp and go to the class to join when it opens."
        ),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[email],
        fail_silently=False,
    )
