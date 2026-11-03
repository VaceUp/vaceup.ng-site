"""What an academy meeting looks like from the inside.

An invited colleague's credential is their account, so a tutor never has to be
sent an outside link and the room address is never published to anyone who was
not invited.
"""
from __future__ import annotations

from apps.liveclasses.livekit import (
    generate_livekit_token, livekit_configured, livekit_ws_url,
    missing_settings_advice,
)
from apps.meetings.models import Meeting
from apps.website.join import JoinDenied


def room_off_notice() -> str:
    """Why the room cannot open here, naming the setting that is actually missing.

    A key alone is not a room: the browser also needs the address to dial, and a
    screen that blames the keys when the address is what is absent sends the
    academy checking the wrong line.
    """
    advice = missing_settings_advice()
    if not advice:
        return ""
    return f"Meetings are not switched on for this academy yet. {advice}"


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
        raise JoinDenied(room_off_notice(), 503)

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
        "ws_url": livekit_ws_url(),
        "identity": identity,
        "display_name": display_name,
        "can_publish": True,
        "is_host": state["is_host"],
    }
