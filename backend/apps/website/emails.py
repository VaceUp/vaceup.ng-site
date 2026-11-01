"""Email bodies for public event registrations."""
import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from apps.accounts.mail_delivery import classify_delivery_failure, send_account_message

logger = logging.getLogger("apps.website")


def _moment(value):
    local = timezone.localtime(value)
    return f"{local:%A %d %B %Y}, {local.strftime('%I:%M %p').lstrip('0')}"


def _window(event):
    if not event.ends_at:
        return _moment(event.starts_at)
    start, end = timezone.localtime(event.starts_at), timezone.localtime(event.ends_at)
    if start.date() == end.date():
        finish = end.strftime("%I:%M %p").lstrip("0")
        return f"{_moment(event.starts_at)} - {finish}"
    return f"{_moment(event.starts_at)} until {_moment(event.ends_at)}"


def event_page_link(event):
    """Absolute, shareable link to this event on the static-export site."""
    base = settings.FRONTEND_LINK_BASE.rstrip("/")
    return f"{base}/events/?slug={event.slug}"


def send_rsvp_confirmation(*, registration):
    """Email the attendee their seat details.

    Delivery is best effort: an SMTP outage must not undo a saved seat, so
    failures are logged with the allowlisted code only.
    """
    event = registration.event
    online = event.is_online
    venue = "Online" if online else (event.location or "Venue to be confirmed")
    lines = [
        f"Hi {registration.name.split(' ')[0] or 'there'},",
        "",
        f"Your seat for “{event.title}” is confirmed.",
        "",
        f"When:   {_window(event)}",
        f"Where:  {venue}",
    ]
    if event.ends_at:
        lines.append(f"Type:   {event.get_event_type_display()}")
    if online and event.meeting_url:
        lines += ["", f"Joining link: {event.meeting_url}"]
    elif online:
        lines += ["", "We will email the joining link before the event starts."]
    if registration.note:
        lines += ["", f"You told us: {registration.note}"]
    consent_line = (
        "You agreed to hear about our future events — thank you."
        if registration.consent_marketing
        else "We will only email you about this event."
    )
    lines += [
        "",
        "If you can no longer attend, reply to this email and we will release "
        "your seat to someone else.",
        "",
        consent_line,
        "",
        f"Event page: {event_page_link(event)}",
        "",
        "VaceUp Digital Academy",
    ]
    body = "\n".join(lines)

    message = EmailMessage(
        subject=f"Confirmed: {event.title} on {_moment(event.starts_at)}",
        body=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[registration.email],
    )
    try:
        send_account_message(message)
    except Exception as exc:
        failure = classify_delivery_failure(exc)
        logger.error(
            "event_email kind=rsvp_confirmation stage=delivery code=%s action=%s",
            failure.code, failure.action,
        )
        return False
    logger.info("event_email kind=rsvp_confirmation stage=delivery status=accepted")
    return True
