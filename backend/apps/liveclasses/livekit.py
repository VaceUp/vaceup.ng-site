"""LiveKit access-token minting and room management (native video provider).

Best-effort JWT per the LiveKit spec (HS256, video grant). Verify against your
LiveKit server version before relying on it in production. Returns ``None`` when
LiveKit isn't configured, in which case callers fall back to an external link.
PyJWT ships as a dependency of djangorestframework-simplejwt.
"""
from __future__ import annotations

import time
from typing import Optional, List, Dict, Any
from urllib.parse import urlsplit

from django.conf import settings
import jwt

from apps.liveclasses.models import LiveClass


def livekit_ws_url() -> str:
    """The address the browser dials, repaired to what the LiveKit client accepts.

    A project address is usually pasted as ``https://…`` or as a bare host, and
    the client only speaks ws:// and wss://. Handing it anything else fails in the
    browser as "Failed to construct 'URL'", which reads to the academy like a
    broken meeting rather than a missing setting. Empty means there is no usable
    address, so callers refuse the room with a sentence instead of a stack trace.
    """
    raw = str(getattr(settings, "LIVEKIT_WS_URL", "") or "").strip()
    if not raw:
        return ""
    parts = urlsplit(raw if "://" in raw else f"wss://{raw}")
    scheme = parts.scheme.lower()
    if scheme in {"http", "https"}:
        scheme = "ws" if scheme == "http" else "wss"
    # A pasted sentence, or a value cut short by an inline comment, is not a host.
    if scheme not in {"ws", "wss"} or not parts.netloc or any(c.isspace() for c in parts.netloc):
        return ""
    return f"{scheme}://{parts.netloc}{parts.path.rstrip('/')}"


def missing_livekit_settings() -> List[str]:
    """Which settings have to be added before a room will open on this server."""
    missing = []
    if not getattr(settings, "LIVEKIT_API_KEY", ""):
        missing.append("LIVEKIT_API_KEY")
    if not getattr(settings, "LIVEKIT_API_SECRET", ""):
        missing.append("LIVEKIT_API_SECRET")
    if not livekit_ws_url():
        missing.append("LIVEKIT_WS_URL")
    return missing


def missing_settings_advice() -> str:
    """The fix, named exactly, for whoever is reading the screen."""
    missing = missing_livekit_settings()
    if not missing:
        return ""
    if len(missing) == 1:
        listed = missing[0]
    else:
        listed = f"{', '.join(missing[:-1])} and {missing[-1]}"
    return f"Add {listed} to the server's .env file and restart the app."


def livekit_configured() -> bool:
    """Whether this server can actually take somebody into a room."""
    return not missing_livekit_settings()


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
        self.ws_url = livekit_ws_url()
    
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
            "ws_url": livekit_ws_url(),
            "token": token,
            "can_publish": can_publish,
        }
    
    # External provider (Meet, Zoom, etc.)
    return {"provider": "external", "url": live_class.join_url}