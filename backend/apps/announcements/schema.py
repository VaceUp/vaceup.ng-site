"""Announcement list envelopes and action payloads."""
from drf_spectacular.utils import extend_schema, extend_schema_serializer, extend_schema_view, OpenApiParameter
from rest_framework import serializers

from apps.announcements.models import Announcement
from apps.announcements.serializers import (
    AnnouncementSerializer, AnnouncementCommentSerializer,
    AnnouncementCommentCreateSerializer, AnnouncementReadReceiptSerializer,
)
from apps.core.schema import DetailSerializer, PaginatedSerializer


@extend_schema_serializer(many=False)
class AnnouncementPageSerializer(PaginatedSerializer):
    results = AnnouncementSerializer(many=True)
    unread_count = serializers.IntegerField(min_value=0)


class AnnouncementReadResultSerializer(serializers.Serializer):
    read_at = serializers.DateTimeField()
    created = serializers.BooleanField()


class AnnouncementStatsSerializer(serializers.Serializer):
    total_recipients = serializers.IntegerField()
    read_count = serializers.IntegerField()
    read_rate = serializers.FloatField()
    email_sent = serializers.BooleanField()
    push_sent = serializers.BooleanField()


announcement_schema = extend_schema_view(
    list=extend_schema(responses=AnnouncementPageSerializer, parameters=[
        OpenApiParameter("status", str, enum=Announcement.Status.values),
        OpenApiParameter("target", str, enum=Announcement.Target.values),
        OpenApiParameter("course", int), OpenApiParameter("published", bool),
        OpenApiParameter("page", int),
    ]),
    publish=extend_schema(request=None, responses={200: DetailSerializer, 400: DetailSerializer}),
    unpublish=extend_schema(request=None, responses=DetailSerializer),
    send_email=extend_schema(request=None, responses={200: DetailSerializer, 400: DetailSerializer}),
    send_push=extend_schema(request=None, responses={200: DetailSerializer, 400: DetailSerializer}),
    mark_read=extend_schema(request=None, responses=AnnouncementReadResultSerializer),
    readers=extend_schema(responses=AnnouncementReadReceiptSerializer(many=True)),
    comments=extend_schema(responses=AnnouncementCommentSerializer(many=True)),
    add_comment=extend_schema(request=AnnouncementCommentCreateSerializer, responses={201: AnnouncementCommentSerializer}),
    stats=extend_schema(responses=AnnouncementStatsSerializer),
)
