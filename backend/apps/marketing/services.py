"""Database-backed marketing delivery; no Redis or continuously running worker."""
from datetime import timedelta
from email.utils import formataddr, parseaddr
import hashlib
import json
import time
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from django.utils.html import escape

from apps.accounts.mail_delivery import classify_delivery_failure
from apps.adminpanel.platform_settings import setting_value
from apps.core.exceptions import DomainError, IllegalStateTransition
from apps.enrollment.models import Enrollment
from apps.payments.models import Payment
from .models import EmailCampaign, EmailRecipient, EmailSuppression, EmailUnsubscribe

User = get_user_model()
SENDABLE = ("scheduled", "sending")


def eligible_users():
    return User.objects.filter(is_active=True).exclude(email="").filter(
        ~Exists(EmailUnsubscribe.objects.filter(user=OuterRef("pk")).filter(
            Q(unsubscribe_all=True) | Q(marketing_emails=False) | Q(promotional_offers=False))),
        ~Exists(EmailSuppression.objects.filter(email__iexact=OuterRef("email"))),
    )


def get_campaign_recipients(campaign):
    users = eligible_users()
    enrolled = Enrollment.objects.filter(student=OuterRef("pk"), status__in=["active", "completed"])
    paid = Payment.objects.filter(student=OuterRef("pk"), status="success")
    audience = campaign.audience_filter
    if audience == "never_purchased":
        users = users.filter(~Exists(paid))
    elif audience == "never_enrolled":
        users = users.filter(~Exists(enrolled))
    elif audience == "free_only":
        users = users.filter(Exists(enrolled.filter(course__price=0)), ~Exists(enrolled.filter(course__price__gt=0)))
    elif audience == "paid_only":
        users = users.filter(Exists(enrolled.filter(course__price__gt=0)))
    elif audience == "specific_courses":
        users = users.filter(Exists(enrolled.filter(course__in=campaign.target_courses.all())))
    elif audience == "inactive_users":
        cutoff = timezone.now() - timedelta(days=30)
        users = users.filter(Q(last_login__lt=cutoff) | Q(last_login__isnull=True, date_joined__lt=cutoff))
    elif audience == "new_users":
        users = users.filter(date_joined__gte=timezone.now() - timedelta(days=7))
    elif audience != "all_users":
        raise DomainError("Choose a supported audience and save the draft again.")
    if campaign.exclude_purchased:
        users = users.filter(~Exists(paid))
    return users.order_by("pk")


def audience_preview(campaign):
    # A signed content revision prevents confirming an older campaign edit.
    users = list(get_campaign_recipients(campaign).values_list("pk", "email")[:10001])
    if len(users) > 10000:
        raise DomainError("Split this audience into smaller campaigns (maximum 10,000 recipients).")
    count = len(users)
    return {"count": count, "confirmation": signing.dumps({
        "id": campaign.pk, "revision": campaign.updated_at.isoformat(), "count": count,
        "audience": hashlib.sha256(json.dumps(users).encode()).hexdigest(),
    }, salt="marketing-audience")}


@transaction.atomic
def schedule_campaign(campaign_id, confirmation, scheduled_at=None):
    campaign = EmailCampaign.objects.select_for_update().get(pk=campaign_id)
    if campaign.status in SENDABLE:
        return campaign  # Repeated submission never recreates recipients.
    if campaign.status != "draft":
        raise IllegalStateTransition("Only drafts can be queued.")
    if campaign.recipients.exists():
        raise IllegalStateTransition("This legacy draft already has recipient records. Create a new draft to avoid duplicate delivery.")
    if not setting_value("marketing_sending_enabled"):
        raise DomainError("Enable marketing delivery in Platform Settings before queueing a campaign.")
    if not campaign.custom_text.strip():
        raise DomainError("Edit this draft and save a plain-text message before sending.")
    try:
        confirmed = signing.loads(confirmation, salt="marketing-audience", max_age=600)
    except (signing.BadSignature, TypeError):
        raise DomainError("Review the audience again; confirmation has expired.")
    users = list(get_campaign_recipients(campaign).values_list("pk", "email")[:10001])
    if confirmed != {"id": campaign.pk, "revision": campaign.updated_at.isoformat(), "count": len(users),
                     "audience": hashlib.sha256(json.dumps(users).encode()).hexdigest()}:
        raise IllegalStateTransition("The campaign or audience changed. Review recipients again.")
    if not users:
        raise DomainError("No eligible recipients. Change the audience before sending.")
    if len(users) > 10000:
        raise DomainError("Split this audience into smaller campaigns (maximum 10,000 recipients).")
    EmailRecipient.objects.bulk_create([
        EmailRecipient(campaign=campaign, user_id=pk, email=email, unsubscribe_token=uuid.uuid4().hex)
        for pk, email in users
    ], batch_size=250)
    campaign.status = "scheduled"
    campaign.scheduled_at = scheduled_at or timezone.now()
    campaign.total_recipients = len(users)
    campaign.save(update_fields=["status", "scheduled_at", "total_recipients", "updated_at"])
    return campaign


@transaction.atomic
def change_state(campaign_id, action):
    campaign = EmailCampaign.objects.select_for_update().get(pk=campaign_id)
    allowed, target = {
        "pause": (SENDABLE, "paused"), "resume": (("paused",), "scheduled"),
        "cancel": (("draft", "scheduled", "sending", "paused", "failed"), "cancelled"),
    }[action]
    if campaign.status == target:
        return campaign
    if campaign.status not in allowed:
        raise IllegalStateTransition("This campaign cannot perform that action in its current state.")
    campaign.status = target
    campaign.save(update_fields=["status", "updated_at"])
    return campaign


