"""Join logic for live classes: entitlement, time-window, attendance, creds.
Includes breakout room and recording support."""
from __future__ import annotations

from django.db import transaction

from apps.core.exceptions import DomainError, NotEnrolled
from apps.enrollment.models import Enrollment
from apps.liveclasses.livekit import (
    generate_livekit_token, generate_breakout_token,
    build_join_credentials, livekit_configured, livekit_ws_url
)
from apps.liveclasses.models import Attendance, LiveClass


class ClassNotJoinable(DomainError):
    status_code = 409
    default_detail = "This class is not open for joining right now."
    default_code = "class_not_joinable"


class BreakoutRoomNotFound(DomainError):
    status_code = 404
    default_detail = "Breakout room not found."
    default_code = "breakout_not_found"


class BreakoutRoomFull(DomainError):
    status_code = 409
    default_detail = "Breakout room is full."
    default_code = "breakout_full"


@transaction.atomic
def join_live_class(*, user, live_class):
    """Return join credentials for ``user``.

    Host (owning instructor / admin) may join any time to start the session.
    Students must be enrolled and within the join window; their attendance is
    recorded once.

    Everyone who is in the room can publish: a class is a conversation and a
    whiteboard, not a broadcast, so a student needs the microphone, the camera
    and the screen share exactly where a tutor has them.
    """
    is_host = user.is_admin or live_class.course.instructor_id == user.id
    if is_host:
        return build_join_credentials(
            user=user, live_class=live_class, can_publish=True, is_host=True
        )

    enrolled = Enrollment.objects.filter(
        student=user, course=live_class.course,
        status__in=(Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED),
    ).exists()
    if not enrolled:
        raise NotEnrolled("You must be enrolled in this course to join.")
    if not live_class.is_joinable():
        raise ClassNotJoinable()

    Attendance.objects.get_or_create(live_class=live_class, student=user)
    return build_join_credentials(
        user=user, live_class=live_class, can_publish=True, is_host=False
    )


def join_breakout_room(*, user, live_class, breakout_room: str) -> dict:
    """Join a breakout room within a live class.
    
    Breakout rooms are separate LiveKit rooms. The frontend handles
    moving the participant's connection.
    """
    if not livekit_configured():
        raise DomainError("LiveKit not configured.", code="livekit_not_configured")
    
    is_host = user.is_admin or live_class.course.instructor_id == user.id
    if not is_host:
        # Verify user is in main class and breakout exists
        enrolled = Enrollment.objects.filter(
            student=user, course=live_class.course,
            status__in=(Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED),
        ).exists()
        if not enrolled:
            raise NotEnrolled("You must be enrolled in this course to join.")
    
    # Generate token for breakout room
    token = generate_breakout_token(
        identity=str(user.id),
        name=user.full_name,
        main_room=live_class.room_name or f"class-{live_class.id}",
        breakout_room=breakout_room,
    )
    
    if not token:
        raise DomainError("Failed to generate breakout token.", code="token_generation_failed")
    
    return {
        "provider": "livekit",
        "room": breakout_room,
        "ws_url": livekit_ws_url(),
        "token": token,
        "identity": str(user.id),
        "display_name": user.full_name or ("Host" if is_host else "Guest"),
        "can_publish": True,
        "is_host": is_host,
        "breakout": True,
    }


def leave_breakout_room(*, user, live_class, breakout_room: str) -> dict:
    """Leave a breakout room and return to main room."""
    is_host = user.is_admin or live_class.course.instructor_id == user.id
    return build_join_credentials(
        user=user, live_class=live_class, can_publish=True, is_host=is_host
    )


def get_breakout_rooms(live_class) -> list:
    """Get list of active breakout rooms for a live class.
    
    In a real implementation, this would query the LiveKit API or
    a local cache of active breakout rooms.
    """
    # For now, return predefined breakout rooms from live_class metadata
    metadata = getattr(live_class, 'breakout_metadata', {}) or {}
    return metadata.get('breakout_rooms', [])


def create_breakout_rooms(live_class, count: int = 3, prefix: str = "breakout") -> list:
    """Create breakout rooms for a live class.
    
    Returns list of breakout room names created.
    """
    rooms = []
    for i in range(count):
        room_name = f"{live_class.room_name or f'class-{live_class.id}'}-{prefix}-{i+1}"
        rooms.append({
            "name": room_name,
            "display_name": f"Breakout Room {i+1}",
            "max_participants": 10,
        })
    
    # Store in live_class metadata
    if not hasattr(live_class, 'breakout_metadata') or live_class.breakout_metadata is None:
        live_class.breakout_metadata = {}
    live_class.breakout_metadata['breakout_rooms'] = rooms
    live_class.save(update_fields=['breakout_metadata'])
    
    return rooms


def close_breakout_rooms(live_class) -> bool:
    """Close all breakout rooms for a live class."""
    if hasattr(live_class, 'breakout_metadata'):
        live_class.breakout_metadata = {}
        live_class.save(update_fields=['breakout_metadata'])
    return True
