"""Regression tests for the 2026-10-31 hardening pass."""
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase
from PIL import Image
from rest_framework.test import APITestCase

from apps.accounts.models import EmailVerificationToken, PasswordResetToken
from apps.accounts.services import change_password
from apps.certificates import services as certificate_services
from apps.core.middleware import (
    TrustedProxySchemeMiddleware,
    is_cloudflare_edge,
    is_trusted_proxy,
)
from apps.courses.models import Category, Course
from apps.payments.views import paystack_webhook

User = get_user_model()


def _png_bytes(size=(240, 90), colour=(20, 20, 20)):
    image = Image.new("RGB", size, (255, 255, 255))
    for x in range(size[0]):
        for y in range(size[1]):
            if (x * 7 + y * 13) % 11 == 0:
                image.putpixel((x, y), colour)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class ProxyTrustTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = TrustedProxySchemeMiddleware(lambda request: request)

    def test_cloudflare_edge_is_recognised(self):
        self.assertTrue(is_cloudflare_edge("104.21.1.26"))
        self.assertTrue(is_cloudflare_edge("2606:4700::1"))
        self.assertFalse(is_cloudflare_edge("203.0.113.10"))

    def test_loopback_and_lan_peers_are_trusted_proxies(self):
        self.assertTrue(is_trusted_proxy("127.0.0.1"))
        self.assertTrue(is_trusted_proxy("10.0.0.5"))
        self.assertFalse(is_trusted_proxy("203.0.113.10"))

    def test_spoofed_forwarded_proto_is_removed_for_an_unknown_peer(self):
        request = self.factory.get("/api/v1/courses/")
        request.META["REMOTE_ADDR"] = "203.0.113.10"
        request.META["HTTP_X_FORWARDED_PROTO"] = "https"
        self.middleware(request)
        self.assertNotIn("HTTP_X_FORWARDED_PROTO", request.META)
        self.assertFalse(request.is_secure())

    def test_forwarded_proto_survives_from_cloudflare(self):
        request = self.factory.get("/api/v1/courses/")
        request.META["REMOTE_ADDR"] = "104.21.1.26"
        request.META["HTTP_X_FORWARDED_PROTO"] = "https"
        self.middleware(request)
        self.assertEqual(request.META["HTTP_X_FORWARDED_PROTO"], "https")
        self.assertTrue(request.is_secure())

    def test_visitor_address_is_restored_from_cloudflare(self):
        request = self.factory.get("/api/v1/courses/")
        request.META["REMOTE_ADDR"] = "104.21.1.26"
        request.META["HTTP_CF_CONNECTING_IP"] = "198.51.100.7"
        self.middleware(request)
        self.assertEqual(request.META["REMOTE_ADDR"], "198.51.100.7")

    def test_direct_origin_request_keeps_its_own_address(self):
        request = self.factory.get("/api/v1/courses/")
        request.META["REMOTE_ADDR"] = "203.0.113.10"
        request.META["HTTP_CF_CONNECTING_IP"] = "198.51.100.7"
        self.middleware(request)
        self.assertEqual(request.META["REMOTE_ADDR"], "203.0.113.10")


class SignatureStorageTests(APITestCase):
    def test_signature_is_stored_small_enough_for_a_text_column(self):
        payload = _png_bytes(size=(2400, 1200))
        upload = SimpleUploadedFile("signature.png", payload, content_type="image/png")
        data_url = certificate_services._decode_signature_upload(upload)
        self.assertTrue(data_url.startswith("data:image/"))
        # MySQL caps TEXT at 65,535 bytes; base64 grows the payload by a third.
        self.assertLess(len(data_url), 60_000)

    def test_a_non_image_is_rejected(self):
        upload = SimpleUploadedFile("signature.png", b"not an image", content_type="image/png")
        with self.assertRaises(Exception):
            certificate_services._decode_signature_upload(upload)

    def test_an_unsupported_type_is_rejected(self):
        upload = SimpleUploadedFile("signature.svg", b"<svg/>", content_type="image/svg+xml")
        with self.assertRaises(Exception):
            certificate_services._decode_signature_upload(upload)


class UploadExtensionTests(TestCase):
    def test_a_course_cover_must_carry_an_image_extension(self):
        category = Category.objects.create(name="Skills")
        course = Course(title="Course", category=category)
        course.thumbnail = "course/thumbnails/cover.php"
        with self.assertRaises(ValidationError):
            course.full_clean()


class AccountTokenTests(APITestCase):
    def test_changing_the_password_retires_outstanding_links(self):
        user = User.objects.create_user(
            email="p@example.org", password="old-password-123", full_name="Person", is_active=True,
        )
        verification = EmailVerificationToken.objects.create(user=user)
        reset = PasswordResetToken.objects.create(user=user)

        change_password(user=user, new_password="new-password-456")

        verification.refresh_from_db()
        reset.refresh_from_db()
        self.assertTrue(verification.used)
        self.assertTrue(reset.used)


class WebhookThrottleTests(TestCase):
    def test_the_webhook_uses_its_own_rate_limit_scope(self):
        self.assertEqual(paystack_webhook.throttle_scope, "payment_webhook")