def unsubscribe_url(recipient):
    return f"{settings.MARKETING_PUBLIC_API_URL.rstrip('/')}/api/v1/marketing/unsubscribe/{recipient.unsubscribe_token}/"


def build_email_content(campaign, recipient=None):
    text = campaign.custom_text
    if recipient:
        text += "\n\nStop marketing emails: " + unsubscribe_url(recipient)
    else:
        text += "\n\n[Preview only. Real messages include a personal unsubscribe link.]"
    html = "<html><body><h1>" + escape(campaign.subject) + "</h1><p>" + escape(text).replace("\n", "<br>") + "</p>"
    if recipient:
        html += '<p><a href="' + escape(unsubscribe_url(recipient)) + '">Unsubscribe from marketing emails</a></p>'
    html += "</body></html>"
    return campaign.subject, html, text


def send_message(campaign, email, recipient=None):
    subject, html, text = build_email_content(campaign, recipient)
    headers = {}
    if recipient:
        headers = {"List-Unsubscribe": f"<{unsubscribe_url(recipient)}>",
                   "Message-ID": f"<vaceup-campaign-{campaign.pk}-{recipient.pk}@{parseaddr(settings.DEFAULT_FROM_EMAIL)[1].split('@')[-1]}>"}
    message = EmailMultiAlternatives(
        subject=subject if recipient else "[PREVIEW] " + subject, body=text,
        from_email=formataddr((campaign.from_name, parseaddr(settings.DEFAULT_FROM_EMAIL)[1])),
        to=[email], reply_to=[campaign.reply_to] if campaign.reply_to else None, headers=headers,
    )
    message.attach_alternative(html, "text/html")
    if message.send(fail_silently=False) != 1:
        raise ValueError("Email backend did not accept the message.")


def process_queue(limit=25, max_seconds=45):
    """Claim rows with compare-and-swap, then send outside database transactions.

    SMTP cannot guarantee exactly-once delivery. Abandoned claims are marked
    failed for manual investigation, never automatically resent.
    """
    outcomes = {}
    deadline = time.monotonic() + max_seconds
    for _ in range(limit):
        if time.monotonic() >= deadline or not setting_value("marketing_sending_enabled"):
            break
        now = timezone.now()
        EmailRecipient.objects.filter(status="queued", claimed_at__lt=now-timedelta(minutes=10)).update(
            status="failed", failure_reason="delivery_uncertain: worker stopped; check SMTP logs before creating a replacement campaign.", failed_at=now)
        candidate = EmailRecipient.objects.filter(status="pending", available_at__lte=now,
            campaign__status__in=SENDABLE, campaign__scheduled_at__lte=now).order_by("available_at", "pk").first()
        if not candidate:
            break
        claim = uuid.uuid4()
        if not EmailRecipient.objects.filter(pk=candidate.pk, status="pending").update(
            status="queued", claim_id=claim, claimed_at=now, attempts=candidate.attempts+1):
            continue
        candidate.refresh_from_db()
        campaign = candidate.campaign
        if campaign.status not in SENDABLE or not setting_value("marketing_sending_enabled"):
            EmailRecipient.objects.filter(pk=candidate.pk, claim_id=claim).update(status="pending", claim_id=None, claimed_at=None)
            continue
        EmailCampaign.objects.filter(pk=campaign.pk, status="scheduled").update(status="sending", sent_at=now)
        values = {"status": "sent", "sent_at": now, "failure_reason": ""}
        if not eligible_users().filter(pk=candidate.user_id, email__iexact=candidate.email).exists():
            values = {"status": "skipped", "failure_reason": "Recipient inactive, changed address or opted out."}
        else:
            try:
                send_message(campaign, candidate.email, candidate)
            except Exception as exc:
                failure = classify_delivery_failure(exc)
                # Only explicit transient SMTP refusals are safe to retry.
                retry = failure.code == "smtp_temporary" and candidate.attempts < 3
                values = {"status": "pending" if retry else "failed", "failed_at": now,
                          "available_at": now+timedelta(minutes=5*candidate.attempts),
                          "failure_reason": f"{failure.code}: {failure.action}"}
        EmailRecipient.objects.filter(pk=candidate.pk, claim_id=claim, status="queued").update(
            **values, claim_id=None, claimed_at=None)
        outcomes[values["status"]] = outcomes.get(values["status"], 0) + 1
    for campaign in EmailCampaign.objects.filter(status__in=SENDABLE):
        counts = dict(campaign.recipients.values_list("status").annotate(total=Count("pk")))
        update = {"sent_count": sum(counts.get(s, 0) for s in ["sent", "delivered", "opened", "clicked"]),
                  "failed_count": counts.get("failed", 0)}
        if not counts.get("pending") and not counts.get("queued"):
            update.update(status="failed" if counts.get("failed") else "sent", completed_at=timezone.now())
        EmailCampaign.objects.filter(pk=campaign.pk, status__in=SENDABLE).update(**update)
    return outcomes


@transaction.atomic
def handle_unsubscribe(token):
    recipient = EmailRecipient.objects.filter(unsubscribe_token=token).exclude(unsubscribe_token="").first()
    if not recipient:
        raise DomainError("This unsubscribe link is invalid.")
    EmailUnsubscribe.objects.update_or_create(user_id=recipient.user_id, defaults={
        "marketing_emails": False, "promotional_offers": False, "unsubscribe_token": uuid.uuid4().hex,
    })
    EmailSuppression.objects.get_or_create(email=recipient.email, reason="unsubscribed", defaults={"user_id": recipient.user_id})
    EmailRecipient.objects.filter(pk=recipient.pk).update(unsubscribed_at=timezone.now())
