"""Marketing email endpoints."""
import uuid
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import models
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response

from apps.marketing import services
from apps.marketing.models import (
    EmailCampaign,
    EmailRecipient,
    EmailLog,
    EmailSuppression,
    EmailUnsubscribe,
    EmailTemplate,
)
from apps.marketing.serializers import (
    EmailCampaignSerializer,
    EmailCampaignCreateSerializer,
    EmailCampaignStatsSerializer,
    EmailRecipientSerializer,
    EmailTemplateSerializer,
    EmailLogSerializer,
    EmailSuppressionSerializer,
    EmailUnsubscribeSerializer,
    EmailCampaignCreateSerializer,
)
from apps.core.exceptions import DomainError
from apps.core.permissions import IsAdmin


class IsAdmin(BasePermission):
    """Permission: admin only."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_admin
        )


class EmailTemplateViewSet(viewsets.ModelViewSet):
    """Email template management."""
    permission_classes = [IsAdmin]
    serializer_class = EmailTemplateSerializer
    queryset = EmailTemplate.objects.filter(is_active=True)
    filterset_fields = ["is_active"]
    search_fields = ["name", "subject"]


class EmailCampaignViewSet(viewsets.ModelViewSet):
    """Email campaign management."""
    permission_classes = [IsAdmin]
    serializer_class = EmailCampaignSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return EmailCampaignCreateSerializer
        if self.action == "retrieve":
            return EmailCampaignSerializer
        if self.action in ("update", "partial_update"):
            return EmailCampaignCreateSerializer
        return EmailCampaignSerializer

    def get_queryset(self):
        return EmailCampaign.objects.select_related("template", "created_by").prefetch_related("target_courses").all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="preview")
    def preview(self, request, pk=None):
        """POST /campaigns/{id}/preview/ - send test email to admin."""
        campaign = self.get_object()
        admin_email = request.user.email
        
        # Create a temporary recipient for preview
        from apps.marketing.models import EmailRecipient
        import uuid
        
        recipient = EmailRecipient.objects.create(
            campaign_id=campaign.pk,
            user=request.user,
            email=request.user.email,
            status=EmailRecipient.Status.PENDING,
            open_token=uuid.uuid4().hex,
            click_token=uuid.uuid4().hex,
            unsubscribe_token=uuid.uuid4().hex,
        )
        
        try:
            from apps.marketing import services
            subject, html_content, text_content = services.build_email_content(campaign, recipient)
            
            # Send test email
            from django.core.mail import EmailMultiAlternatives
            email = EmailMultiAlternatives(
                subject=f"[PREVIEW] {campaign.subject}",
                body="",
                from_email=f"{campaign.from_name} <{campaign.from_email}>",
                to=[request.user.email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
            
            return Response({"detail": "Preview email sent."})
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

    @action(detail=True, methods=["post"], url_path="schedule")
    def schedule(self, request, pk=None):
        """POST /campaigns/{id}/schedule/ - schedule campaign."""
        campaign = self.get_object()
        scheduled_at = request.data.get("scheduled_at")
        
        if campaign.status != "draft":
            return Response({"detail": "Only draft campaigns can be scheduled."}, status=400)
        
        if scheduled_at:
            from django.utils.dateparse import parse_datetime
            campaign.scheduled_at = parse_datetime(scheduled_at)
            if not campaign.scheduled_at:
                return Response({"detail": "Invalid scheduled_at format."}, status=400)
        
        campaign = services.schedule_campaign(campaign.pk)
        return Response(EmailCampaignSerializer(campaign).data)

    @action(detail=True, methods=["post"], url_path="send-now")
    def send_now(self, request, pk=None):
        """POST /campaigns/{id}/send-now/ - send immediately."""
        campaign = self.get_object()
        if campaign.status not in ["draft", "scheduled"]:
            return Response({"detail": "Campaign not in sendable state."}, status=400)
        
        campaign = services.schedule_campaign(campaign.pk)
        return Response({"detail": "Campaign queued for sending."})

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        """POST /campaigns/{id}/pause/ - pause sending."""
        campaign = self.get_object()
        if campaign.status not in ["sending", "scheduled"]:
            return Response({"detail": "Campaign not in sendable state."}, status=400)
        
        campaign.status = "paused"
        campaign.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Campaign paused."})

    @action(detail=True, methods=["post"], url_path="resume")
    def resume(self, request, pk=None):
        """POST /campaigns/{id}/resume/ - resume paused campaign."""
        campaign = self.get_object()
        if campaign.status != "paused":
            return Response({"detail": "Campaign not paused."}, status=400)
        
        campaign.status = "scheduled"
        campaign.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Campaign resumed."})

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """POST /campaigns/{id}/cancel/ - cancel campaign."""
        campaign = self.get_object()
        if campaign.status in ["sent", "cancelled"]:
            return Response({"detail": "Cannot cancel."}, status=400)
        
        campaign.status = "cancelled"
        campaign.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Campaign cancelled."})

    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        """GET /campaigns/{id}/stats/ - campaign statistics."""
        campaign = self.get_object()
        
        from apps.marketing.models import EmailRecipient
        from django.db import models
        status_counts = EmailRecipient.objects.filter(campaign_id=campaign.pk).values("status").annotate(
            count=models.Count("id")
        )
        status_breakdown = {item["status"]: item["status__count"] for item in status_counts}
        
        return Response(EmailCampaignStatsSerializer({
            "total_recipients": campaign.total_recipients,
            "sent_count": campaign.sent_count,
            "delivered_count": campaign.delivered_count,
            "opened_count": campaign.opened_count,
            "clicked_count": campaign.clicked_count,
            "bounced_count": campaign.bounced_count,
            "unsubscribed_count": campaign.unsubscribed_count,
            "failed_count": campaign.failed_count,
            "open_rate": campaign.open_rate,
            "click_rate": campaign.click_rate,
            "status_breakdown": status_breakdown,
        }).data)

    @action(detail=True, methods=["get"], url_path="recipients")
    def recipients(self, request, pk=None):
        """GET /campaigns/{id}/recipients/ - list recipients with filters."""
        campaign = self.get_object()
        queryset = campaign.recipients.select_related("user").all()
        
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        page = self.paginate_queryset(queryset)
        serializer = EmailRecipientSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["get"], url_path="logs")
    def logs(self, request, pk=None):
        """GET /campaigns/{id}/logs/ - campaign email logs."""
        campaign = self.get_object()
        logs = campaign.logs.select_related("recipient").order_by("-timestamp")
        
        event_type = request.query_params.get("event_type")
        if event_type:
            logs = logs.filter(event_type=event_type)
        
        page = self.paginate_queryset(logs)
        serializer = EmailLogSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


class EmailTemplateViewSet(viewsets.ModelViewSet):
    """Email template management."""
    permission_classes = [IsAdmin]
    serializer_class = EmailTemplateSerializer
    queryset = EmailTemplate.objects.filter(is_active=True)
    filterset_fields = ["is_active"]
    search_fields = ["name", "subject"]


class EmailRecipientViewSet(viewsets.ReadOnlyModelViewSet):
    """View individual recipients."""
    permission_classes = [IsAdmin]
    serializer_class = EmailRecipientSerializer
    queryset = EmailRecipient.objects.select_related("campaign", "user").all()
    filterset_fields = ["campaign", "status"]
    search_fields = ["email", "user__full_name", "user__email"]


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    """View email logs."""
    permission_classes = [IsAdmin]
    serializer_class = EmailLogSerializer
    queryset = EmailLog.objects.select_related("campaign", "recipient").all()
    filterset_fields = ["campaign", "event_type", "recipient"]
    ordering = ["-timestamp"]


class EmailSuppressionViewSet(viewsets.ReadOnlyModelViewSet):
    """View email suppressions."""
    permission_classes = [IsAdmin]
    serializer_class = EmailSuppressionSerializer
    queryset = EmailSuppression.objects.select_related("campaign", "user").all()
    filterset_fields = ["reason", "campaign"]
    search_fields = ["email"]


class EmailUnsubscribeViewSet(viewsets.GenericViewSet):
    """Manage unsubscribe preferences."""
    permission_classes = [IsAuthenticated]
    serializer_class = EmailUnsubscribeSerializer

    def get_object(self):
        obj, _ = EmailUnsubscribe.objects.get_or_create(user=self.request.user)
        return obj

    def retrieve(self, request, *args, **kwargs):
        return self.retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="unsubscribe-all")
    def unsubscribe_all(self, request):
        """Unsubscribe from all emails."""
        prefs, _ = EmailUnsubscribe.objects.get_or_create(user=request.user)
        prefs.unsubscribe_all = True
        prefs.save()
        return Response({"detail": "Unsubscribed from all emails."})

    @action(detail=False, methods=["post"], url_path="resubscribe")
    def resubscribe(self, request):
        """Resubscribe to all emails."""
        prefs = EmailUnsubscribe.objects.get(user=request.user)
        prefs.unsubscribe_all = False
        prefs.save()
        return Response({"detail": "Resubscribed successfully."})


@csrf_exempt
@api_view(["GET"])
@permission_classes([AllowAny])
def track_open(request, token):
    """Track email open via pixel."""
    from apps.marketing import services
    return services.track_open(token, request)


@csrf_exempt
@api_view(["GET"])
@permission_classes([AllowAny])
def track_click(request, token):
    """Track click and redirect."""
    from apps.marketing import services
    url = request.GET.get("url", "/")
    return services.track_click(token, url, request)


@csrf_exempt
@api_view(["GET"])
@permission_classes([AllowAny])
def unsubscribe(request, token):
    """Handle unsubscribe via link."""
    from apps.marketing import services
    return services.handle_unsubscribe(token, request)


@api_view(["POST"])
@permission_classes([AllowAny])
def unsubscribe_web(request):
    """POST /marketing/unsubscribe/ - unsubscribe via form."""
    email = request.data.get("email")
    if not email:
        return Response({"detail": "Email required."}, status=400)
    
    from apps.marketing.models import EmailUnsubscribe, EmailSuppression
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        user = User.objects.get(email=email)
        prefs, _ = EmailUnsubscribe.objects.get_or_create(user=user)
        prefs.unsubscribe_all = True
        prefs.save()
        
        # Add to suppression list
        from apps.marketing.models import EmailSuppression
        EmailSuppression.objects.get_or_create(
            email=email,
            reason="unsubscribed",
            defaults={"user": user},
        )
        
        return Response({"detail": "Unsubscribed successfully."})
    except User.DoesNotExist:
        # Just add to suppression list
        from apps.marketing.models import EmailSuppression
        EmailSuppression.objects.get_or_create(
            email=email,
            reason="unsubscribed",
        )
        return Response({"detail": "Unsubscribed successfully."})