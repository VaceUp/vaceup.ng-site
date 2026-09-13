from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from asgiref.sync import async_to_sync
from asgiref.testing import ApplicationCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from django.test import SimpleTestCase, TransactionTestCase, skipUnlessDBFeature
from rest_framework.test import APIRequestFactory

from apps.accounts import services
from apps.accounts.outbox import claim_job
from apps.core.throttling import DatabaseAnonRateThrottle


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
        def attempt():
            request = APIRequestFactory().get("/", REMOTE_ADDR="203.0.113.7")
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
