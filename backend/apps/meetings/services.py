"""What an academy meeting looks like from the inside.

An invited colleague's credential is their account, so a tutor never has to be
sent an outside link and the room address is never published to anyone who was
not invited.
"""
from __future__ import annotations

from django.conf import settings

from apps.liveclasses.livekit import generate_livekit_token, livekit_configured
from apps.meetings.models import Meeting
from apps.website.join import JoinDenied

ROOM_OFF = (
    "Meetings are not switched on for this academy yet. The LiveKit keys need to "
    "be in place on the server."
)


def room_is_ready() -> bool:
    """Whether this server can open a staff meeting room at all.

    The dashboard asks first so it can say the room is not switched on instead
    of offering a button that only fails.
    """
    return livekit_configured()


def meeting_access(*, meeting: Meeting, user) -> dict:
    """The LiveKit credentials for one invited person, or why they get none.

    Raises JoinDenied with the sentence the screen should show, which is the
    same shape the event room already uses.
    """
    state = meeting.state_for(user)
    if not state["can_enter"]:
        raise JoinDenied(
            state["reason"] or "This meeting is not open to you right now.", 403
        )
    if not livekit_configured():
        raise JoinDenied(ROOM_OFF, 503)

    identity = f"meeting-{meeting.pk}-user-{user.pk}"
    display_name = user.full_name or ("Host" if state["is_host"] else "Guest")
    token = generate_livekit_token(
        identity=identity,
        name=display_name,
        room=meeting.room_name,
        ttl_seconds=meeting.token_ttl(),
        can_publish=True,
    )
    if not token:
        raise JoinDenied("The meeting room could not be opened right now. Try again.", 503)
    return {
        "provider": "livekit",
        "room": meeting.room_name,
        "token": token,
        "ws_url": getattr(settings, "LIVEKIT_WS_URL", ""),
        "identity": identity,
        "display_name": display_name,
        "can_publish": True,
        "is_host": state["is_host"],
    }
