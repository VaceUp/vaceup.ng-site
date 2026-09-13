from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache.backends.db import DatabaseCache
from django.core.management import call_command
from django.db import transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory

from apps.accounts import services
from apps.accounts.models import EmailVerificationToken, MailJob
from apps.accounts.outbox import claim_job, enqueue_reminders, enqueue_token, process_one
from apps.core.models import RateLimitBucket
from apps.core.throttling import DatabaseAnonRateThrottle
from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.liveclasses.models import LiveClass

User = get_user_model()


@override_settings(ACCOUNT_EMAIL_DELIVERY_MODE="database", FRONTEND_BASE_URL="https://vaceup.ng")
class DatabaseDeliveryTests(TestCase):
    def register(self):
        return services.register_user(email="learner@example.org", full_name="Learner", password="A-long-test-password-44")

    def test_register_queue_deliver_verify_login_without_redis(self):
        client = APIClient()
        with patch("redis.Redis.execute_command", side_effect=AssertionError("Redis must not be used")):
            response = client.post("/api/v1/auth/register/", {
                "email": "learner@example.org", "full_name": "Learner",
                "password": "A-long-test-password-44",
            }, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertTrue(response.data["verification_email_queued"])
            self.assertEqual(MailJob.objects.count(), 1)
            self.assertEqual(len(mail.outbox), 0)
            self.assertEqual(process_one(), "sent")
            token = EmailVerificationToken.objects.get()
            self.assertIn(str(token.token), mail.outbox[0].body)
            self.assertEqual(client.post("/api/v1/auth/verify-email/", {"token": str(token.token)}, format="json").status_code, 200)
            response = client.post("/api/v1/auth/login/", {"email": "learner@example.org", "password": "A-long-test-password-44"}, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertIn("access", response.data)

    def test_account_and_mail_job_roll_back_together(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.register()
                raise RuntimeError("rollback")
        self.assertFalse(User.objects.exists())
        self.assertFalse(MailJob.objects.exists())

    def test_enqueue_is_deduplicated_and_token_is_not_in_payload(self):
        self.register()
        token = EmailVerificationToken.objects.get()
        enqueue_token("verification", token)
        self.assertEqual(MailJob.objects.count(), 1)
        self.assertNotIn(str(token.token), str(MailJob.objects.values().get()))

    def test_superseded_and_expired_tokens_are_skipped(self):
        user = self.register()
        services.resend_verification(email=user.email)
        self.assertEqual(process_one(), "skipped")
        EmailVerificationToken.objects.filter(used=False).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(process_one(), "skipped")
        self.assertEqual(len(mail.outbox), 0)

    def test_transient_failure_retries_without_recording_exception_text(self):
        self.register()
        with patch("apps.accounts.outbox._deliver", side_effect=ConnectionError("sensitive smtp response")):
            self.assertEqual(process_one(), "pending")
        job = MailJob.objects.get()
        self.assertEqual(job.attempts, 1)
        self.assertEqual(job.error_code, "smtp_connection")
        self.assertIsNone(process_one())
        MailJob.objects.update(available_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(process_one(), "sent")
        self.assertEqual(len(mail.outbox), 1)

    def test_permanent_failure_is_not_retried(self):
        import smtplib
        self.register()
        with patch("apps.accounts.outbox._deliver", side_effect=smtplib.SMTPAuthenticationError(535, b"private")):
            self.assertEqual(process_one(), "failed")
        self.assertIsNone(process_one())
        self.assertEqual(MailJob.objects.get().error_code, "smtp_authentication")

    def test_claim_excludes_active_worker_and_recovers_stale_worker(self):
        self.register()
        first = claim_job()
        self.assertIsNone(claim_job())
        MailJob.objects.update(claimed_at=timezone.now() - timedelta(minutes=6))
        second = claim_job()
        self.assertNotEqual(first.claim_id, second.claim_id)
        self.assertEqual(second.attempts, 2)

    def test_stale_claim_stops_at_attempt_limit(self):
        self.register()
        MailJob.objects.update(status="processing", claimed_at=timezone.now() - timedelta(minutes=6), attempts=5)
        with patch("apps.accounts.outbox._deliver") as deliver:
            self.assertEqual(process_one(), "failed")
        deliver.assert_not_called()

    def test_reminders_are_deduplicated_and_cancelled_class_is_skipped(self):
        student = self.register()
        student.is_active = True
        student.save()
        tutor = User.objects.create_user(email="tutor@example.org", password="x", full_name="Tutor", role="instructor", is_active=True)
        course = Course.objects.create(title="Course", category=Category.objects.create(name="Skills"), instructor=tutor)
        Enrollment.objects.create(student=student, course=course)
        live = LiveClass.objects.create(course=course, title="Class", scheduled_start=timezone.now() + timedelta(minutes=15))
        self.assertEqual(enqueue_reminders(), 1)
        self.assertEqual(enqueue_reminders(), 0)
        live.status = "cancelled"
        live.save()
        self.assertEqual(process_one(), "skipped")
        self.assertEqual(process_one(), "skipped")

    def test_cron_command_processes_mail(self):
        self.register()
        output = StringIO()
        call_command("process_mail_queue", limit=5, stdout=output)
        self.assertEqual(MailJob.objects.get().status, "sent")
        self.assertIn("sent", output.getvalue())

    def test_database_cache_is_shared_between_instances(self):
        first = DatabaseCache("vaceup_cache", {})
        second = DatabaseCache("vaceup_cache", {})
        first.set("probe", "shared", 30)
        self.assertEqual(second.get("probe"), "shared")

    def test_rate_limits_are_shared_and_expire(self):
        request = APIRequestFactory().get("/", REMOTE_ADDR="203.0.113.10")
        from django.contrib.auth.models import AnonymousUser
        request.user = AnonymousUser()
        def limiter():
            throttle = DatabaseAnonRateThrottle()
            throttle.num_requests = 2
            return throttle
        self.assertTrue(limiter().allow_request(request, None))
        self.assertTrue(limiter().allow_request(request, None))
        third = limiter()
        self.assertFalse(third.allow_request(request, None))
        self.assertGreater(third.wait(), 0)
        self.assertNotIn("203.0.113.10", RateLimitBucket.objects.get().key)
        RateLimitBucket.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertTrue(limiter().allow_request(request, None))
