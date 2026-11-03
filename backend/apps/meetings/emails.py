"""Email bodies for staff meetings."""
import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from apps.accounts.mail_delivery import send_account_message

logger = logging.getLogger("apps.meetings")

ROOM_PATH = "/meeting"


def _moment(value):
    local = timezone.localtime(value)
    return f"{local:%A %d %B %Y} at {local.strftime('%I:%M %p').lstrip('0')}"


def meeting_link(meeting):
    """The in-app door. It carries no key: the account behind it is the check."""
    base = settings.FRONTEND_LINK_BASE.rstrip("/")
    return f"{base}{ROOM_PATH}/?meeting={meeting.pk}"


def _send(*, subject, body, recipient):
    message = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient],
        headers={"X-VaceUp-Meeting": "staff"},
    )
    message.content_subtype = "plain"
    send_account_message(message)


def send_meeting_invite(*, meeting, user):
    """Tell one person they have been invited, and where to walk in."""
    window = f"{_moment(meeting.starts_at)} for about {meeting.duration_minutes} minutes"
    lines = [
        f"{meeting.host.full_name or 'The academy'} has set up a meeting with you"
        " inside VaceUp.",
        "",
        f"Title: {meeting.title}",
        f"When: {window}",
        "",
    ]
    if meeting.agenda:
        lines += ["What it is about:", meeting.agenda.strip(), ""]
    lines += [
        "Open this link when the room is due to open and you are in:",
        meeting_link(meeting),
        "",
        "You do not need a meeting link from anyone else, and nothing has to be",
        "installed. The room is the VaceUp Live Room.",
    ]
    _send(
        subject=f"Meeting invitation: {meeting.title}",
        body="\n".join(lines),
        recipient=user.email,
    )


def send_meeting_cancelled(*, meeting, user):
    lines = [
        f"The meeting '{meeting.title}' has been called off.",
        f"It was due {_moment(meeting.starts_at)}.",
        "",
        "Nothing else changes and no link needs retiring.",
    ]
    _send(
        subject=f"Called off: {meeting.title}",
        body="\n".join(lines),
        recipient=user.email,
    )
