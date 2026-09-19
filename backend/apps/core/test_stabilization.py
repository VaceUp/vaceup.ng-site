"""Regression coverage for security issues reproduced by the launch audit."""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from apps.announcements.models import Announcement, AnnouncementComment
from apps.cart.models import Cart, CartItem
from apps.codeeditor.models import CodeEditorSession, CodeExecution
from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.whiteboard.models import WhiteboardSession
from apps.applications.models import Application
from apps.applications.services import application_review


class LaunchSecurityTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        User = get_user_model()
        self.admin = User.objects.create_user(email="admin@example.test", password="test", role="admin", is_active=True)
        self.tutor = User.objects.create_user(email="tutor@example.test", password="test", role="instructor", is_active=True)
        self.student = User.objects.create_user(email="student@example.test", password="test", is_active=True)
        self.course = Course.objects.create(title="Paid course", category=Category.objects.create(name="Skills"), instructor=self.tutor, price=Decimal("5000"), is_published=True)
        self.client.force_authenticate(self.student)

    def test_price_override_cannot_create_or_update_cart(self):
        response = self.client.post("/api/v1/cart/", {"course": self.course.pk, "price_override": "0.00"}, format="json")
        self.assertEqual(response.status_code, 400)
        cart = Cart.objects.get_or_create(user=self.student)[0]
        item = CartItem.objects.create(cart=cart, course=self.course)
        response = self.client.patch(f"/api/v1/cart/{item.pk}/", {"price_override": "0.00"}, format="json")
        self.assertEqual(response.status_code, 400)
        item.refresh_from_db()
        self.assertIsNone(item.price_override)

    def test_existing_override_cannot_discount_new_order(self):
        item = CartItem.objects.create(cart=Cart.objects.create(user=self.student), course=self.course, price_override=0)
        with patch("apps.payments.services.get_gateway") as gateway:
            gateway.return_value.initialize.return_value = {"authorization_url": "https://checkout.paystack.com/test", "access_code": "test"}
            response = self.client.post("/api/v1/payments/checkout/", {"cart_items": [item.pk]}, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(gateway.return_value.initialize.call_args.kwargs["amount"], Decimal("5000"))
        self.assertFalse(Enrollment.objects.filter(student=self.student).exists())

    def test_paid_application_approval_does_not_grant_access(self):
        application = Application.objects.create(student=self.student, course=self.course)
        application_review(application=application, reviewer=self.admin, action="approve")
        application.refresh_from_db()
        self.assertEqual(application.status, "approved")
        self.assertFalse(Enrollment.objects.filter(student=self.student, course=self.course).exists())

    def test_unfinished_classroom_http_endpoints_are_closed(self):
        board = WhiteboardSession.objects.create(room_id=uuid4())
        code = CodeEditorSession.objects.create(room_id=uuid4())
        CodeExecution.objects.create(session=code, user=self.tutor, code="private", language="python")
        for path in [f"whiteboard/sessions/{board.pk}/", f"code-editor/sessions/{code.pk}/history/"]:
            self.assertEqual(self.client.get("/api/v1/" + path).status_code, 403)
        self.assertEqual(self.client.post(f"/api/v1/whiteboard/sessions/{board.pk}/stroke/", {}, format="json").status_code, 403)

    def test_only_current_correct_audience_announcements_are_visible(self):
        now = timezone.now()
        for changes in [{"status": "draft"}, {"publish_at": now + timedelta(days=1)}, {"expires_at": now - timedelta(seconds=1)}, {"target": "admins"}, {"target": "enrolled_users"}]:
            data = {"author": self.admin, "title": "Restricted", "body": "Private", "status": "published", "publish_at": now, "target": "all", **changes}
            notice = Announcement.objects.create(**data)
            notice.target_courses.add(self.course)
            self.assertEqual(self.client.get(f"/api/v1/announcements/{notice.pk}/").status_code, 404)
            self.assertEqual(self.client.get(f"/api/v1/announcements/{notice.pk}/comments/").status_code, 404)
            self.assertEqual(self.client.post(f"/api/v1/announcements/{notice.pk}/read/").status_code, 404)
        public = Announcement.objects.create(author=self.admin, title="Public", body="Hello", status="published", publish_at=now, target="all")
        self.assertEqual(self.client.get(f"/api/v1/announcements/{public.pk}/").status_code, 200)
        response = self.client.get("/api/v1/announcements/")
        self.assertEqual([item["id"] for item in response.data["results"]], [public.pk])

    def test_tutor_cannot_read_admin_target(self):
        notice = Announcement.objects.create(author=self.admin, title="Admin only", body="Private", status="published", publish_at=timezone.now(), target="admins")
        self.client.force_authenticate(self.tutor)
        self.assertEqual(self.client.get(f"/api/v1/announcements/{notice.pk}/").status_code, 404)

    def test_user_deletion_route_is_present_before_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/admin/dashboard/users/{self.student.pk}/deletion/").status_code, 401)
