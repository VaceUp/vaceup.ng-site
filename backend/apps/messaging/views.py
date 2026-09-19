"""Scoped HTTP messaging and notifications, suitable for cPanel/WSGI."""
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.messaging import services
from apps.messaging.models import MessageBlock, Notification
from apps.messaging.pagination import MessagingPagination, query_integer
from apps.messaging.serializers import (
    MessageSerializer, NotificationSerializer, ReadThreadSerializer,
    ReportMessageSerializer, SendMessageSerializer, ThreadSummarySerializer,
)

User = get_user_model()


def contact_data(user):
    return {"user_id": user.pk, "full_name": user.full_name, "role": user.role}


class ActiveAccount(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and services.active_account(request.user) is not None


class MessageViewSet(viewsets.GenericViewSet):
    permission_classes = [ActiveAccount]
    serializer_class = MessageSerializer
    pagination_class = MessagingPagination

    def create(self, request):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message, created = services.send_message(sender=request.user, **serializer.validated_data)
        return Response(MessageSerializer(message).data, status=201 if created else 200)

    def list(self, request):
        rows = self.paginate_queryset(services.thread_summaries(request.user))
        data = [
            {**contact_data(user), "last_message": user.last_message,
             "last_at": user.last_at, "last_from_me": user.last_sender_id == request.user.pk,
             "unread": user.unread}
            for user in rows
        ]
        return self.get_paginated_response(ThreadSummarySerializer(data, many=True).data)

    @action(detail=False, methods=["get"])
    def contacts(self, request):
        users = services.authorized_contacts(request.user)
        search = request.query_params.get("search", "").strip()
        if len(search) > 100 or len(request.query_params.getlist("search")) > 1:
            raise ValidationError({"search": "Use one name search of at most 100 characters."})
        if search:
            users = users.filter(full_name__icontains=search)
        rows = self.paginate_queryset(users.only("id", "full_name", "role").order_by("full_name", "id"))
        return self.get_paginated_response([contact_data(user) for user in rows])

    @action(detail=False, methods=["get"])
    def thread(self, request):
        params = request.query_params
        other = get_object_or_404(User, pk=query_integer(params, "with"))
        messages = services.thread_between(request.user, other)
        size = query_integer(params, "page_size", default=50, maximum=100)
        forward = "after_id" in params
        if forward and "before_id" in params:
            raise ValidationError("Use either before_id or after_id, not both.")
        boundary_key = "after_id" if forward else "before_id"
        boundary = query_integer(params, boundary_key, default=0, minimum=0 if forward else 1)
        if boundary and not messages.filter(pk=boundary).exists():
            raise ValidationError({boundary_key: "Choose a message in this conversation."})
        if forward:
            messages = messages.filter(id__gt=boundary).order_by("id")
        elif boundary:
            messages = messages.filter(id__lt=boundary)
        count = messages.count()
        fetched = list(messages[:size + 1])
        has_more = len(fetched) > size
        rows = fetched[:size]
        next_id = rows[-1].pk if has_more else None
        next_url = None
        if has_more:
            query = params.copy()
            query[boundary_key] = str(next_id)
            query["page_size"] = str(size)
            next_url = request.build_absolute_uri(request.path + "?" + query.urlencode())
        return Response({
            "count": count, "next": next_url, "previous": None,
            "results": MessageSerializer(rows, many=True).data, "has_more": has_more,
            "next_before_id": next_id if not forward else None,
            "next_after_id": next_id if forward else None,
        })

    @action(detail=False, methods=["post"])
    def read(self, request):
        serializer = ReadThreadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        other = self._body_user(request, "with")
        updated = services.mark_thread_read(user=request.user, other=other, **serializer.validated_data)
        return Response({"updated": updated, "unread": services.unread_count(request.user)})

    @staticmethod
    def _body_user(request, key="user_id"):
        field = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
        user_id = field.run_validation(request.data.get(key))
        return get_object_or_404(User, pk=user_id)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"unread": services.unread_count(request.user)})

    @action(detail=False, methods=["post"])
    def block(self, request):
        other = self._body_user(request)
        services.block_user(user=request.user, other=other)
        return Response({"user_id": other.pk, "blocked": True})

    @action(detail=False, methods=["get"])
    def blocks(self, request):
        users = User.objects.filter(pk__in=MessageBlock.objects.filter(blocker=request.user).values("blocked_id"))
        rows = self.paginate_queryset(users.order_by("full_name", "id"))
        return self.get_paginated_response([contact_data(user) for user in rows])

    @action(detail=False, methods=["post"])
    def unblock(self, request):
        other = self._body_user(request)
        services.unblock_user(user=request.user, other=other)
        return Response({"user_id": other.pk, "blocked": False})

    @action(detail=False, methods=["post"])
    def report(self, request):
        serializer = ReportMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report, created = services.report_message(user=request.user, **serializer.validated_data)
        return Response({"id": report.pk, "message_id": report.message_id,
                         "reason": report.reason, "created_at": report.created_at},
                        status=201 if created else 200)


class NotificationViewSet(viewsets.GenericViewSet):
    permission_classes = [ActiveAccount]
    serializer_class = NotificationSerializer
    pagination_class = MessagingPagination

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by("-id")

    def list(self, request):
        rows = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(NotificationSerializer(rows, many=True).data)

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        Notification.objects.filter(pk=notification.pk, is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"status": "marked as read"})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"unread": self.get_queryset().filter(is_read=False).count()})
