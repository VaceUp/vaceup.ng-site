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

    def get_recipient_count(self, obj) -> int:
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
        read_only_fields = ("id", "status", "scheduled_at", "from_email", "track_opens", "track_clicks")

    def validate(self, attrs):
        from django.conf import settings
        from email.utils import parseaddr
        if self.instance and self.instance.status != "draft":
            raise serializers.ValidationError("Only drafts can be edited. Cancel or pause sending instead.")
        audience = attrs.get("audience_filter", getattr(self.instance, "audience_filter", "never_purchased"))
        if audience == "custom" or attrs.get("custom_query"):
            raise serializers.ValidationError({"audience_filter": "Choose a supported audience; arbitrary database queries are not allowed."})
        targets = attrs.get("target_courses", self.instance.target_courses.all() if self.instance else [])
        if audience == "specific_courses" and not targets:
            raise serializers.ValidationError({"target_courses": "Select at least one course."})
        text = attrs.get("custom_text", getattr(self.instance, "custom_text", ""))
        if not text.strip():
            raise serializers.ValidationError({"custom_text": "Write the campaign message before saving."})
        attrs.update(exclude_unsubscribed=True, exclude_bounced=True, track_opens=False, track_clicks=False,
                     from_email=parseaddr(settings.DEFAULT_FROM_EMAIL)[1], custom_query={}, custom_html="", template=None)
        for field in ("subject", "from_name", "reply_to"):
            if any(char in attrs.get(field, "") for char in ("\r", "\n")):
                raise serializers.ValidationError({field: "Use a single line."})
        return attrs

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
        model = EmailRecipient
        fields = (
            "id",
            "campaign",
            "user",
            "user_name",
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
        model = EmailLog
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
        model = EmailSuppression
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
        model = EmailUnsubscribe
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

