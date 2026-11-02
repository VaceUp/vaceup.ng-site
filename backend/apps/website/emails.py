"""Email bodies for public event registrations."""
import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from apps.accounts.mail_delivery import classify_delivery_failure, send_account_message
from apps.website.join import room_is_ready

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


def send_event_broadcast(*, registration, subject, note, include_link=True):
    """Send the academy's own note about this event to one registrant.

    One recipient per message, so an address never appears beside another
    attendee's, and the relay sees the same plain-text shape it already accepts.
    """
    event = registration.event
    lines = [f"Hi {registration.name.split(' ')[0] or 'there'},", ""]
    lines += [paragraph for paragraph in note.strip().split("\n\n")]
    lines += [
        "",
        f"About: “{event.title}” — {_window(event)}",
        f"Where: {'Online' if event.is_online else (event.location or 'Venue to be confirmed')}",
    ]
    if include_link and event.is_online and room_is_ready(event):
        lines += ["", f"Join here: {registration.join_link()}"]
    lines += [
        "",
        f"You are receiving this because you registered on our website: "
        f"{event_page_link(event)}",
        "",
        "VaceUp Digital Academy",
    ]
    message = EmailMessage(
        subject=subject,
        body="\n".join(lines),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[registration.email],
    )
    try:
        send_account_message(message)
    except Exception as exc:
        failure = classify_delivery_failure(exc)
        logger.error(
            "event_email kind=broadcast stage=delivery code=%s action=%s",
            failure.code, failure.action,
        )
        return False
    logger.info("event_email kind=broadcast stage=delivery status=accepted")
    return True


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
    if online:
        lines += [
            "",
            f"Your personal joining link: {registration.join_link()}",
            "Open it a few minutes before the start. It is your seat, so please "
            "do not pass it on.",
        ]
        if not room_is_ready(event):
            lines.append(
                "The academy has not set the meeting details yet. That same link "
                "shows them the moment they are added, so keep this email.",
            )
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


def send_join_link_email(*, registration):
    """Email one attendee the link that opens the room.

    This is the promise the confirmation could not keep: it goes out after the
    academy finally sets the meeting details, which is usually close to the
    event and after most people have registered.
    """
    event = registration.event
    venue = "Online" if event.is_online else (event.location or "Venue to be confirmed")
    lines = [
        f"Hi {registration.name.split(' ')[0] or 'there'},",
        "",
        f"The joining link for “{event.title}” is ready.",
        "",
        f"When:   {_window(event)}",
        f"Where:  {venue}",
        "",
        f"Join here: {registration.join_link()}",
        "",
        "Open it a few minutes before the start. It is your seat, so please do "
        "not pass it on.",
        "",
        f"Event page: {event_page_link(event)}",
        "",
        "VaceUp Digital Academy",
    ]
    message = EmailMessage(
        subject=f"Joining link: {event.title} on {_moment(event.starts_at)}",
        body="\n".join(lines),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[registration.email],
    )
    try:
        send_account_message(message)
    except Exception as exc:
        failure = classify_delivery_failure(exc)
        logger.error(
            "event_email kind=join_link stage=delivery code=%s action=%s",
            failure.code, failure.action,
        )
        return False
    logger.info("event_email kind=join_link stage=delivery status=accepted")
    return True
