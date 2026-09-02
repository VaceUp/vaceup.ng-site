"""Tests for the instructor dashboard stats + student roster."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollment.models import Enrollment
from apps.liveclasses.models import LiveClass
from apps.payments.models import Payment

User = get_user_model()

DASH = "/api/v1/instructor/dashboard/"
STUDENTS = "/api/v1/instructor/students/"


@override_settings(SECURE_SSL_REDIRECT=False)
class DashboardTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.instr = User.objects.create_user(
            email="i@vaceup.ng", password="x", full_name="Ins",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.s1 = User.objects.create_user(
            email="s1@vaceup.ng", password="x", full_name="S1",
            role=User.Role.STUDENT, is_active=True)
        self.s2 = User.objects.create_user(
            email="s2@vaceup.ng", password="x", full_name="S2",
            role=User.Role.STUDENT, is_active=True)
        self.cat = Category.objects.create(name="Cat")
        self.free = Course.objects.create(
            title="Free", category=self.cat, instructor=self.instr,
            price=0, is_published=True)
        self.paid = Course.objects.create(
            title="Paid", category=self.cat, instructor=self.instr,
            price=Decimal("5000.00"), is_published=False)
        Enrollment.objects.create(student=self.s1, course=self.free,
                                  status=Enrollment.Status.ACTIVE)
        Enrollment.objects.create(student=self.s2, course=self.free,
                                  status=Enrollment.Status.COMPLETED)
        # A successful payment counts toward revenue.
        Payment.objects.create(student=self.s2, course=self.paid,
                               amount=Decimal("5000.00"),
                               status=Payment.Status.SUCCESS)
        LiveClass.objects.create(
            course=self.free, title="Upcoming",
            scheduled_start=timezone.now() + timezone.timedelta(days=1),
            status=LiveClass.Status.SCHEDULED, join_url="https://m/x")

    def test_dashboard_numbers(self):
        self.client.force_authenticate(self.instr)
        r = self.client.get(DASH)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["courses"], {"total": 2, "published": 1})
        self.assertEqual(r.data["students"], 2)
        self.assertEqual(r.data["enrollments"],
                         {"active": 1, "completed": 1})
        self.assertEqual(r.data["revenue"], "5000.00")
        self.assertEqual(r.data["upcoming_classes"], 1)
        self.assertEqual(len(r.data["recent_enrollments"]), 2)

    def test_students_roster_scoped_to_instructor(self):
        self.client.force_authenticate(self.instr)
        r = self.client.get(STUDENTS)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)
        emails = {row["email"] for row in r.data["results"]}
        self.assertEqual(emails, {"s1@vaceup.ng", "s2@vaceup.ng"})

    def test_student_cannot_access_dashboard(self):
        self.client.force_authenticate(self.s1)
        self.assertEqual(self.client.get(DASH).status_code, 403)
        self.assertEqual(self.client.get(STUDENTS).status_code, 403)
