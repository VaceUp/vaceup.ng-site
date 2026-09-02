"""LiveKit access-token minting and room management (native video provider).

Best-effort JWT per the LiveKit spec (HS256, video grant). Verify against your
LiveKit server version before relying on it in production. Returns ``None`` when
LiveKit isn't configured, in which case callers fall back to an external link.
PyJWT ships as a dependency of djangorestframework-simplejwt.
"""
from __future__ import annotations

import time
from typing import Optional, List, Dict, Any

from django.conf import settings
import jwt

from apps.liveclasses.models import LiveClass


def livekit_configured() -> bool:
    """Check if LiveKit is properly configured."""
    return bool(
        getattr(settings, "LIVEKIT_API_KEY", "")
        and getattr(settings, "LIVEKIT_API_SECRET", "")
    )


def generate_livekit_token(
    *, identity: str, name: str, room: str, ttl_seconds: int = 3600,
    can_publish: bool = False, can_subscribe: bool = True,
    can_publish_data: bool = True,
    hidden: bool = False,
    recorder: bool = False,
) -> Optional[str]:
    """Generate a LiveKit access token with video grants.
    
    Args:
        identity: Unique user identifier (e.g., user ID)
        name: Display name for the participant
        room: Room name to join
        ttl_seconds: Token lifetime in seconds (default 1 hour)
        can_publish: Whether participant can publish audio/video
        can_subscribe: Whether participant can subscribe to others
        can_publish_data: Whether participant can publish data messages
        hidden: Whether participant is hidden from others
        recorder: Whether this is a recorder participant
        
    Returns:
        JWT token string or None if LiveKit not configured
    """
    if not livekit_configured():
        return None
    
    now = int(time.time())
    claims = {
        "iss": settings.LIVEKIT_API_KEY,
        "sub": identity,
        "nbf": now,
        "exp": now + ttl_seconds,
        "name": name,
        "video": {
            "room": room,
            "roomJoin": True,
            "canPublish": can_publish,
            "canSubscribe": can_subscribe,
            "canPublishData": can_publish_data,
            "hidden": hidden,
            "recorder": recorder,
        },
    }
    return jwt.encode(claims, settings.LIVEKIT_API_SECRET, algorithm="HS256")


def generate_recording_token(room: str, ttl_seconds: int = 7200) -> Optional[str]:
    """Generate a token for the Egress recorder."""
    return generate_livekit_token(
        identity=f"recorder-{room}",
        name="Recorder",
        room=room,
        ttl_seconds=ttl_seconds,
        can_publish=False,
        can_subscribe=True,
        can_publish_data=False,
        recorder=True,
    )


def generate_breakout_token(
    *, identity: str, name: str, main_room: str, breakout_room: str,
    ttl_seconds: int = 3600
) -> Optional[str]:
    """Generate a token for breakout room access.
    
    Note: LiveKit doesn't have native breakout rooms. This creates a token
    for a separate breakout room. The frontend handles moving participants.
    """
    return generate_livekit_token(
        identity=identity,
        name=name,
        room=breakout_room,
        ttl_seconds=ttl_seconds,
        can_publish=True,
        can_subscribe=True,
    )


class LiveKitRoomManager:
    """High-level room management operations."""
    
    def __init__(self):
        if not livekit_configured():
            raise RuntimeError("LiveKit not configured")
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.ws_url = getattr(settings, "LIVEKIT_WS_URL", "")
    
    def create_room(
        self, name: str, empty_timeout: int = 300, max_participants: int = 100,
        record: bool = False, metadata: str = ""
    ) -> Dict[str, Any]:
        """Create a LiveKit room via API.
        
        Note: This requires the LiveKit server API. For now, rooms are
        created implicitly when the first participant joins.
        """
        # In practice, LiveKit rooms are created automatically when the first
        # participant joins. This method is a placeholder for future API integration.
        return {
            "name": name,
            "empty_timeout": empty_timeout,
            "max_participants": max_participants,
            "record": record,
            "metadata": metadata,
        }
    
    def get_room_info(self, room: str) -> Optional[Dict[str, Any]]:
        """Get room information."""
        # Would use LiveKit server API
        return None
    
    def list_participants(self, room: str) -> List[Dict[str, Any]]:
        """List participants in a room."""
        return []
    
    def remove_participant(self, room: str, identity: str) -> bool:
        """Remove a participant from a room."""
        return False
    
    def start_recording(
        self, room: str, output: Dict[str, Any],
        layout: str = "speaker-dark", audio_only: bool = False
    ) -> Dict[str, Any]:
        """Start recording a room via LiveKit Egress."""
        # Would call LiveKit Egress API
        return {"egress_id": "placeholder"}
    
    def stop_recording(self, egress_id: str) -> bool:
        """Stop a recording."""
        return False


def get_livekit_manager() -> LiveKitRoomManager:
    """Get a LiveKit room manager instance."""
    return LiveKitRoomManager()


def build_join_credentials(
    *, user, live_class, can_publish: bool = False
) -> Dict[str, Any]:
    """Build join credentials for a live class.
    
    Returns a dict with provider, room, token, and WebSocket URL.
    """
    if live_class.provider == LiveClass.Provider.LIVEKIT:
        if not livekit_configured():
            return {"provider": "external", "url": live_class.join_url}
        
        room = live_class.room_name or f"class-{live_class.id}"
        token = generate_livekit_token(
            identity=str(user.id),
            name=user.full_name,
            room=room,
            can_publish=can_publish,
        )
        
        if not token:
            return {"provider": "external", "url": live_class.join_url}
        
        return {
            "provider": "livekit",
            "room": room,
            "ws_url": getattr(settings, "LIVEKIT_WS_URL", ""),
            "token": token,
            "can_publish": can_publish,
        }
    
    # External provider (Meet, Zoom, etc.)
    return {"provider": "external", "url": live_class.join_url}