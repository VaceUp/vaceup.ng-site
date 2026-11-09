"""A captured payment must unlock the course even when no webhook arrives."""
from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.applications.models import Application
from apps.core.exceptions import PaymentProviderUnavailable
from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.payments.models import Payment

User = get_user_model()

APPLICATIONS = "/api/v1/dashboard/applications/"
OVERVIEW = "/api/v1/dashboard/overview/"
HISTORY = "/api/v1/dashboard/payments/"
SECRET = "sk_test_secret"


def old_enough(payment, seconds=120):
    """Age the row past the dashboard's re-check guard."""
    Payment.objects.filter(pk=payment.pk).update(
        updated_at=timezone.now() - timedelta(seconds=seconds)
    )


@override_settings(SECURE_SSL_REDIRECT=False, PAYSTACK_SECRET_KEY=SECRET)
class PaymentReconciliationTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.tutor = User.objects.create_user(
            email="i@vaceup.ng", password="x", full_name="Tutor",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s@vaceup.ng", password="x", full_name="Learner",
            role=User.Role.STUDENT, is_active=True)
        category = Category.objects.create(name="Skills")
        self.course = Course.objects.create(
            title="Paid course", category=category, instructor=self.tutor,
            price=Decimal("5000.00"), is_published=True)
        Application.objects.create(
            student=self.student, course=self.course,
            status=Application.Status.APPROVED, reviewed_at=timezone.now())
        self.payment = Payment.objects.create(
            student=self.student, course=self.course, amount=Decimal("5000.00"))
        self.client.force_authenticate(self.student)

    def confirmed(self, payment=None):
        payment = payment or self.payment
        return {
            "status": "success", "amount": 500000, "currency": "NGN",
            "reference": payment.reference,
        }

    def test_opening_the_dashboard_settles_a_captured_payment(self):
        old_enough(self.payment)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.return_value = self.confirmed()
            response = self.client.get(APPLICATIONS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.SUCCESS)
        self.assertIsNotNone(self.payment.paid_at)
        self.assertTrue(Enrollment.objects.filter(
            student=self.student, course=self.course,
            status=Enrollment.Status.ACTIVE).exists())

    def test_overview_stops_asking_for_a_payment_already_captured(self):
        old_enough(self.payment)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.return_value = self.confirmed()
            response = self.client.get(OVERVIEW)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["approved_applications"], [])
        self.assertNotIn(
            "payment", [task["kind"] for task in response.data["tasks"]])

    def test_a_provider_outage_leaves_the_dashboard_working(self):
        old_enough(self.payment)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.side_effect = PaymentProviderUnavailable()
            response = self.client.get(APPLICATIONS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.PENDING)

    def test_an_unpaid_checkout_is_not_reported_as_paid(self):
        old_enough(self.payment)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.return_value = {
                "status": "abandoned", "amount": 500000, "currency": "NGN",
                "reference": self.payment.reference,
            }
            response = self.client.get(APPLICATIONS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.ABANDONED)
        self.assertFalse(Enrollment.objects.filter(student=self.student).exists())

    def test_no_provider_call_without_an_accepted_application(self):
        Application.objects.filter(student=self.student).update(
            status=Application.Status.SUBMITTED)
        old_enough(self.payment)
        with patch("apps.payments.services.get_gateway") as gateway:
            response = self.client.get(APPLICATIONS)
        self.assertEqual(response.status_code, 200)
        gateway.assert_not_called()
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.PENDING)

    def test_payment_history_settles_a_direct_purchase(self):
        # Bought from the public course page: no application was ever made.
        Application.objects.all().delete()
        old_enough(self.payment)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.return_value = self.confirmed()
            response = self.client.get(HISTORY)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["status"], Payment.Status.SUCCESS)
        self.assertTrue(Enrollment.objects.filter(
            student=self.student, course=self.course,
            status=Enrollment.Status.ACTIVE).exists())

    def test_payment_history_survives_a_provider_outage(self):
        old_enough(self.payment)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.side_effect = PaymentProviderUnavailable()
            response = self.client.get(HISTORY)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["status"], Payment.Status.PENDING)

    def test_command_settles_every_captured_payment(self):
        old_enough(self.payment)
        out = StringIO()
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.return_value = self.confirmed()
            call_command("reconcile_payments", "--min-age", "0", stdout=out)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.SUCCESS)
        self.assertTrue(Enrollment.objects.filter(
            student=self.student, course=self.course).exists())
        self.assertIn("1 confirmed and enrolled", out.getvalue())

    def test_command_is_idempotent(self):
        old_enough(self.payment)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.return_value = self.confirmed()
            call_command("reconcile_payments", "--min-age", "0", stdout=StringIO())
            gateway.reset_mock()
            call_command("reconcile_payments", "--min-age", "0", stdout=StringIO())
        self.assertEqual(Enrollment.objects.filter(
            student=self.student, course=self.course).count(), 1)
        gateway.return_value.verify.assert_not_called()
