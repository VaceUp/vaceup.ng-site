"""Code Editor endpoints and WebSocket consumer."""
import asyncio
import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.codeeditor import services
from apps.codeeditor.models import CodeEditorSession, CodeExecution
from apps.codeeditor.serializers import (
    CodeEditorSessionSerializer,
    CodeExecutionSerializer,
    CodeExecutionCreateSerializer,
)

User = get_user_model()


class CodeEditorSessionViewSet(viewsets.GenericViewSet):
    """Code editor session management."""

    permission_classes = [IsAuthenticated]
    serializer_class = CodeEditorSessionSerializer

    def get_queryset(self):
        return CodeEditorSession.objects.filter(is_active=True)

    def create(self, request):
        """POST /code-editor/sessions/ {room_id, language} -> create/get session."""
        room_id = request.data.get("room_id")
        language = request.data.get("language", "python")
        
        if not room_id:
            return Response(
                {"detail": "room_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        session = services.get_or_create_session(room_id=room_id, language=language)
        serializer = CodeEditorSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        """GET /code-editor/sessions/{room_id}/ -> get session state."""
        session = self.get_object()
        state = services.get_session_state(session.room_id)
        serializer = CodeEditorSessionSerializer(session)
        data = serializer.data
        data["state"] = state
        return Response(data)

    @action(detail=True, methods=["post"], url_path="state")
    def update_state(self, request, pk=None):
        """POST /code-editor/sessions/{room_id}/state/ {crdt_state, version} -> update CRDT state."""
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
        
        return Response(CodeEditorSessionSerializer(session).data)

    @action(detail=True, methods=["post"], url_path="execute")
    async def execute(self, request, pk=None):
        """POST /code-editor/sessions/{room_id}/execute/ {code, language, stdin} -> execute code."""
        session = self.get_object()
        serializer = CodeExecutionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        code = serializer.validated_data["code"]
        language = serializer.validated_data["language"]
        stdin = serializer.validated_data.get("stdin", "")
        
        try:
            # Execute code asynchronously
            result = await services.execute_code(
                code=code,
                language=language,
                stdin=serializer.validated_data.get("stdin", ""),
            )
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Record execution
        execution = services.record_execution(
            session=session,
            user=request.user,
            code=code,
            language=language,
            stdin=stdin,
            result=result,
        )
        
        return Response(CodeExecutionSerializer(execution).data)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        """GET /code-editor/sessions/{room_id}/history/ -> execution history."""
        session = self.get_object()
        executions = CodeExecution.objects.filter(session=session).order_by("-created_at")
        page = self.paginate_queryset(executions)
        serializer = CodeExecutionSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


class CodeEditorConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time collaborative code editing (Yjs CRDT)."""
    
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return
        
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group = f"code_{self.room_id}"
        
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
        elif message_type == "cursor":
            # Broadcast cursor position
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "cursor_update",
                    "user_id": str(self.user.id),
                    "user_name": self.user.full_name,
                    "position": content.get("position"),
                    "selection": content.get("selection"),
                }
            )
        elif message_type == "awareness":
            # Broadcast awareness (selection, cursor, etc.)
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "awareness_update",
                    "user_id": str(self.user.id),
                    "user_name": self.user.full_name,
                    "states": content.get("states"),
                }
            )
        elif message_type == "execute":
            # Execute code (handled via HTTP, but can be triggered via WS)
            pass
    
    # Handlers for messages from channel layer
    async def doc_update(self, event):
        if event["sender_channel"] != self.channel_name:
            await self.send_json({
                "type": "doc_update",
                "payload": event["payload"],
                "client_id": event["client_id"],
                "version": event["version"],
            })
    
    async def cursor_update(self, event):
        if event["user_id"] != str(self.user.id):
            await self.send_json({
                "type": "cursor_update",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
                "position": event["position"],
                "selection": event.get("selection"),
            })
    
    async def awareness_update(self, event):
        if event["user_id"] != str(self.user.id):
            await self.send_json({
                "type": "awareness_update",
                "user_id": event["user_id"],
                "user_name": event["user_name"],
                "states": event["states"],
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