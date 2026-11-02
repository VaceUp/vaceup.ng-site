"""What an attendee needs to enter an event's live room, and why they may not yet.

The attendee's credential is the personal token mailed with their seat
confirmation, so a workshop-goer never has to open a VaceUp account and the
room address is never published to people who did not register.
"""
from __future__ import annotations

import re

from django.conf import settings
from django.utils import timezone

from apps.liveclasses.livekit import generate_livekit_token, livekit_configured
from apps.website.models import Event

MIN_TOKEN_TTL = 3600
MAX_TOKEN_TTL = 24 * 3600
DEFAULT_JITSI_DOMAIN = "meet.jit.si"
JITSI_UNSAFE = re.compile(r"[^A-Za-z0-9_-]+")


class JoinDenied(Exception):
    """Raised with the sentence the attendee should be shown, and its HTTP code."""

    def __init__(self, detail, status_code=400):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _token_ttl(event):
    """A token that outlives the session, so nobody is dropped mid-event.

    A three-day workshop cannot be served by the one-hour default, and an
    attendee who is reconnected after a network blip should not have to
    re-enter their link.
    """
    remaining = (event.join_closes_at - timezone.now()).total_seconds()
    return int(max(MIN_TOKEN_TTL, min(MAX_TOKEN_TTL, remaining + 900)))


def _moment(value):
    local = timezone.localtime(value)
    return f"{local:%A %d %B %Y} at {local.strftime('%I:%M %p').lstrip('0')}"


def jitsi_domain():
    """The bare host that serves Jitsi rooms, however the .env line was written.

    A pasted "https://meet.jit.si/" is the same server as "meet.jit.si", and the
    embed script is fetched by host name, so the value is trimmed here rather
    than trusted to be typed correctly.
    """
    raw = str(getattr(settings, "JITSI_DOMAIN", "") or DEFAULT_JITSI_DOMAIN)
    return raw.split("//", 1)[-1].split("/", 1)[0].strip().lower() or DEFAULT_JITSI_DOMAIN


def jitsi_room_name(event):
    """The full Jitsi room address for an event, with its private code appended.

    Jitsi checks no credentials at all — whoever knows the name is in the room —
    so the readable label the academy typed is never the whole address.
    """
    label = JITSI_UNSAFE.sub("-", event.room_name or f"event-{event.slug}").strip("-")
    return f"vaceup-{label[:60] or 'event'}-{event.room_secret}"


def room_is_ready(event):
    """Whether clicking Join right now would actually take someone somewhere."""
    if event.live_platform == Event.LivePlatform.EXTERNAL:
        return bool(event.meeting_url)
    if event.live_platform == Event.LivePlatform.JITSI:
        # The public Jitsi server needs nothing from this one, so choosing it is
        # enough to have somewhere to send people.
        return True
    return livekit_configured()


def join_access(*, event, registration=None, user=None):
    """Return the credentials that open ``event``'s room for this person.

    A host (an admin signed in) may enter at any time and may speak. Anyone
    else is only let in with the token from their own confirmation email, and
    only while the room is open.
    """
    is_host = user is not None and getattr(user, "is_authenticated", False) and user.is_admin
    if not is_host and registration is None:
        raise JoinDenied("This join link is not one we issued for this event.", 403)
    if not event.is_online:
        raise JoinDenied("This event is not online, so there is no room to enter.", 400)

    now = timezone.now()
    if not is_host:
        if now < event.join_opens_at:
            raise JoinDenied(
                f"The room opens at {_moment(event.join_opens_at)}. "
                "Join then — the link keeps working after that.",
                409,
            )
        if now > event.join_closes_at:
            raise JoinDenied(
                "This event has finished. Check the Events page for the next date.",
                409,
            )

    if event.live_platform == Event.LivePlatform.EXTERNAL:
        if not event.meeting_url:
            raise JoinDenied(
                "The academy has not set the meeting link for this event yet. "
                "It appears on this page as soon as it is added.",
                503,
            )
        return {
            "provider": "external",
            "url": event.meeting_url,
            "display_name": (registration.name if registration else user.full_name),
        }

    if event.live_platform == Event.LivePlatform.JITSI:
        room = jitsi_room_name(event)
        domain = jitsi_domain()
        return {
            "provider": "jitsi",
            "room": room,
            "domain": domain,
            "url": f"https://{domain}/{room}",
            "display_name": (registration.name if registration else user.full_name),
            "is_host": is_host,
        }

    if not livekit_configured():
        raise JoinDenied(
            "The VaceUp Live Room is not switched on on this server yet. "
            "The academy needs its LiveKit keys in place.",
            503,
        )
    room = event.room_name or f"event-{event.slug}"
    if is_host:
        identity, display_name, can_publish = f"host-{user.pk}", user.full_name or "Host", True
    else:
        identity = f"event-{event.pk}-reg-{registration.pk}"
        display_name = registration.name
        can_publish = True

    token = generate_livekit_token(
        identity=identity,
        name=display_name,
        room=room,
        ttl_seconds=_token_ttl(event),
        can_publish=can_publish,
    )
    if not token:
        raise JoinDenied("The live room could not be opened right now. Try again.", 503)
    return {
        "provider": "livekit",
        "room": room,
        "token": token,
        "ws_url": getattr(settings, "LIVEKIT_WS_URL", ""),
        "identity": identity,
        "display_name": display_name,
        "can_publish": can_publish,
        "is_host": is_host,
    }
