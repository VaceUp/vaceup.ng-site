"""Whiteboard services: session management, CRDT sync, snapshots."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.whiteboard.models import WhiteboardSession, WhiteboardStroke, WhiteboardSnapshot
from apps.core.exceptions import DomainError


def get_or_create_session(*, room_id):
    """Get or create a whiteboard session."""
    session, created = WhiteboardSession.objects.get_or_create(
        room_id=room_id,
        defaults={"is_active": True},
    )
    return session


def get_session_state(room_id):
    """Get the current CRDT state for a session."""
    session = WhiteboardSession.objects.filter(room_id=room_id).first()
    if not session:
        return None
    return {
        "crdt_state": session.crdt_state,
        "version": session.version,
    }


def update_session_state(*, room_id, crdt_state, version):
    """Update the CRDT state for a session."""
    with transaction.atomic():
        session = WhiteboardSession.objects.select_for_update().get(room_id=room_id)
        if version != session.version:
            raise DomainError("Version conflict. Please refresh.", code="version_conflict")
        session.crdt_state = crdt_state
        session.version = version
        session.save(update_fields=["crdt_state", "version", "updated_at"])
    return session


def create_stroke(*, room_id, user, tool, color, width, opacity, points, shape_data=None, is_eraser_stroke=False):
    """Record a whiteboard stroke."""
    stroke = WhiteboardStroke.objects.create(
        room_id=room_id,
        user=user,
        tool=tool,
        color=color,
        width=width,
        opacity=opacity,
        points=points,
        shape_data=shape_data,
        is_eraser_stroke=is_eraser_stroke,
    )
    return stroke


def create_snapshot(*, room_id, state_json, version):
    """Create a periodic full-state snapshot."""
    snapshot = WhiteboardSnapshot.objects.create(
        room_id=room_id,
        state_json=state_json,
        version=version,
    )
    
    # Clean up old snapshots (keep last 10)
    from apps.whiteboard.models import WhiteboardSnapshot
    WhiteboardSnapshot.objects.filter(room_id=room_id).order_by("-created_at")[10:].delete()
    
    return snapshot


def get_strokes_since(room_id, since_version):
    """Get strokes since a given version for incremental sync."""
    return WhiteboardStroke.objects.filter(
        room_id=room_id,
        created_at__gt=timezone.now()  # This would need to be adjusted based on version tracking
    ).order_by("created_at")