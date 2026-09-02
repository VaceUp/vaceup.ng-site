"""Serializers for marketing emails."""
from rest_framework import serializers

from apps.marketing.models import (
    EmailTemplate,
    EmailCampaign,
    EmailRecipient,
    EmailLog,
    EmailSuppression,
    EmailUnsubscribe,
)


class EmailTemplateSerializer(serializers.ModelSerializer):
    """Serializer for email templates."""

    class Meta:
        model = EmailTemplate
        fields = (
            "id",
            "name",
            "subject",
            "html_content",
            "text_content",
            "available_variables",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class EmailCampaignSerializer(serializers.ModelSerializer):
    """Read serializer for email campaigns."""

    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    open_rate = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    click_rate = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    recipient_count = serializers.SerializerMethodField()

    class Meta:
        model = EmailCampaign
        fields = (
            "id",
            "name",
            "subject",
            "template",
            "custom_html",
            "custom_text",
            "from_name",
            "from_email",
            "reply_to",
            "audience_filter",
            "target_courses",
            "custom_query",
            "exclude_purchased",
            "exclude_unsubscribed",
            "exclude_bounced",
            "status",
            "scheduled_at",
            "sent_at",
            "completed_at",
            "batch_size",
            "delay_between_batches",
            "track_opens",
            "track_clicks",
            "total_recipients",
            "sent_count",
            "delivered_count",
            "opened_count",
            "clicked_count",
            "bounced_count",
            "unsubscribed_count",
            "failed_count",
            "open_rate",
            "click_rate",
            "recipient_count",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "total_recipients",
            "sent_count",
            "delivered_count",
            "opened_count",
            "clicked_count",
            "bounced_count",
            "unsubscribed_count",
            "failed_count",
            "created_at",
            "updated_at",
        )

    def get_recipient_count(self, obj):
        return obj.recipients.count()


class EmailCampaignCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating/updating campaigns."""

    class Meta:
        model = EmailCampaign
        fields = (
            "id",
            "name",
            "subject",
            "template",
            "custom_html",
            "custom_text",
            "from_name",
            "from_email",
            "reply_to",
            "audience_filter",
            "target_courses",
            "custom_query",
            "exclude_purchased",
            "exclude_unsubscribed",
            "exclude_bounced",
            "batch_size",
            "delay_between_batches",
            "track_opens",
            "track_clicks",
            "status",
            "scheduled_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_batch_size(self, value):
        if value > 1000:
            raise serializers.ValidationError("Batch size cannot exceed 1000.")
        if value < 1:
            raise serializers.ValidationError("Batch size must be at least 1.")
        return value


class EmailCampaignStatsSerializer(serializers.Serializer):
    """Serializer for campaign statistics."""
    total_recipients = serializers.IntegerField()
    sent_count = serializers.IntegerField()
    delivered_count = serializers.IntegerField()
    opened_count = serializers.IntegerField()
    clicked_count = serializers.IntegerField()
    bounced_count = serializers.IntegerField()
    unsubscribed_count = serializers.IntegerField()
    failed_count = serializers.IntegerField()
    open_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    click_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    status_breakdown = serializers.DictField(child=serializers.IntegerField())


class EmailRecipientSerializer(serializers.ModelSerializer):
    """Serializer for email recipients."""

    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = "EmailRecipient"
        fields = (
            "id",
            "campaign",
            "user",
            "email",
            "status",
            "sent_at",
            "delivered_at",
            "opened_at",
            "clicked_at",
            "bounced_at",
            "unsubscribed_at",
            "failed_at",
            "failure_reason",
            "created_at",
        )
        read_only_fields = fields


class EmailTemplateSerializer(serializers.ModelSerializer):
    """Serializer for email templates."""

    class Meta:
        model = EmailTemplate
        fields = (
            "id",
            "name",
            "subject",
            "html_content",
            "text_content",
            "available_variables",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class EmailLogSerializer(serializers.ModelSerializer):
    """Serializer for email logs."""

    class Meta:
        model = "EmailLog"
        fields = (
            "id",
            "campaign",
            "recipient",
            "event_type",
            "message_id",
            "details",
            "error_message",
            "timestamp",
        )
        read_only_fields = fields


class EmailSuppressionSerializer(serializers.ModelSerializer):
    """Serializer for email suppressions."""

    class Meta:
        model = "EmailSuppression"
        fields = (
            "id",
            "email",
            "reason",
            "campaign",
            "user",
            "details",
            "created_at",
        )
        read_only_fields = ("created_at",)


class EmailUnsubscribeSerializer(serializers.ModelSerializer):
    """Serializer for unsubscribe preferences."""

    class Meta:
        model = "EmailUnsubscribe"
        fields = (
            "user",
            "unsubscribe_all",
            "marketing_emails",
            "product_updates",
            "course_announcements",
            "promotional_offers",
            "weekly_digest",
            "unsubscribe_token",
        )
        read_only_fields = ("user", "unsubscribe_token")


class EmailCampaignCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating campaigns with recipient preview."""

    estimated_recipients = serializers.SerializerMethodField()

    class Meta:
        model = EmailCampaign
        fields = (
            "id",
            "name",
            "subject",
            "template",
            "custom_html",
            "custom_text",
            "from_name",
            "from_email",
            "reply_to",
            "audience_filter",
            "target_courses",
            "custom_query",
            "exclude_purchased",
            "exclude_unsubscribed",
            "exclude_bounced",
            "batch_size",
            "delay_between_batches",
            "track_opens",
            "track_clicks",
            "status",
            "scheduled_at",
            "estimated_recipients",
        )

    def get_estimated_recipients(self, obj):
        if obj.pk:
            from apps.marketing.services import get_campaign_recipients
            try:
                return get_campaign_recipients(obj).count()
            except Exception:
                return 0
        return 0