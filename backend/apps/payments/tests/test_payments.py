"""Tests for the Paystack payment flow (gateway mocked; no network)."""
import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollment.models import Enrollment
from apps.payments.models import Payment

User = get_user_model()

INIT = "/api/v1/payments/initialize/"
VERIFY = "/api/v1/payments/verify/"
WEBHOOK = "/api/v1/payments/webhook/"
SECRET = "sk_test_secret"


class FakeGateway:
    def __init__(self, verify_data=None):
        self.verify_data = verify_data or {}

    def initialize(self, *, reference, amount, email, callback_url=None):
        return {"authorization_url": f"https://pay/{reference}",
                "access_code": "acc_123"}

    def verify(self, *, reference):
        return self.verify_data


def success_data(amount_kobo=500000):
    return {"status": "success", "amount": amount_kobo, "currency": "NGN"}


@override_settings(SECURE_SSL_REDIRECT=False, PAYSTACK_SECRET_KEY=SECRET)
class PaymentTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.instr = User.objects.create_user(
            email="i@vaceup.ng", password="x", full_name="Ins",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s@vaceup.ng", password="x", full_name="Stud",
            role=User.Role.STUDENT, is_active=True)
        self.other = User.objects.create_user(
            email="o@vaceup.ng", password="x", full_name="Other",
            role=User.Role.STUDENT, is_active=True)
        self.cat = Category.objects.create(name="Cat")
        self.paid = Course.objects.create(
            title="Paid", category=self.cat, instructor=self.instr,
            price=Decimal("5000.00"), is_published=True)
        m = Module.objects.create(course=self.paid, title="M", order=1)
        Lesson.objects.create(module=m, title="L1", order=1)
        self.free = Course.objects.create(
            title="Free", category=self.cat, instructor=self.instr,
            price=Decimal("0.00"), is_published=True)

    # --- initialize ---------------------------------------------------------
    def test_initialize_returns_authorization_url(self):
        self.client.force_authenticate(self.student)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway()):
            r = self.client.post(INIT, {"course": self.paid.id}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["authorization_url"])
        self.assertEqual(r.data["status"], "pending")
        self.assertEqual(Payment.objects.filter(student=self.student).count(), 1)

    def test_initialize_is_idempotent_reuses_pending(self):
        self.client.force_authenticate(self.student)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway()):
            r1 = self.client.post(INIT, {"course": self.paid.id}, format="json")
            r2 = self.client.post(INIT, {"course": self.paid.id}, format="json")
        self.assertEqual(r1.data["reference"], r2.data["reference"])
        self.assertEqual(Payment.objects.filter(student=self.student).count(), 1)

    def test_initialize_free_course_rejected(self):
        self.client.force_authenticate(self.student)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway()):
            r = self.client.post(INIT, {"course": self.free.id}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["error"]["code"], "course_free")

    def test_initialize_already_enrolled_rejected(self):
        Enrollment.objects.create(student=self.student, course=self.paid)
        self.client.force_authenticate(self.student)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway()):
            r = self.client.post(INIT, {"course": self.paid.id}, format="json")
        self.assertEqual(r.status_code, 409)

    def test_initialize_requires_student(self):
        self.client.force_authenticate(self.instr)
        r = self.client.post(INIT, {"course": self.paid.id}, format="json")
        self.assertEqual(r.status_code, 403)

    # --- verify -------------------------------------------------------------
    def _make_payment(self):
        return Payment.objects.create(
            student=self.student, course=self.paid, amount=Decimal("5000.00"))

    def test_verify_success_enrols_student(self):
        p = self._make_payment()
        self.client.force_authenticate(self.student)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway(success_data())):
            r = self.client.post(VERIFY, {"reference": p.reference},
                                 format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "success")
        self.assertTrue(Enrollment.objects.filter(
            student=self.student, course=self.paid,
            status=Enrollment.Status.ACTIVE).exists())

    def test_verify_is_idempotent(self):
        p = self._make_payment()
        self.client.force_authenticate(self.student)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway(success_data())):
            self.client.post(VERIFY, {"reference": p.reference}, format="json")
            self.client.post(VERIFY, {"reference": p.reference}, format="json")
        self.assertEqual(Enrollment.objects.filter(
            student=self.student, course=self.paid).count(), 1)

    def test_verify_amount_mismatch_fails(self):
        p = self._make_payment()
        self.client.force_authenticate(self.student)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway(success_data(amount_kobo=100000))):
            r = self.client.post(VERIFY, {"reference": p.reference},
                                 format="json")
        self.assertEqual(r.status_code, 402)
        self.assertEqual(r.data["error"]["code"], "payment_failed")
        p.refresh_from_db()
        self.assertEqual(p.status, Payment.Status.FAILED)
        self.assertFalse(Enrollment.objects.filter(student=self.student).exists())

    def test_verify_unsuccessful_marks_abandoned(self):
        p = self._make_payment()
        self.client.force_authenticate(self.student)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway({"status": "abandoned", "amount": 0})):
            r = self.client.post(VERIFY, {"reference": p.reference},
                                 format="json")
        self.assertEqual(r.status_code, 402)
        p.refresh_from_db()
        self.assertEqual(p.status, Payment.Status.ABANDONED)

    def test_verify_other_users_payment_is_404(self):
        p = self._make_payment()
        self.client.force_authenticate(self.other)
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway(success_data())):
            r = self.client.post(VERIFY, {"reference": p.reference},
                                 format="json")
        self.assertEqual(r.status_code, 404)

    # --- webhook ------------------------------------------------------------
    def _sign(self, body: bytes):
        return hmac.new(SECRET.encode(), body, hashlib.sha512).hexdigest()

    def test_webhook_success_enrols(self):
        p = self._make_payment()
        body = json.dumps({"event": "charge.success",
                           "data": {"reference": p.reference}}).encode()
        with patch("apps.payments.services.get_gateway",
                   return_value=FakeGateway(success_data())):
            r = self.client.post(
                WEBHOOK, data=body, content_type="application/json",
                HTTP_X_PAYSTACK_SIGNATURE=self._sign(body))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(Enrollment.objects.filter(
            student=self.student, course=self.paid).exists())

    def test_webhook_bad_signature_rejected(self):
        p = self._make_payment()
        body = json.dumps({"event": "charge.success",
                           "data": {"reference": p.reference}}).encode()
        r = self.client.post(
            WEBHOOK, data=body, content_type="application/json",
            HTTP_X_PAYSTACK_SIGNATURE="deadbeef")
        self.assertEqual(r.status_code, 401)
        self.assertFalse(Enrollment.objects.filter(student=self.student).exists())
