"""Whiteboard endpoints and WebSocket consumer."""
import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.whiteboard import services
from apps.whiteboard.models import WhiteboardSession, WhiteboardStroke, WhiteboardSnapshot
from apps.whiteboard.serializers import (
    WhiteboardSessionSerializer,
    WhiteboardStrokeSerializer,
    WhiteboardSnapshotSerializer,
)

User = get_user_model()


class WhiteboardSessionViewSet(viewsets.GenericViewSet):
    """Whiteboard session management."""

    permission_classes = [IsAuthenticated]
    serializer_class = WhiteboardSessionSerializer

    def get_queryset(self):
        return WhiteboardSession.objects.filter(is_active=True)

    def create(self, request):
        """POST /whiteboard/sessions/ {room_id} -> create/get session."""
        room_id = request.data.get("room_id")
        
        if not room_id:
            return Response(
                {"detail": "room_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        session = services.get_or_create_session(room_id=room_id)
        serializer = WhiteboardSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        """GET /whiteboard/sessions/{room_id}/ -> get session state."""
        session = self.get_object()
        state = services.get_session_state(session.room_id)
        serializer = WhiteboardSessionSerializer(session)
        data = serializer.data
        data["state"] = state
        return Response(data)

    @action(detail=True, methods=["post"], url_path="state")
    def update_state(self, request, pk=None):
        """POST /whiteboard/sessions/{room_id}/state/ {crdt_state, version} -> update CRDT state."""
        session = self.get_object()
        crdt_state = request.data.get("crdt_state")
        version = request.data.get("version")
        
        if crdt_state is None or version is None:
            return Response(
                {"detail": "crdt_state and version are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            session = services.update_session_state(
                room_id=session.room_id,
                crdt_state=crdt_state,
                version=version,
            )
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_409_CONFLICT
            )
        
        return Response(WhiteboardSessionSerializer(session).data)

    @action(detail=True, methods=["post"], url_path="stroke")
    def add_stroke(self, request, pk=None):
        """POST /whiteboard/sessions/{room_id}/stroke/ -> record a stroke."""
        session = self.get_object()
        
        required_fields = ["tool", "color", "width", "opacity", "points"]
        for field in required_fields:
            if field not in request.data:
                return Response(
                    {"detail": f"{field} is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        stroke = services.create_stroke(
            room_id=session.room_id,
            user=request.user,
            tool=request.data["tool"],
            color=request.data["color"],
            width=request.data["width"],
            opacity=request.data["opacity"],
            points=request.data["points"],
            shape_data=request.data.get("shape_data"),
            is_eraser_stroke=request.data.get("is_eraser_stroke", False),
        )
        
        return Response(WhiteboardStrokeSerializer(stroke).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="strokes")
    def strokes(self, request, pk=None):
        """GET /whiteboard/sessions/{room_id}/strokes/ -> list strokes."""
        session = self.get_object()
        strokes = WhiteboardStroke.objects.filter(room_id=session.room_id).order_by("created_at")
        page = self.paginate_queryset(strokes)
        serializer = WhiteboardStrokeSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["post"], url_path="snapshot")
    def snapshot(self, request, pk=None):
        """POST /whiteboard/sessions/{room_id}/snapshot/ -> create snapshot."""
        session = self.get_object()
        state_json = request.data.get("state_json")
        version = request.data.get("version")
        
        if state_json is None or version is None:
            return Response(
                {"detail": "state_json and version are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        snapshot = services.create_snapshot(
            room_id=session.room_id,
            state_json=state_json,
            version=version,
        )
        
        return Response(WhiteboardSnapshotSerializer(snapshot).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="latest-snapshot")
    def latest_snapshot(self, request, pk=None):
        """GET /whiteboard/sessions/{room_id}/latest-snapshot/ -> get latest snapshot."""
        session = self.get_object()
        snapshot = WhiteboardSnapshot.objects.filter(room_id=session.room_id).first()
        if not snapshot:
            return Response({"detail": "No snapshot found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(WhiteboardSnapshotSerializer(snapshot).data)


class WhiteboardConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time collaborative whiteboard."""
    
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group = f"whiteboard_{self.room_id}"
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group,
            self.channel_name
        )
        
        await self.accept()
        
        # Notify others of join
        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "user_joined",
                "user_id": str(self.user.id),
                "user_name": self.user.full_name,
                "channel_name": self.channel_name,
            }
        )
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_discard(
                self.room_group,
                self.channel_name
            )
            
            # Notify others of leave
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "user_left",
                    "user_id": str(self.user.id),
                }
            )
    
    async def receive_json(self, content):
        """Handle incoming messages from client."""
        message_type = content.get("type")
        
        if message_type == "doc_update":
            # Broadcast CRDT update to others
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "doc_update",
                    "payload": content.get("payload"),
                    "client_id": content.get("client_id"),
                    "version": content.get("version"),
                    "sender_channel": self.channel_name,
                }
            )
        elif message_type == "stroke":
            # Broadcast stroke to others
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "stroke_broadcast",
                    "user_id": str(self.user.id),
                    "user_name": self.user.full_name,
                    "tool": content.get("tool"),
                    "color": content.get("color"),
                    "width": content.get("width"),
                    "opacity": content.get("opacity"),
                    "points": content.get("points"),
                    "shape_data": content.get("shape_data"),
                    "is_eraser_stroke": content.get("is_eraser_stroke", False),
                }
            )
        elif message_type == "erase":
            # Broadcast erase to others
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "erase_broadcast",
                    "stroke_ids": content.get("stroke_ids", []),
                    "user_id": str(self.user.id),
                }
            )
        elif message_type == "cursor":
            # Broadcast cursor position
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "cursor_update",
                    "user_id": str(self.user.id),
                    "user_name": self.user.full_name,
                    "position": content.get("position"),
                }
            )
        elif message_type == "undo":
            # Broadcast undo
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "undo_broadcast",
                    "user_id": str(self.user.id),
                }
            )
        elif message_type == "redo":
            # Broadcast redo
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "redo_broadcast",
                    "user_id": str(self.user.id),
                }
            )
        elif message_type == "viewport":
            # Broadcast viewport sync (optional)
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "viewport_update",
                    "user_id": str(self.user.id),
                    "viewport": content.get("viewport"),
                }
            )
    
    # Handlers for messages from channel layer
    async def doc_update(self, event):
        if event["sender_channel"] != self.channel_name:
            await self.send_json({
                "type": "doc_update",
                "payload": event["payload"],
                "client_id": event["client_id"],
                "version": event["version"],
            })
    
    async def stroke_broadcast(self, event):
        if event["user_id"] != str(self.user.id):
            await self.send_json({
                "type": "stroke_broadcast",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
                "tool": event["tool"],
                "color": event["color"],
                "width": event["width"],
                "opacity": event["opacity"],
                "points": event["points"],
                "shape_data": event.get("shape_data"),
                "is_eraser_stroke": event.get("is_eraser_stroke", False),
            })
    
    async def erase_broadcast(self, event):
        await self.send_json({
            "type": "erase_broadcast",
            "stroke_ids": event["stroke_ids"],
            "user_id": event["user_id"],
        })
    
    async def cursor_update(self, event):
        if event["user_id"] != str(self.user.id):
            await self.send_json({
                "type": "cursor_update",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
                "position": event["position"],
            })
    
    async def undo_broadcast(self, event):
        if event["user_id"] != str(self.user.id):
            await self.send_json({
                "type": "undo_broadcast",
                "user_id": event["user_id"],
            })
    
    async def redo_broadcast(self, event):
        if event["user_id"] != str(self.user.id):
            await self.send_json({
                "type": "redo_broadcast",
                "user_id": event["user_id"],
            })
    
    async def viewport_update(self, event):
        if event["user_id"] != str(self.user.id):
            await self.send_json({
                "type": "viewport_update",
                "user_id": event["user_id"],
                "viewport": event["viewport"],
            })
    
    async def user_joined(self, event):
        if event["channel_name"] != self.channel_name:
            await self.send_json({
                "type": "user_joined",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
            })
    
    async def user_left(self, event):
        await self.send_json({
            "type": "user_left",
            "user_id": event["user_id"],
        })