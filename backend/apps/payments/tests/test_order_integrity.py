from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.cart.models import Cart, CartItem
from apps.core.exceptions import PaymentFailed, PaymentProviderUnavailable
from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.payments.gateway import get_gateway
from apps.payments.models import Payment, PaymentItem
from apps.payments.services import verify_payment

User = get_user_model()


class OrderIntegrityTests(APITestCase):
    def setUp(self):
        self.tutor = User.objects.create_user(email="t@example.org", password="x", full_name="Tutor", role="instructor", is_active=True)
        self.student = User.objects.create_user(email="s@example.org", password="x", full_name="Learner", role="student", is_active=True)
        category = Category.objects.create(name="Skills")
        self.courses = [Course.objects.create(title=f"Course {i}", category=category, instructor=self.tutor, price=price, is_published=True) for i, price in enumerate([Decimal("5000.00"), Decimal("3000.00")])]
        self.cart = Cart.objects.create(user=self.student)
        self.items = [CartItem.objects.create(cart=self.cart, course=course) for course in self.courses]
        self.client.force_authenticate(self.student)

    def checkout(self):
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.initialize.return_value = {"authorization_url": "https://checkout.paystack.com/test", "access_code": "test"}
            response = self.client.post("/api/v1/payments/checkout/", {"cart_items": [item.pk for item in self.items]}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return Payment.objects.get(reference=response.data["reference"])

    def verified(self, payment, **changes):
        data = {"reference": payment.reference, "status": "success", "amount": 800000, "currency": "NGN", **changes}
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.return_value = data
            return verify_payment(reference=payment.reference, student=self.student)

    def test_cart_snapshot_survives_cart_deletion_and_gateway_overwrite(self):
        payment = self.checkout()
        self.assertEqual(payment.items.count(), 2)
        self.cart.delete()
        Course.objects.filter(pk=self.courses[0].pk).update(price=9999)
        self.verified(payment)
        self.assertEqual(Enrollment.objects.filter(student=self.student).count(), 2)
        self.assertEqual(PaymentItem.objects.get(payment=payment, course=self.courses[0]).amount, Decimal("5000"))
        self.verified(payment)
        self.assertEqual(Enrollment.objects.filter(student=self.student).count(), 2)

    def test_repeated_checkout_reuses_pending_order(self):
        first = self.checkout()
        second = self.checkout()
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(Payment.objects.count(), 1)

    def test_changed_quote_does_not_initialize_a_charge(self):
        with patch("apps.payments.services.get_gateway") as gateway:
            response = self.client.post("/api/v1/payments/checkout/", {
                "cart_items": [item.pk for item in self.items], "expected_total": "1.00",
            }, format="json")
        self.assertEqual(response.status_code, 400)
        gateway.assert_not_called()
        self.assertFalse(Payment.objects.exists())

    def test_changed_single_course_quote_does_not_initialize_a_charge(self):
        with patch("apps.payments.services.get_gateway") as gateway:
            response = self.client.post("/api/v1/payments/initialize/", {
                "course": self.courses[0].pk, "expected_total": "4000.00",
            }, format="json")
        self.assertEqual(response.status_code, 400)
        gateway.assert_not_called()

    def test_pending_gateway_status_is_not_reported_as_failed(self):
        payment = self.checkout()
        result = self.verified(payment, status="processing")
        self.assertEqual(result.status, Payment.Status.PENDING)
        self.assertFalse(Enrollment.objects.exists())

    def test_legacy_unverified_orders_require_reconciliation(self):
        payment = self.checkout()
        Payment.objects.filter(pk=payment.pk).update(pricing_version=0)
        with patch("apps.payments.services.get_gateway") as gateway:
            with self.assertRaisesMessage(PaymentFailed, "support reconciliation"):
                verify_payment(reference=payment.reference, student=self.student)
        gateway.assert_not_called()
        self.assertFalse(Enrollment.objects.exists())

    def test_legacy_success_does_not_create_new_access_on_replay(self):
        payment = self.checkout()
        Payment.objects.filter(pk=payment.pk).update(pricing_version=0, status=Payment.Status.SUCCESS)
        self.verified(payment)
        self.assertFalse(Enrollment.objects.exists())

    def test_cart_add_retry_has_one_item_and_prices_are_authoritative(self):
        for _ in range(2):
            response = self.client.post("/api/v1/cart/", {"course": self.courses[0].pk}, format="json")
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data["effective_price"], "5000.00")
        self.assertEqual(CartItem.objects.filter(cart=self.cart, course=self.courses[0]).count(), 1)

    def test_currency_reference_and_amount_must_match(self):
        for changes in [{"currency": "USD"}, {"reference": "wrong"}, {"amount": 800001}, {"amount": 799999}]:
            payment = self.checkout()
            with self.assertRaises(PaymentFailed):
                self.verified(payment, **changes)
            self.assertFalse(Enrollment.objects.exists())

    def test_callback_cannot_reactivate_suspended_enrollment(self):
        payment = self.checkout()
        self.verified(payment)
        Enrollment.objects.filter(student=self.student).update(status="suspended")
        self.verified(payment)
        self.assertEqual(Enrollment.objects.filter(status="suspended").count(), 2)

    def test_duplicate_or_foreign_cart_ids_are_rejected(self):
        response = self.client.post("/api/v1/payments/checkout/", {"cart_items": [self.items[0].pk, self.items[0].pk]}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post("/api/v1/payments/checkout/", {"cart_items": [999999]}, format="json")
        self.assertEqual(response.status_code, 400)

    @override_settings(PAYSTACK_SECRET_KEY="", PAYMENTS_ALLOW_FAKE=False)
    def test_missing_key_never_enables_fake_payments(self):
        with self.assertRaises(PaymentFailed):
            get_gateway()

    def test_transient_webhook_verification_failure_is_retryable(self):
        import hashlib
        import hmac
        import json
        from django.conf import settings
        payment = self.checkout()
        raw = json.dumps({"event": "charge.success", "data": {"reference": payment.reference}}).encode()
        signature = hmac.new(settings.PAYSTACK_SECRET_KEY.encode(), raw, hashlib.sha512).hexdigest()
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.verify.side_effect = PaymentProviderUnavailable()
            response = self.client.post("/api/v1/payments/webhook/", raw, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE=signature)
        self.assertEqual(response.status_code, 503)
        payment.refresh_from_db()
        self.assertEqual(payment.status, "pending")
        self.assertFalse(Enrollment.objects.exists())
