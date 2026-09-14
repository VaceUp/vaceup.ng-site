from datetime import timedelta
from unittest.mock import patch
import smtplib
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from rest_framework.test import APITestCase
from apps.adminpanel.models import AdminSettings
from .models import EmailCampaign, EmailRecipient, EmailSuppression, EmailUnsubscribe
from . import services

User = get_user_model()
BASE = "/api/v1/marketing/campaigns/"


class CampaignDeliveryTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("admin@example.com", "test-password")
        self.learner = User.objects.create_user("learner@example.com", "test-password", is_active=True)
        self.client.force_authenticate(self.admin)
        AdminSettings.objects.create(key="marketing_sending_enabled", value=True)
        self.campaign = EmailCampaign.objects.create(name="Launch", subject="New courses", custom_text="Read about our courses.", audience_filter="all_users", exclude_purchased=False)

    def queue(self, campaign=None, **kwargs):
        campaign = campaign or self.campaign
        return services.schedule_campaign(campaign.pk, services.audience_preview(campaign)["confirmation"], **kwargs)

    def test_create_cannot_forge_delivery_or_disable_suppression(self):
        response = self.client.post(BASE, {"name": "New", "subject": "Hello", "custom_text": "Body", "status": "sent", "exclude_unsubscribed": False, "track_opens": True}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        row = EmailCampaign.objects.get(pk=response.data["id"])
        self.assertEqual(row.status, "draft")
        self.assertTrue(row.exclude_unsubscribed)
        self.assertFalse(row.track_opens)
        self.assertEqual(EmailRecipient.objects.count(), 0)

    def test_custom_query_and_empty_body_rejected(self):
        for payload in [{"audience_filter": "custom"}, {"custom_text": " "}]:
            response = self.client.patch(f"{BASE}{self.campaign.pk}/", payload, format="json")
            self.assertEqual(response.status_code, 400)

    def test_non_admin_denied(self):
        self.client.force_authenticate(self.learner)
        self.assertEqual(self.client.get(BASE).status_code, 403)
        self.assertEqual(self.client.post(f"{BASE}{self.campaign.pk}/send-now/", {}, format="json").status_code, 403)

    def test_snapshot_idempotent_and_sent_once(self):
        self.queue(); self.queue()
        self.assertEqual(EmailRecipient.objects.count(), 2)
        self.assertEqual(services.process_queue(), {"sent": 2})
        self.assertEqual(services.process_queue(), {})
        self.assertEqual(len(mail.outbox), 2)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, "sent")
        self.assertEqual(self.campaign.sent_count, 2)

    def test_optouts_always_excluded_and_rechecked_after_queue(self):
        EmailUnsubscribe.objects.create(user=self.admin, marketing_emails=False, unsubscribe_token="admin-token")
        self.assertEqual(services.get_campaign_recipients(self.campaign).count(), 1)
        self.queue()
        EmailSuppression.objects.create(email=self.learner.email.upper(), reason="blocked")
        self.assertEqual(services.process_queue(), {"skipped": 1})
        self.assertFalse(hasattr(mail, "outbox") and mail.outbox)

    def test_preview_does_not_add_recipients(self):
        for _ in range(2):
            self.assertEqual(self.client.post(f"{BASE}{self.campaign.pk}/preview/").status_code, 200)
        self.assertEqual(EmailRecipient.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(mail.outbox[0].to, [self.admin.email])

    def test_changed_audience_requires_confirmation(self):
        token = services.audience_preview(self.campaign)["confirmation"]
        self.learner.email = "changed@example.com"; self.learner.save()
        response = self.client.post(f"{BASE}{self.campaign.pk}/send-now/", {"confirmation": token}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertFalse(EmailRecipient.objects.exists())

    def test_scheduling_pause_resume_and_immutability(self):
        date = timezone.now() + timedelta(hours=1)
        self.queue(scheduled_at=date)
        self.assertEqual(services.process_queue(), {})
        self.assertEqual(self.client.patch(f"{BASE}{self.campaign.pk}/", {"custom_text": "Changed"}, format="json").status_code, 400)
        services.change_state(self.campaign.pk, "pause")
        EmailCampaign.objects.filter(pk=self.campaign.pk).update(scheduled_at=timezone.now())
        self.assertEqual(services.process_queue(), {})
        services.change_state(self.campaign.pk, "resume")
        self.assertEqual(services.process_queue(), {"sent": 2})

    def test_cancel_and_feature_switch_stop_delivery(self):
        self.queue()
        AdminSettings.objects.filter(key="marketing_sending_enabled").update(value=False)
        self.assertEqual(services.process_queue(), {})
        AdminSettings.objects.filter(key="marketing_sending_enabled").update(value=True)
        services.change_state(self.campaign.pk, "cancel")
        self.assertEqual(services.process_queue(), {})

    @patch("apps.marketing.services.send_message", side_effect=smtplib.SMTPDataError(451, b"private provider details"))
    def test_transient_refusal_retries_without_secret_errors(self, send):
        self.queue()
        self.assertEqual(services.process_queue(), {"pending": 2})
        row = EmailRecipient.objects.first()
        self.assertNotIn("private", row.failure_reason)
        self.assertGreater(row.available_at, timezone.now())

    def test_stale_claim_is_not_automatically_resent(self):
        self.queue()
        EmailRecipient.objects.update(status="queued", claimed_at=timezone.now()-timedelta(minutes=11))
        with patch("apps.marketing.services.send_message") as send:
            services.process_queue()
            send.assert_not_called()
        self.assertEqual(EmailRecipient.objects.filter(status="failed").count(), 2)

    def test_unsubscribe_get_readonly_post_optout_and_no_open_redirect(self):
        self.queue()
        row = EmailRecipient.objects.get(user=self.learner)
        self.client.force_authenticate(None)
        url = f"/api/v1/marketing/unsubscribe/{row.unsubscribe_token}/"
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertFalse(EmailUnsubscribe.objects.exists())
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertFalse(EmailUnsubscribe.objects.get(user=self.learner).marketing_emails)
        self.assertEqual(self.client.get('/api/v1/marketing/track/click/token/?url=https://untrusted.example').status_code, 410)

    def test_stats_returns_actual_counts(self):
        self.queue(); services.process_queue()
        response = self.client.get(f"{BASE}{self.campaign.pk}/stats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status_breakdown"], {"sent": 2})
