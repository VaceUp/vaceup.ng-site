"""Regression checks for irreversible account deletion."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import signing
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.adminpanel.models import AdminActionLog
from apps.adminpanel.user_deletion import SALT
from apps.courses.models import Category, Course
from apps.messaging.models import Message
from apps.payments.models import Payment

User = get_user_model()
DELETE = "/api/v1/admin/dashboard/users/delete/"


class UserDeletionTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.password = "operator-test-password"
        self.admin = User.objects.create_superuser("operator@example.com", self.password)
        self.student = User.objects.create_user("learner@example.com", "local-password", is_active=True)
        self.client.force_authenticate(self.admin)

    def preview(self, user=None):
        user = user or self.student
        return self.client.get(f"/api/v1/admin/dashboard/users/{user.pk}/deletion/")

    def payload(self):
        preview = self.preview()
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertTrue(preview.data["can_delete"], preview.data)
        return {"user_id": self.student.pk, "confirmation_email": self.student.email,
                "admin_password": self.password, "confirmation_token": preview.data["confirmation_token"]}

    def test_preview_is_read_only_and_delete_revokes_access(self):
        token = RefreshToken.for_user(self.student)
        Message.objects.create(sender=self.student, recipient=self.admin, body="test message")
        data = self.payload()
        self.assertTrue(User.objects.filter(pk=self.student.pk).exists())
        self.assertEqual(Message.objects.count(), 1)
        response = self.client.post(DELETE, data, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(User.objects.filter(pk=self.student.pk).exists())
        self.assertFalse(Message.objects.exists())
        audit = AdminActionLog.objects.get(action_type="user_delete")
        self.assertEqual(audit.metadata["deleted_user_id"], self.student.pk)
        self.assertNotIn(self.password, str(audit.metadata))
        self.assertNotIn(self.student.email, str(audit.metadata))
        self.assertEqual(self.client.post(DELETE, data, format="json").status_code, 200)
        self.assertEqual(AdminActionLog.objects.filter(action_type="user_delete").count(), 1)
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)

    def test_account_and_marketing_outbox_do_not_block_owned_account_deletion(self):
        from apps.accounts.models import MailJob
        from apps.marketing.models import EmailCampaign, EmailRecipient, EmailLog, EmailUnsubscribe
        MailJob.objects.create(user=self.student, kind="welcome", object_id=self.student.pk, dedupe_key="delete-test")
        campaign = EmailCampaign.objects.create(name="Test", subject="Test", custom_text="Test")
        recipient = EmailRecipient.objects.create(campaign=campaign, user=self.student, email=self.student.email)
        EmailLog.objects.create(campaign=campaign, recipient=recipient, event_type="queued")
        EmailUnsubscribe.objects.create(user=self.student, unsubscribe_token="delete-test")
        response = self.client.post(DELETE, self.payload(), format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(MailJob.objects.exists())
        self.assertFalse(EmailRecipient.objects.exists())
        self.assertTrue(EmailCampaign.objects.filter(pk=campaign.pk).exists())

    def test_missing_confirmation_and_wrong_password_do_not_delete(self):
        self.assertEqual(self.client.post(DELETE, {"user_id": self.student.pk}, format="json").status_code, 400)
        data = self.payload()
        data["admin_password"] = "wrong"
        self.assertEqual(self.client.post(DELETE, data, format="json").status_code, 400)
        data["admin_password"] = self.password
        data["confirmation_email"] = "other@example.com"
        self.assertEqual(self.client.post(DELETE, data, format="json").status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.student.pk).exists())

    def test_changed_cascade_requires_new_preview(self):
        data = self.payload()
        Message.objects.create(sender=self.admin, recipient=self.student, body="Arrived after preview")
        response = self.client.post(DELETE, data, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("changed", str(response.data))
        self.assertTrue(User.objects.filter(pk=self.student.pk).exists())

    def test_admin_and_self_are_protected(self):
        preview = self.preview(self.admin)
        self.assertFalse(preview.data["can_delete"])
        self.assertIsNone(preview.data["confirmation_token"])

    def test_payment_history_and_course_ownership_are_protected(self):
        tutor = User.objects.create_user("tutor@example.com", "local-password", role="instructor", is_active=True)
        course = Course.objects.create(title="Real course", category=Category.objects.create(name="Design"), instructor=tutor)
        Payment.objects.create(student=self.student, course=course, amount="100")
        self.assertFalse(self.preview().data["can_delete"])
        self.assertFalse(self.preview(tutor).data["can_delete"])
        self.assertEqual(Payment.objects.count(), 1)

    def test_student_and_tutor_cannot_preview_or_delete(self):
        data = self.payload()
        for role in ("student", "instructor"):
            self.student.role = role
            self.student.save(update_fields=["role"])
            self.client.force_authenticate(self.student)
            self.assertEqual(self.preview().status_code, 403)
            self.assertEqual(self.client.post(DELETE, data, format="json").status_code, 403)

    def test_tampered_or_cross_admin_receipt_is_rejected(self):
        data = self.payload()
        original = data["confirmation_token"]
        data["confirmation_token"] = original + "tampered"
        self.assertEqual(self.client.post(DELETE, data, format="json").status_code, 400)
        other = User.objects.create_superuser("other@example.com", self.password)
        self.client.force_authenticate(other)
        data["confirmation_token"] = original
        self.assertEqual(self.client.post(DELETE, data, format="json").status_code, 403)

    def test_expired_receipt_is_rejected(self):
        with patch("django.core.signing.time.time", return_value=1):
            data = self.payload()
        self.assertEqual(self.client.post(DELETE, data, format="json").status_code, 400)

    def test_failed_audit_rolls_back_deletion(self):
        data = self.payload()
        with patch("apps.adminpanel.user_deletion.log_admin_action", side_effect=RuntimeError("audit unavailable")):
            with self.assertRaises(RuntimeError):
                self.client.post(DELETE, data, format="json")
        self.assertTrue(User.objects.filter(pk=self.student.pk).exists())
