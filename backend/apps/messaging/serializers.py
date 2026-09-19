"""Serializers for messages and thread summaries."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.messaging.models import Message, Notification

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)

    class Meta:
        model = Message
        fields = (
            "id", "sender", "sender_name", "recipient", "body",
            "is_read", "read_at", "created_at", "client_message_id",
        )
        read_only_fields = fields


class SendMessageSerializer(serializers.Serializer):
    recipient = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    body = serializers.CharField(max_length=5000)
    client_message_id = serializers.UUIDField()

    def validate_body(self, value):
        if not isinstance(self.initial_data.get("body"), str):
            raise serializers.ValidationError("Enter a text message.")
        return value


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "type", "title", "body", "is_read", "read_at", "object_id", "created_at")
        read_only_fields = fields


class ReadThreadSerializer(serializers.Serializer):
    through_id = serializers.IntegerField(min_value=1, max_value=9223372036854775807)


class ReportMessageSerializer(serializers.Serializer):
    message_id = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
    reason = serializers.CharField(max_length=1000)


class ThreadSummarySerializer(serializers.Serializer):
    """One conversation: the other party, the latest message, and unread count."""

    user_id = serializers.IntegerField()
    full_name = serializers.CharField()
    role = serializers.CharField()
    last_message = serializers.CharField()
    last_at = serializers.DateTimeField()
    last_from_me = serializers.BooleanField()
    unread = serializers.IntegerField()
