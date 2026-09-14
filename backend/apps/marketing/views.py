"""Admin campaign authoring and explicitly confirmed delivery."""
from django.db import transaction
from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.mail_delivery import classify_delivery_failure
from apps.core.exceptions import DomainError, IllegalStateTransition
from apps.core.permissions import IsAdmin
from . import services
from .models import EmailCampaign, EmailRecipient, EmailLog, EmailSuppression, EmailTemplate
from .serializers import (EmailCampaignSerializer, EmailCampaignCreateSerializer,
    EmailRecipientSerializer, EmailTemplateSerializer, EmailLogSerializer, EmailSuppressionSerializer)


class EmailCampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    queryset = EmailCampaign.objects.select_related("created_by", "template").prefetch_related("target_courses")
    serializer_class = EmailCampaignSerializer

    def get_serializer_class(self):
        return EmailCampaignCreateSerializer if self.action in ("create", "update", "partial_update") else EmailCampaignSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        # Serialize editing against queueing so approved content cannot change.
        EmailCampaign.objects.select_for_update().get(pk=self.get_object().pk)
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def perform_destroy(self, instance):
        campaign = EmailCampaign.objects.select_for_update().get(pk=instance.pk)
        if campaign.status != "draft" or campaign.recipients.exists():
            raise IllegalStateTransition("Only unsent drafts can be deleted. Cancel an active campaign instead.")
        campaign.delete()

    @action(detail=True, methods=["get"])
    def audience(self, request, pk=None):
        response = Response(services.audience_preview(self.get_object()))
        response["Cache-Control"] = "no-store"
        return response

    @action(detail=True, methods=["post"])
    def preview(self, request, pk=None):
        try:
            services.send_message(self.get_object(), request.user.email)
        except Exception as exc:
            failure = classify_delivery_failure(exc)
            raise DomainError(f"{failure.code}: {failure.action}")
        return Response({"detail": "SMTP accepted a preview for your admin email. Check your inbox and spam folder."})

    def queue(self, request, scheduled_at=None):
        campaign = services.schedule_campaign(self.get_object().pk, request.data.get("confirmation"), scheduled_at)
        return Response(EmailCampaignSerializer(campaign).data)

    @action(detail=True, methods=["post"], url_path="send-now")
    def send_now(self, request, pk=None):
        return self.queue(request)

    @action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        try:
            date = parse_datetime(request.data.get("scheduled_at", ""))
        except (TypeError, ValueError):
            date = None
        if not date or timezone.is_naive(date) or date <= timezone.now():
            raise serializers.ValidationError({"scheduled_at": "Choose a future date including its timezone."})
        return self.queue(request, date)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return Response(EmailCampaignSerializer(services.change_state(self.get_object().pk, "pause")).data)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        return Response(EmailCampaignSerializer(services.change_state(self.get_object().pk, "resume")).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return Response(EmailCampaignSerializer(services.change_state(self.get_object().pk, "cancel")).data)

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        campaign = self.get_object()
        return Response({"total_recipients": campaign.total_recipients,
            "status_breakdown": dict(campaign.recipients.values_list("status").annotate(count=Count("pk"))),
            "sent_count": campaign.sent_count, "failed_count": campaign.failed_count,
            "delivery_note": "Sent means SMTP accepted, not confirmed inbox delivery. Open/click tracking is disabled."})

    @action(detail=True, methods=["get"])
    def recipients(self, request, pk=None):
        query = self.get_object().recipients.select_related("user").all()
        if request.query_params.get("status"):
            query = query.filter(status=request.query_params["status"])
        page = self.paginate_queryset(query)
        return self.get_paginated_response(EmailRecipientSerializer(page, many=True).data)

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        page = self.paginate_queryset(self.get_object().logs.all())
        return self.get_paginated_response(EmailLogSerializer(page, many=True).data)


class EmailTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = EmailTemplateSerializer
    queryset = EmailTemplate.objects.all()


class EmailRecipientViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = EmailRecipientSerializer
    queryset = EmailRecipient.objects.select_related("user", "campaign").all()
    filterset_fields = ["campaign", "status"]


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = EmailLogSerializer
    queryset = EmailLog.objects.all()
    filterset_fields = ["campaign", "event_type"]


class EmailSuppressionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = EmailSuppressionSerializer
    queryset = EmailSuppression.objects.all()


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def track_open(request, token):
    return HttpResponse(status=204)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def track_click(request, token):
    # Do not expose the previous arbitrary-URL open redirect.
    return Response({"detail": "Click tracking is disabled."}, status=410)


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def unsubscribe(request, token):
    if not EmailRecipient.objects.filter(unsubscribe_token=token).exclude(unsubscribe_token="").exists():
        return Response({"detail": "Invalid unsubscribe link."}, status=404)
    if request.method == "POST":
        services.handle_unsubscribe(token)
        response = HttpResponse("You will no longer receive marketing email. Account and security emails are unchanged.", content_type="text/plain")
    else:
        # GET is deliberately read-only: email scanners must not unsubscribe users.
        response = HttpResponse('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>VaceUp email preferences</title><main><h1>Stop marketing emails?</h1><p>Account and security emails will continue.</p><form method="post"><button type="submit">Unsubscribe from marketing</button></form></main></html>')
    response["Cache-Control"] = "no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def unsubscribe_web(request):
    # Only an authenticated account or an unguessable personal link may opt out.
    from .models import EmailUnsubscribe
    import uuid
    EmailUnsubscribe.objects.update_or_create(user=request.user, defaults={
        "marketing_emails": False, "promotional_offers": False, "unsubscribe_token": uuid.uuid4().hex})
    return Response({"detail": "Marketing emails disabled for your account."})
