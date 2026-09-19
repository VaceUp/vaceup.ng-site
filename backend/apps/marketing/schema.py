"""Contracts for campaign actions and public email tracking endpoints."""
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer, OpenApiParameter, OpenApiResponse, OpenApiTypes
from rest_framework import serializers

from apps.core.schema import DetailSerializer
from apps.marketing.serializers import (
    EmailCampaignSerializer, EmailCampaignStatsSerializer, EmailRecipientSerializer, EmailLogSerializer,
)


campaign_schema = extend_schema_view(
    preview=extend_schema(request=None, responses={200: DetailSerializer, 400: DetailSerializer}),
    schedule=extend_schema(request=inline_serializer(name="CampaignSchedule", fields={
        "scheduled_at": serializers.DateTimeField(required=False),
    }), responses={200: EmailCampaignSerializer, 400: DetailSerializer}),
    send_now=extend_schema(request=None, responses={200: DetailSerializer, 400: DetailSerializer}),
    pause=extend_schema(request=None, responses={200: DetailSerializer, 400: DetailSerializer}),
    resume=extend_schema(request=None, responses={200: DetailSerializer, 400: DetailSerializer}),
    cancel=extend_schema(request=None, responses={200: DetailSerializer, 400: DetailSerializer}),
    stats=extend_schema(responses=EmailCampaignStatsSerializer),
    recipients=extend_schema(responses=EmailRecipientSerializer(many=True), parameters=[OpenApiParameter("status", str)]),
    logs=extend_schema(responses=EmailLogSerializer(many=True), parameters=[OpenApiParameter("event_type", str)]),
)

track_open_schema = extend_schema(responses={(200, "image/gif"): OpenApiTypes.BINARY})
track_click_schema = extend_schema(parameters=[
    OpenApiParameter("url", str),
    OpenApiParameter("Location", str, location=OpenApiParameter.HEADER, response=[302]),
], responses={302: OpenApiResponse(description="Redirect to the tracked destination.")})
unsubscribe_link_schema = extend_schema(responses={
    (200, "text/html"): OpenApiTypes.STR, (404, "text/html"): OpenApiTypes.STR,
})
unsubscribe_form_schema = extend_schema(request=inline_serializer(name="UnsubscribeEmail", fields={
    "email": serializers.EmailField(),
}), responses={200: DetailSerializer, 400: DetailSerializer})
