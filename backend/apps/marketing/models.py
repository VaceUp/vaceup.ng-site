"""Marketing email models for bulk promotional campaigns."""
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class EmailTemplate(TimeStampedModel):
    """Reusable email templates for marketing campaigns."""

    name = models.CharField(max_length=200, unique=True)
    subject = models.CharField(max_length=200)
    # HTML content with placeholders: {{first_name}}, {{email}}, {{unsubscribe_url}}
    html_content = models.TextField(help_text="HTML content with placeholders")
    # Plain text fallback
    text_content = models.TextField(blank=True, help_text="Plain text fallback")
    
    # Template variables documentation
    available_variables = models.JSONField(
        default=list,
        blank=True,
        help_text="List of available template variables"
    )
    
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class EmailCampaign(TimeStampedModel):
    """A marketing email campaign."""

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        SCHEDULED = "scheduled", _("Scheduled")
        SENDING = "sending", _("Sending")
        SENT = "sent", _("Sent")
        PAUSED = "paused", _("Paused")
        FAILED = "failed", _("Failed")
        CANCELLED = "cancelled", _("Cancelled")

    name = models.CharField(max_length=200)
    subject = models.CharField(max_length=200)
    
    # Template or custom content
    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
    )
    # Or custom content (overrides template)
    custom_html = models.TextField(blank=True)
    custom_text = models.TextField(blank=True)
    
    # Sender info
    from_name = models.CharField(max_length=100, default="VaceUp Team")
    from_email = models.EmailField(default="noreply@vaceup.ng")
    reply_to = models.EmailField(blank=True)
    
    # Targeting
    class AudienceFilter(models.TextChoices):
        ALL_USERS = "all_users", _("All Users")
        NEVER_PURCHASED = "never_purchased", _("Never Purchased")
        NEVER_ENROLLED = "never_enrolled", _("Never Enrolled")
        FREE_COURSES_ONLY = "free_only", _("Free Courses Only")
        PAID_COURSES_ONLY = "paid_only", _("Paid Courses Only")
        SPECIFIC_COURSES = "specific_courses", _("Specific Courses")
        INACTIVE_USERS = "inactive_users", _("Inactive Users (30+ days)")
        NEW_USERS = "new_users", _("New Users (last 7 days)")
        CUSTOM = "custom", _("Custom Query")
    
    audience_filter = models.CharField(
        max_length=30,
        choices=AudienceFilter.choices,
        default=AudienceFilter.NEVER_PURCHASED,
    )
    
    # Specific courses for SPECIFIC_COURSES filter
    target_courses = models.ManyToManyField(
        "courses.Course",
        blank=True,
        related_name="email_campaigns",
    )
    
    # Custom user query (for CUSTOM filter)
    custom_query = models.JSONField(
        blank=True,
        default=dict,
        help_text="Custom Django ORM filter as JSON"
    )
    
    # Exclusion filters
    exclude_purchased = models.BooleanField(default=True)
    exclude_unsubscribed = models.BooleanField(default=True)
    exclude_bounced = models.BooleanField(default=True)
    
    # Scheduling
    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        SCHEDULED = "scheduled", _("Scheduled")
        SENDING = "sending", _("Sending")
        SENT = "sent", _("Sent")
        PAUSED = "paused", _("Paused")
        FAILED = "failed", _("Failed")
        CANCELLED = "cancelled", _("Cancelled")

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Batch settings
    batch_size = models.PositiveIntegerField(
        default=100,
        help_text="Emails per batch (max 1000)"
    )
    delay_between_batches = models.PositiveIntegerField(
        default=5,
        help_text="Seconds between batches"
    )
    
    # Tracking
    track_opens = models.BooleanField(default=True)
    track_clicks = models.BooleanField(default=True)
    
    # Stats
    total_recipients = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    opened_count = models.PositiveIntegerField(default=0)
    clicked_count = models.PositiveIntegerField(default=0)
    bounced_count = models.PositiveIntegerField(default=0)
    unsubscribed_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    
    # Owner
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_campaigns",
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["status", "scheduled_at"]),
            models.Index(fields=["created_by", "status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.status})"

    @property
    def open_rate(self):
        if self.delivered_count == 0:
            return 0
        return (self.opened_count / self.delivered_count) * 100

    @property
    def click_rate(self):
        if self.delivered_count == 0:
            return 0
        return (self.clicked_count / self.delivered_count) * 100


class EmailRecipient(TimeStampedModel):
    """Individual recipient of a campaign."""

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        QUEUED = "queued", _("Queued")
        SENT = "sent", _("Sent")
        DELIVERED = "delivered", _("Delivered")
        OPENED = "opened", _("Opened")
        CLICKED = ("clicked", _("Clicked"))
        BOUNCED = "bounced", _("Bounced")
        UNSUBSCRIBED = "unsubscribed", _("Unsubscribed")
        FAILED = "failed", _("Failed")
        SKIPPED = "skipped", _("Skipped")

    campaign = models.ForeignKey(
        "EmailCampaign",
        on_delete=models.CASCADE,
        related_name="recipients",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_recipients",
    )
    email = models.EmailField()
    
    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        QUEUED = "queued", _("Queued")
        SENT = "sent", _("Sent")
        DELIVERED = "delivered", _("Delivered")
        OPENED = "opened", _("Opened")
        CLICKED = "clicked", _("Clicked")
        BOUNCED = "bounced", _("Bounced")
        UNSUBSCRIBED = "unsubscribed", _("Unsubscribed")
        FAILED = "failed", _("Failed")
        SKIPPED = "skipped", _("Skipped")

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    
    # Tracking
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    bounced_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True)
    
    # Tracking tokens
    open_token = models.CharField(max_length=64, blank=True)
    click_token = models.CharField(max_length=64, blank=True)
    unsubscribe_token = models.CharField(max_length=64, blank=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["campaign", "status"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["email"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "user"],
                name="unique_campaign_recipient",
            )
        ]

    def __str__(self):
        return f"{self.campaign.name} -> {self.email} ({self.status})"


class EmailLog(TimeStampedModel):
    """Detailed log of email sending events."""

    class EventType(models.TextChoices):
        QUEUED = "queued", _("Queued")
        SENT = "sent", _("Sent")
        DELIVERED = "delivered", _("Delivered")
        OPENED = "opened", _("Opened")
        CLICKED = "clicked", _("Clicked")
        BOUNCED = "bounced", _("Bounced")
        UNSUBSCRIBED = "unsubscribed", _("Unsubscribed")
        FAILED = "failed", _("Failed")
        COMPLAINED = "complained", _("Complained")

    campaign = models.ForeignKey(
        "EmailCampaign",
        on_delete=models.CASCADE,
        related_name="logs",
    )
    recipient = models.ForeignKey(
        "EmailRecipient",
        on_delete=models.CASCADE,
        related_name="logs",
        null=True,
        blank=True,
    )
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
    )
    message_id = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ("-timestamp",)
        indexes = [
            models.Index(fields=["campaign", "event_type"]),
            models.Index(fields=["recipient", "event_type"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        return f"{self.campaign.name} - {self.event_type}"


class EmailSuppression(TimeStampedModel):
    """Email suppression list (unsubscribed, bounced, complained)."""

    class Reason(models.TextChoices):
        UNSUBSCRIBED = "unsubscribed", _("Unsubscribed")
        BOUNCED_HARD = "bounced_hard", _("Hard Bounce")
        BOUNCED_SOFT = "bounced_soft", _("Soft Bounce")
        COMPLAINED = "complained", _("Spam Complaint")
        BLOCKED = "blocked", _("Blocked")

    email = models.EmailField(db_index=True)
    reason = models.CharField(max_length=20, choices=Reason.choices)
    campaign = models.ForeignKey(
        "EmailCampaign",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="suppressions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["email", "reason"],
                name="unique_email_suppression",
            )
        ]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["reason"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.reason})"


class EmailUnsubscribe(TimeStampedModel):
    """Global unsubscribe preferences per user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_preferences",
    )
    # Global opt-out
    unsubscribe_all = models.BooleanField(default=False)
    # Category preferences
    marketing_emails = models.BooleanField(default=True)
    product_updates = models.BooleanField(default=True)
    course_announcements = models.BooleanField(default=True)
    promotional_offers = models.BooleanField(default=True)
    weekly_digest = models.BooleanField(default=True)
    
    # Token for unsubscribe links
    unsubscribe_token = models.CharField(max_length=64, unique=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Preferences for {self.user.email}"