from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from asgiref.sync import async_to_sync
from asgiref.testing import ApplicationCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import OperationalError, close_old_connections, transaction
from django.test import SimpleTestCase, TransactionTestCase, skipUnlessDBFeature
from rest_framework.test import APIRequestFactory

from apps.accounts import services
from apps.accounts.outbox import claim_job
from apps.core.throttling import DatabaseAnonRateThrottle, RateLimitUnavailable


class WebsocketDeploymentTests(SimpleTestCase):
    def test_disabled_websocket_closes_without_redis(self):
        from config.asgi import application

        async def exercise():
            communicator = ApplicationCommunicator(application, {"type": "websocket", "path": "/ws/presence/arbitrary/", "headers": []})
            await communicator.send_input({"type": "websocket.connect"})
            event = await communicator.receive_output(timeout=1)
            self.assertEqual(event, {"type": "websocket.close", "code": 4403})
            await communicator.wait(timeout=1)
        async_to_sync(exercise)()


class RateLimitFailureTests(TransactionTestCase):
    def attempt(self):
        request = APIRequestFactory().get('/', REMOTE_ADDR='203.0.113.7')
        request.user = AnonymousUser()
        return DatabaseAnonRateThrottle().allow_request(request, None)

    def test_transient_deadlock_retries_without_counting_twice(self):
        from apps.core.models import RateLimitBucket
        original = RateLimitBucket.objects.get_or_create
        calls = []
        def flaky(*args, **kwargs):
            calls.append(1)
            if len(calls) == 1:
                raise OperationalError(1213, 'synthetic deadlock')
            return original(*args, **kwargs)
        with patch.object(RateLimitBucket.objects, 'get_or_create', side_effect=flaky):
            self.assertTrue(self.attempt())
        self.assertEqual(len(calls), 2)
        self.assertEqual(RateLimitBucket.objects.get().count, 1)

    def test_failures_are_closed_and_retries_are_bounded(self):
        from apps.core.models import RateLimitBucket
        for code, calls in ((1213, 3), (2003, 1), (1146, 1)):
            with patch.object(RateLimitBucket.objects, 'get_or_create', side_effect=OperationalError(code, 'synthetic private database detail')) as operation:
                with self.assertRaises(RateLimitUnavailable) as caught:
                    self.attempt()
                self.assertEqual(operation.call_count, calls)
                self.assertEqual(caught.exception.status_code, 503)
                self.assertNotIn('private', str(caught.exception))
        self.assertFalse(RateLimitBucket.objects.exists())

    def test_does_not_retry_a_caller_owned_transaction(self):
        from apps.core.models import RateLimitBucket
        with transaction.atomic(), patch.object(RateLimitBucket.objects, 'get_or_create', side_effect=OperationalError(1213, 'deadlock')) as operation:
            with self.assertRaises(RateLimitUnavailable):
                self.attempt()
            self.assertEqual(operation.call_count, 1)


@skipUnlessDBFeature("has_select_for_update")
class DatabaseConcurrencyTests(TransactionTestCase):
    """Run against MySQL in CI; SQLite cannot establish these guarantees."""

    def concurrent(self, function, count=5):
        barrier = Barrier(count)
        def run(_):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return function()
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=count) as executor:
            return list(executor.map(run, range(count)))

    def test_shared_rate_limit_is_atomic(self):
        # Exercise competing initialization, not only an already-existing row.
        for batch in range(10):
            def attempt():
                request = APIRequestFactory().get("/", REMOTE_ADDR=f"203.0.113.{7 + batch}")
                request.user = AnonymousUser()
                throttle = DatabaseAnonRateThrottle()
                throttle.num_requests = 3
                return throttle.allow_request(request, None)
            self.assertEqual(sum(self.concurrent(attempt)), 3)

    def test_overlapping_mail_workers_claim_once(self):
        from django.test import override_settings
        with override_settings(ACCOUNT_EMAIL_DELIVERY_MODE="database"):
            services.register_user(email="worker@example.org", full_name="Worker", password="test-only-password")
        self.assertEqual(sum(job is not None for job in self.concurrent(claim_job)), 1)

    def test_concurrent_checkout_reuses_one_order(self):
        from apps.courses.models import Category, Course
        from apps.payments.services import initialize_payment
        User = get_user_model()
        tutor = User.objects.create_user(email="t@example.org", password="x", full_name="Tutor", role="instructor", is_active=True)
        student = User.objects.create_user(email="s@example.org", password="x", full_name="Student", role="student", is_active=True)
        course = Course.objects.create(title="Course", category=Category.objects.create(name="Skills"), instructor=tutor, price=5000, is_published=True)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.initialize.return_value = {"authorization_url": "https://checkout.paystack.com/test", "access_code": "test"}
            results = self.concurrent(lambda: initialize_payment(student=student, course=course).pk)
        self.assertEqual(len(set(results)), 1)
