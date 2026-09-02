"""Serializers for code editor."""
from rest_framework import serializers

from apps.codeeditor.models import CodeEditorSession, CodeExecution


class CodeEditorSessionSerializer(serializers.ModelSerializer):
    """Serializer for code editor sessions."""

    class Meta:
        model = CodeEditorSession
        fields = (
            "id",
            "room_id",
            "language",
            "crdt_state",
            "version",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "crdt_state", "version", "created_at", "updated_at")


class CodeExecutionSerializer(serializers.ModelSerializer):
    """Serializer for code execution records."""

    class Meta:
        model = CodeExecution
        fields = (
            "id",
            "session",
            "user",
            "code",
            "language",
            "stdin",
            "stdout",
            "stderr",
            "exit_code",
            "duration_ms",
            "memory_mb",
            "is_success",
            "created_at",
        )
        read_only_fields = fields


class CodeExecutionCreateSerializer(serializers.Serializer):
    """Serializer for creating a code execution request."""

    code = serializers.CharField()
    language = serializers.ChoiceField(choices=CodeEditorSession.Language.choices)
    stdin = serializers.CharField(required=False, allow_blank=True)