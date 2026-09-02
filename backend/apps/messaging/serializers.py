"""Serializers for messages and thread summaries."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.messaging.models import Message

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)

    class Meta:
        model = Message
        fields = (
            "id", "sender", "sender_name", "recipient", "body",
            "is_read", "read_at", "created_at",
        )
        read_only_fields = fields


class SendMessageSerializer(serializers.Serializer):
    recipient = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    body = serializers.CharField(max_length=5000)


class ThreadSummarySerializer(serializers.Serializer):
    """One conversation: the other party, the latest message, and unread count."""

    user_id = serializers.IntegerField()
    full_name = serializers.CharField()
    role = serializers.CharField()
    last_message = serializers.CharField()
    last_at = serializers.DateTimeField()
    last_from_me = serializers.BooleanField()
    unread = serializers.IntegerField()
