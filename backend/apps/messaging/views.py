"""Messaging endpoints: send, thread list, one thread, unread count."""
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.messaging import services
from apps.messaging.models import Notification
from apps.messaging.serializers import (
    MessageSerializer,
    SendMessageSerializer,
    ThreadSummarySerializer,
)

User = get_user_model()


class MessageViewSet(viewsets.GenericViewSet):
    """Direct messaging. All actions are scoped to the authenticated user."""

    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer

    def create(self, request):
        """POST /messages/ {recipient, body} → send a message."""
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = services.send_message(
            sender=request.user,
            recipient=serializer.validated_data["recipient"],
            body=serializer.validated_data["body"],
        )
        return Response(MessageSerializer(message).data,
                        status=status.HTTP_201_CREATED)

    def list(self, request):
        """GET /messages/ → conversation summaries (latest + unread per party)."""
        user = request.user
        threads = {}
        for m in services.thread_between_all(user):
            other = m.recipient if m.sender_id == user.id else m.sender
            t = threads.get(other.id)
            if t is None:
                t = {"user_id": other.id, "full_name": other.full_name,
                     "role": other.role, "unread": 0}
                threads[other.id] = t
            # Messages arrive oldest-first, so the last seen is the latest.
            t["last_message"] = m.body
            t["last_at"] = m.created_at
            t["last_from_me"] = m.sender_id == user.id
            if m.recipient_id == user.id and not m.is_read:
                t["unread"] += 1
        data = sorted(threads.values(), key=lambda t: t["last_at"], reverse=True)
        return Response(ThreadSummarySerializer(data, many=True).data)

    @action(detail=False, methods=["get"])
    def thread(self, request):
        """GET /messages/thread/?with=<user_id> → the conversation (marks read)."""
        other = get_object_or_404(User, pk=request.query_params.get("with"))
        services.mark_thread_read(user=request.user, other=other)
        messages = services.thread_between(request.user, other)
        page = self.paginate_queryset(messages)
        serializer = MessageSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """GET /messages/unread-count/ → total unread messages for the user."""
        return Response({"unread": services.unread_count(request.user)})


class NotificationViewSet(viewsets.GenericViewSet):
    """In-app notification feed for system events.

    Actions:
      GET    /notifications/         - list notifications (mark read on view)
      POST   /notifications/{id}/read/ - mark a single notification read
      GET    /notifications/unread-count/ - total unread count
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /notifications/ - list notifications, mark read on access."""
        user = request.user
        notifications = Notification.objects.filter(recipient=user).order_by("-created_at")
        # Mark as read when listing
        notifications.update(is_read=True, read_at=timezone.now())
        serializer = MessageSerializer(notifications, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        """POST /notifications/{id}/read/ - mark a single notification as read."""
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        return Response({"status": "marked as read"})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """GET /notifications/unread-count/ - total unread count."""
        return Response({"unread": Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()})
