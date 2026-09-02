"""Tests for shopping cart and checkout."""

import django
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.cart.models import Cart, CartItem
from apps.courses.models import Course, Category
from apps.enrollment.models import Enrollment
from apps.payments.models import Payment

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class CartTests(APITestCase):
    """Cart management and checkout."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

        self.category = Category.objects.create(name="Test")

        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_active=True, is_staff=True)
        self.instr = User.objects.create_user(
            email="i1@vaceup.ng", password="x", full_name="Instructor",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s1@vaceup.ng", password="x", full_name="Student",
            role=User.Role.STUDENT, is_active=True)

        self.course = Course.objects.create(
            title="Test Course", category=self.category,
            instructor=self.instr, price=10000, is_published=True)
        self.course2 = Course.objects.create(
            title="Test Course 2", category=self.category,
            instructor=self.instr, price=5000, is_published=True)

        Enrollment.objects.create(student=self.student, course=self.course2,
                                  status=Enrollment.Status.ACTIVE)

    def test_student_can_view_empty_cart(self):
        self.client.force_authenticate(self.student)
        r = self.client.get("/api/v1/cart/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["item_count"], 0)

    def test_student_can_add_course_to_cart(self):
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/cart/", {
            "course": self.course.id
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["course"]["id"], self.course.id)
        self.assertEqual(r.data["effective_price"], "10000.00")

    def test_student_cannot_add_course_twice(self):
        self.client.force_authenticate(self.student)
        self.client.post("/api/v1/cart/", {"course": self.course.id}, format="json")
        r = self.client.post("/api/v1/cart/", {"course": self.course.id}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_student_cannot_add_enrolled_course(self):
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/cart/", {"course": self.course2.id}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_student_can_remove_item(self):
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/cart/", {"course": self.course.id}, format="json")
        item_id = r.data["id"]
        r = self.client.delete(f"/api/v1/cart/{item_id}/")
        self.assertEqual(r.status_code, 204)
        self.assertEqual(CartItem.objects.count(), 0)

    def test_student_can_clear_cart(self):
        self.client.force_authenticate(self.student)
        self.client.post("/api/v1/cart/", {"course": self.course.id}, format="json")
        r = self.client.delete("/api/v1/cart/clear/")
        self.assertEqual(r.status_code, 204)
        self.assertEqual(CartItem.objects.count(), 0)

    def test_cart_shows_correct_totals(self):
        self.client.force_authenticate(self.student)
        self.client.post("/api/v1/cart/", {"course": self.course.id}, format="json")
        r = self.client.get("/api/v1/cart/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["item_count"], 1)
        self.assertEqual(r.data["subtotal"], "10000.00")


@override_settings(SECURE_SSL_REDIRECT=False)
class CartCheckoutTests(APITestCase):
    """Cart checkout flow with Paystack."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

        self.category = Category.objects.create(name="Test")

        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_active=True, is_staff=True)
        self.instr = User.objects.create_user(
            email="i1@vaceup.ng", password="x", full_name="Instructor",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s1@vaceup.ng", password="x", full_name="Student",
            role=User.Role.STUDENT, is_active=True)

        self.course = Course.objects.create(
            title="Test Course", category=self.category,
            instructor=self.instr, price=10000, is_published=True)
        self.course2 = Course.objects.create(
            title="Test Course 2", category=self.category,
            instructor=self.instr, price=5000, is_published=True)

    def test_student_can_checkout_cart(self):
        self.client.force_authenticate(self.student)
        r1 = self.client.post("/api/v1/cart/", {"course": self.course.id}, format="json")
        r2 = self.client.post("/api/v1/cart/", {"course": self.course2.id}, format="json")
        item_ids = [r1.data["id"], r2.data["id"]]

        r = self.client.post("/api/v1/payments/checkout/", {
            "cart_items": item_ids
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIn("authorization_url", r.data)
        self.assertEqual(r.data["amount"], "15000.00")

    def test_checkout_validates_cart_items(self):
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/payments/checkout/", {
            "cart_items": ["00000000-0000-0000-0000-000000000000"]
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_checkout_empty_cart(self):
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/payments/checkout/", {
            "cart_items": []
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_checkout_empty_cart(self):
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/payments/checkout/", {
            "cart_items": []
        }, format="json")
        self.assertEqual(r.status_code, 400)


@override_settings(SECURE_SSL_REDIRECT=False)
class PaymentWebhookTests(APITestCase):
    """Paystack webhook handling."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

        self.category = Category.objects.create(name="Test")

        self.instr = User.objects.create_user(
            email="i1@vaceup.ng", password="x", full_name="Instructor",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s1@vaceup.ng", password="x", full_name="Student",
            role=User.Role.STUDENT, is_active=True)

        self.course = Course.objects.create(
            title="Test Course", category=self.category,
            instructor=self.instr, price=10000, is_published=True)

    def test_webhook_rejects_invalid_signature(self):
        raw = b'{"event": "charge.success"}'
        bad_sig = "invalid_signature"
        r = self.client.post("/api/v1/payments/webhook/", data=raw, content_type="application/json",
                            HTTP_X_PAYSTACK_SIGNATURE=bad_sig)
        self.assertEqual(r.status_code, 401)

    def test_webhook_ignores_non_charge_events(self):
        import hmac, hashlib
        raw = b'{"event": "subscription.create", "data": {"reference": "test"}}'
        sig = hmac.new(b'sk_test_dummy', raw, hashlib.sha512).hexdigest()
        r = self.client.post("/api/v1/payments/webhook/", data=raw, content_type="application/json",
                            HTTP_X_PAYSTACK_SIGNATURE=sig)
        self.assertEqual(r.status_code, 200)

    def test_webhook_returns_200_for_unknown_reference(self):
        import hmac, hashlib
        raw = b'{"event": "charge.success", "data": {"reference": "unknown_ref"}}'
        sig = hmac.new(b'sk_test_dummy', raw, hashlib.sha512).hexdigest()
        r = self.client.post("/api/v1/payments/webhook/", data=raw, content_type="application/json",
                            HTTP_X_PAYSTACK_SIGNATURE=sig)
        self.assertEqual(r.status_code, 200)