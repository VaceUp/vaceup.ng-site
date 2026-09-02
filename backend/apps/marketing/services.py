"""Marketing email services: campaign management, sending, tracking."""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import Q, Exists, OuterRef
from django.utils import timezone
from django.template import Template, Context

from apps.core.exceptions import DomainError
from apps.courses.models import Course
from apps.enrollment.models import Enrollment
from apps.payments.models import Payment

from apps.marketing.models import (
    EmailCampaign,
    EmailRecipient,
    EmailLog,
    EmailSuppression,
    EmailUnsubscribe,
    EmailTemplate,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def generate_tracking_token() -> str:
    """Generate a unique tracking token."""
    return uuid.uuid4().hex


def get_campaign_recipients(campaign: EmailCampaign):
    """
    Get queryset of users matching campaign's audience filter.
    Returns queryset of User objects.
    """
    # Base queryset: active users
    users = User.objects.filter(is_active=True)

    # Apply audience filter
    if campaign.audience_filter == EmailCampaign.AudienceFilter.NEVER_PURCHASED:
        # Users who have never made a successful payment
        users = users.filter(
            ~Exists(
                Payment.objects.filter(
                    student=OuterRef("pk"),
                    status="success",
                )
            )
        )
    elif campaign.audience_filter == EmailCampaign.AudienceFilter.NEVER_ENROLLED:
        # Users who have never enrolled in any course
        users = users.filter(
            ~Exists(
                Enrollment.objects.filter(
                    student=OuterRef("pk"),
                    status__in=[
                        Enrollment.Status.ACTIVE,
                        Enrollment.Status.COMPLETED,
                    ],
                )
            )
        )
    elif campaign.audience_filter == EmailCampaign.AudienceFilter.FREE_COURSES_ONLY:
        # Users who only have free course enrollments
        users = users.filter(
            Exists(
                Enrollment.objects.filter(
                    student=OuterRef("pk"),
                    course__price=0,
                    status__in=[
                        Enrollment.Status.ACTIVE,
                        Enrollment.Status.COMPLETED,
                    ],
                )
            )
        ).filter(
            ~Exists(
                Enrollment.objects.filter(
                    student=OuterRef("pk"),
                    course__price__gt=0,
                    status__in=[
                        Enrollment.Status.ACTIVE,
                        Enrollment.Status.COMPLETED,
                    ],
                )
            )
        )
    elif campaign.audience_filter == EmailCampaign.AudienceFilter.PAID_COURSES_ONLY:
        # Users who have paid course enrollments
        users = users.filter(
            Exists(
                Enrollment.objects.filter(
                    student=OuterRef("pk"),
                    course__price__gt=0,
                    status__in=[
                        Enrollment.Status.ACTIVE,
                        Enrollment.Status.COMPLETED,
                    ],
                )
            )
        )
    elif campaign.audience_filter == EmailCampaign.AudienceFilter.SPECIFIC_COURSES:
        # Users enrolled in specific courses
        if campaign.target_courses.exists():
            users = users.filter(
                Exists(
                    Enrollment.objects.filter(
                        student=OuterRef("pk"),
                        course__in=campaign.target_courses.all(),
                        status__in=[
                            Enrollment.Status.ACTIVE,
                            Enrollment.Status.COMPLETED,
                        ],
                    )
                )
            )
        else:
            return User.objects.none()
    elif campaign.audience_filter == EmailCampaign.AudienceFilter.INACTIVE_USERS:
        # Users inactive for 30+ days
        cutoff = timezone.now() - timedelta(days=30)
        users = users.filter(last_login__lt=cutoff)
    elif campaign.audience_filter == EmailCampaign.AudienceFilter.NEW_USERS:
        # Users registered in last 7 days
        cutoff = timezone.now() - timedelta(days=7)
        users = users.filter(date_joined__gte=cutoff)
    elif campaign.audience_filter == EmailCampaign.AudienceFilter.CUSTOM:
        # Custom JSON query
        custom_query = campaign.custom_query or {}
        users = users.filter(**custom_query)

    # Apply exclusion filters
    if campaign.exclude_purchased:
        users = users.filter(
            ~Exists(
                Payment.objects.filter(
                    student=OuterRef("pk"),
                    status="success",
                )
            )
        )

    if campaign.exclude_unsubscribed:
        # Exclude globally unsubscribed
        users = users.filter(
            ~Exists(
                EmailUnsubscribe.objects.filter(
                    user=OuterRef("pk"),
                    unsubscribe_all=True,
                )
            )
        )
        # Also exclude category-specific unsubscribes based on campaign type
        # (could be enhanced with campaign category)

    if campaign.exclude_bounced:
        users = users.filter(
            ~Exists(
                EmailSuppression.objects.filter(
                    email=OuterRef("email"),
                    reason__in=["bounced_hard", "bounced_soft"],
                )
            )
        )

    # Exclude already suppressed emails
    users = users.filter(
        ~Exists(
            EmailSuppression.objects.filter(
                email=OuterRef("email"),
                reason__in=["bounced_hard", "complained"],
            )
        )
    )

    # Apply custom query if CUSTOM filter
    if campaign.audience_filter == EmailCampaign.AudienceFilter.CUSTOM:
        custom_query = campaign.custom_query or {}
        users = users.filter(**custom_query)

    # Apply target courses filter
    if campaign.target_courses.exists():
        users = users.filter(
            Exists(
                Enrollment.objects.filter(
                    student=OuterRef("pk"),
                    course__in=campaign.target_courses.all(),
                    status__in=[Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED],
                )
            )
        )

    return users.distinct()


def get_campaign_recipients(campaign: EmailCampaign):
    """Get queryset of EmailRecipient objects for a campaign."""
    users = get_campaign_recipients(campaign)
    
    # Create or get EmailRecipient objects
    recipients = []
    for user in users:
        recipient, created = EmailRecipient.objects.get_or_create(
            campaign_id=campaign.pk,
            user=user,
            defaults={
                "email": user.email,
                "open_token": uuid.uuid4().hex,
                "click_token": uuid.uuid4().hex,
                "unsubscribe_token": uuid.uuid4().hex,
            }
        )
        if created:
            logger.info(f"Created recipient {user.email} for campaign {campaign.name}")
    
    return EmailRecipient.objects.filter(campaign_id=campaign.pk)


def build_email_content(campaign, recipient):
    """Build email content for a recipient."""
    if campaign.template:
        # Use template
        template = campaign.template
        html_content = campaign.template.html_content
        text_content = campaign.template.text_content or ""
        
        # Build context
        context = {
            "first_name": recipient.user.full_name.split()[0] if recipient.user.full_name else "",
            "full_name": recipient.user.full_name,
            "email": recipient.email,
            "first_name": recipient.user.full_name.split()[0] if recipient.user.full_name else "",
            "unsubscribe_url": f"{settings.FRONTEND_BASE_URL}/unsubscribe/{recipient.unsubscribe_token}",
            "open_pixel_url": f"{settings.API_BASE_URL}/api/v1/marketing/track/open/{recipient.open_token}/",
            "click_base_url": f"{settings.API_BASE_URL}/api/v1/marketing/track/click/{recipient.click_token}/",
        }
        
        # Render template
        template_obj = Template(campaign.template.html_content)
        context_obj = Context(context)
        html_content = template_obj.render(context_obj)
        
        if campaign.template.text_content:
            text_template = Template(campaign.template.text_content)
            text_content = text_content.render(Context(context))
        else:
            # Strip HTML for text version
            import re
            text_content = re.sub("<[^<]+?>", "", html_content)
        
        subject = Template(campaign.template.subject).render(Context({}))
    else:
        # Custom content
        context = {
            "first_name": recipient.user.full_name.split()[0] if recipient.user.full_name else "",
            "full_name": recipient.user.full_name,
            "email": recipient.email,
            "unsubscribe_url": f"{settings.FRONTEND_BASE_URL}/unsubscribe/{recipient.unsubscribe_token}",
        }
        
        html_content = Template(campaign.custom_html).render(Context(context))
        text_content = campaign.custom_text or re.sub("<[^<]+?>", "", html_content)
        subject = campaign.subject
    
    return subject, html_content, text_content


@transaction.atomic
def create_campaign_recipients(campaign: EmailCampaign) -> int:
    """Create EmailRecipient records for all matching users. Returns count."""
    users = get_campaign_recipients(campaign)
    
    # Check for existing recipients
    existing_emails = set(
        EmailRecipient.objects.filter(campaign_id=campaign.pk)
        .values_list("email", flat=True)
    )
    
    new_recipients = []
    for user in users:
        if user.email not in existing_emails:
            open_token = uuid.uuid4().hex
            click_token = uuid.uuid4().hex
            unsubscribe_token = uuid.uuid4().hex
            
            new_recipients.append(EmailRecipient(
                campaign_id=campaign.pk,
                user=user,
                email=user.email,
                status=EmailRecipient.Status.PENDING,
                open_token=uuid.uuid4().hex,
                click_token=uuid.uuid4().hex,
                unsubscribe_token=uuid.uuid4().hex,
            ))
    
    if new_recipients:
        EmailRecipient.objects.bulk_create(new_recipients, ignore_conflicts=True)
    
    return EmailRecipient.objects.filter(campaign_id=campaign.pk).count()


async def send_campaign_batch(campaign_id: int, batch_size: int = 100, delay: int = 5):
    """Send a batch of emails for a campaign."""
    from django.core.mail import EmailMultiAlternatives
    from django.conf import settings as django_settings
    
    campaign = EmailCampaign.objects.get(pk=campaign_id)
    
    if campaign.status not in [EmailCampaign.Status.SCHEDULED, EmailCampaign.Status.SENDING]:
        logger.warning(f"Campaign {campaign.name} not in sendable state: {campaign.status}")
        return
    
    # Update status
    if campaign.status == EmailCampaign.Status.SCHEDULED:
        campaign.status = EmailCampaign.Status.SENDING
        campaign.sent_at = timezone.now()
        campaign.save(update_fields=["status", "sent_at", "updated_at"])
    
    # Get pending recipients
    recipients = EmailRecipient.objects.filter(
        campaign_id=campaign.pk,
        status=EmailRecipient.Status.PENDING,
    )[:campaign.batch_size]
    
    if not recipients:
        # No more recipients
        campaign.status = EmailCampaign.Status.SENT
        campaign.completed_at = timezone.now()
        campaign.save(update_fields=["status", "completed_at", "updated_at"])
        return
    
    campaign.status = EmailCampaign.Status.SENDING
    campaign.save(update_fields=["status", "updated_at"])
    
    for recipient in recipients:
        try:
            # Build email content
            subject, html_content, text_content = build_email_content(campaign, recipient)
            
            # Create email
            email = EmailMultiAlternatives(
                subject=campaign.subject,
                body=text_content or "",
                from_email=f"{campaign.from_name} <{campaign.from_email}>",
                to=[recipient.email],
                reply_to=[campaign.reply_to] if campaign.reply_to else None,
            )
            email.attach_alternative(html_content, "text/html")
            
            # Add tracking headers
            if campaign.track_opens:
                open_url = f"{settings.API_BASE_URL}/api/v1/marketing/track/open/{recipient.open_token}/"
                email.headers["X-Track-Open"] = open_url
            
            if campaign.track_clicks:
                click_url = f"{settings.API_BASE_URL}/api/v1/marketing/track/click/"
                email.headers["X-Track-Click"] = click_url
            
            # Add unsubscribe header
            unsubscribe_url = f"{settings.FRONTEND_BASE_URL}/unsubscribe/{recipient.unsubscribe_token}"
            email.headers["List-Unsubscribe"] = f"<{unsubscribe_url}>"
            
            # Send
            email.send(fail_silently=False)
            
            # Update recipient
            recipient.status = EmailRecipient.Status.SENT
            recipient.sent_at = timezone.now()
            recipient.save(update_fields=["status", "sent_at", "updated_at"])
            
            # Log
            EmailLog.objects.create(
                campaign=campaign,
                recipient=recipient,
                event_type=EmailLog.EventType.SENT,
            )
            
            campaign.sent_count += 1
            campaign.save(update_fields=["sent_count", "updated_at"])
            
        except Exception as e:
            logger.error(f"Failed to send to {recipient.email}: {e}")
            recipient.status = EmailRecipient.Status.FAILED
            recipient.failed_at = timezone.now()
            recipient.failure_reason = str(e)[:500]
            recipient.save(update_fields=["status", "failed_at", "failure_reason", "updated_at"])
            
            campaign.failed_count += 1
            campaign.save(update_fields=["failed_count", "updated_at"])
            
            EmailLog.objects.create(
                campaign=campaign,
                event_type=EmailLog.EventType.FAILED,
                recipient=recipient,
                error_message=str(e)[:500],
            )
        
        # Delay between emails
        import asyncio
        await asyncio.sleep(delay)
    
    # Check if more batches needed
    pending = EmailRecipient.objects.filter(
        campaign_id=campaign.pk,
        status=EmailRecipient.Status.PENDING,
    ).count()
    
    if pending == 0:
        campaign.status = EmailCampaign.Status.SENT
        campaign.completed_at = timezone.now()
    else:
        campaign.status = EmailCampaign.Status.SCHEDULED
        # Schedule next batch (would use Celery in production)
    
    campaign.save(update_fields=["status", "completed_at", "updated_at"])


def schedule_campaign(campaign_id: int):
    """Schedule a campaign for sending."""
    campaign = EmailCampaign.objects.get(pk=campaign_id)
    
    if campaign.status != EmailCampaign.Status.DRAFT:
        raise DomainError("Only draft campaigns can be scheduled.")
    
    # Create recipients
    count = create_campaign_recipients(campaign)
    campaign.total_recipients = count
    
    if campaign.scheduled_at and campaign.scheduled_at > timezone.now():
        campaign.status = EmailCampaign.Status.SCHEDULED
    else:
        campaign.status = EmailCampaign.Status.SENDING
        campaign.sent_at = timezone.now()
    
    campaign.save()
    return campaign


def track_open(token: str, request=None):
    """Track email open event."""
    try:
        recipient = EmailRecipient.objects.get(open_token=token)
        if recipient.opened_at is None:
            recipient.opened_at = timezone.now()
            recipient.status = EmailRecipient.Status.OPENED
            recipient.save(update_fields=["opened_at", "status", "updated_at"])
            
            EmailLog.objects.create(
                campaign_id=recipient.campaign_id,
                recipient=recipient,
                event_type=EmailLog.EventType.OPENED,
            )
            
            # Update campaign stats
            campaign = recipient.campaign
            campaign.opened_count += 1
            campaign.save(update_fields=["opened_count"])
        
        # Return 1x1 transparent pixel
        from django.http import HttpResponse
        pixel = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
        return HttpResponse(pixel, content_type="image/gif")
    except Exception as e:
        logger.error(f"Track open error: {e}")
        from django.http import HttpResponse
        return HttpResponse(status=200)


def track_click(token: str, url: str, request=None):
    """Track click event and redirect."""
    try:
        recipient = EmailRecipient.objects.get(click_token=token)
        if recipient.clicked_at is None:
            recipient.clicked_at = timezone.now()
            recipient.status = EmailRecipient.Status.CLICKED
            recipient.save(update_fields=["clicked_at", "status", "updated_at"])
            
            EmailLog.objects.create(
                campaign_id=recipient.campaign_id,
                recipient=recipient,
                event_type=EmailLog.EventType.CLICKED,
                details={"url": url},
            )
            
            campaign = recipient.campaign
            campaign.clicked_count += 1
            campaign.save(update_fields=["clicked_count"])
    except Exception as e:
        logger.error(f"Track click error: {e}")
    
    # Redirect to target URL
    from django.http import HttpResponseRedirect
    return HttpResponseRedirect(url)


def handle_unsubscribe(token: str, request=None):
    """Handle unsubscribe request."""
    try:
        recipient = EmailRecipient.objects.get(unsubscribe_token=token)
        recipient.status = EmailRecipient.Status.UNSUBSCRIBED
        recipient.unsubscribed_at = timezone.now()
        recipient.save(update_fields=["status", "unsubscribed_at", "updated_at"])
        
        EmailLog.objects.create(
            campaign_id=recipient.campaign_id,
            recipient=recipient,
            event_type=EmailLog.EventType.UNSUBSCRIBED,
        )
        
        # Update campaign stats
        campaign = recipient.campaign
        campaign.unsubscribed_count += 1
        campaign.save(update_fields=["unsubscribed_count"])
        
        # Add to global suppression
        EmailSuppression.objects.get_or_create(
            email=recipient.email,
            reason=EmailSuppression.Reason.UNSUBSCRIBED,
            defaults={"user": recipient.user},
        )
        
        # Update user preferences
        prefs, _ = EmailUnsubscribe.objects.get_or_create(user=recipient.user)
        prefs.unsubscribe_all = True
        prefs.save()
        
        from django.http import HttpResponse
        return HttpResponse("You have been unsubscribed.")
    except Exception as e:
        logger.error(f"Unsubscribe error: {e}")
        from django.http import HttpResponse
        return HttpResponse("Error processing unsubscribe.", status=500)