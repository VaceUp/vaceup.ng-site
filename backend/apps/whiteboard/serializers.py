"""Serializers for whiteboard."""
from rest_framework import serializers

from apps.whiteboard.models import WhiteboardSession, WhiteboardStroke, WhiteboardSnapshot


class WhiteboardSessionSerializer(serializers.ModelSerializer):
    """Serializer for whiteboard sessions."""

    class Meta:
        model = WhiteboardSession
        fields = (
            "id",
            "room_id",
            "crdt_state",
            "version",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "crdt_state", "version", "created_at", "updated_at")


class WhiteboardStrokeSerializer(serializers.ModelSerializer):
    """Serializer for whiteboard strokes."""

    class Meta:
        model = WhiteboardStroke
        fields = (
            "id",
            "room_id",
            "user",
            "tool",
            "color",
            "width",
            "opacity",
            "points",
            "shape_data",
            "is_eraser_stroke",
            "created_at",
        )
        read_only_fields = ("id", "user", "created_at")


class WhiteboardSnapshotSerializer(serializers.ModelSerializer):
    """Serializer for whiteboard snapshots."""

    class Meta:
        model = WhiteboardSnapshot
        fields = (
            "id",
            "room_id",
            "state_json",
            "version",
            "created_at",
        )
        read_only_fields = fields