"""Tests for the enrollment + progress loop."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollment.models import Enrollment

User = get_user_model()

ENROLLMENTS = "/api/v1/enrollments/"
COMPLETE = "/api/v1/enrollments/complete-lesson/"


@override_settings(SECURE_SSL_REDIRECT=False)
class EnrollmentTests(APITestCase):
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
            email="s2@vaceup.ng", password="x", full_name="Stud2",
            role=User.Role.STUDENT, is_active=True)
        self.cat = Category.objects.create(name="Cat")

    def _course(self, price="0.00", published=True):
        course = Course.objects.create(
            title="Course", category=self.cat, instructor=self.instr,
            price=Decimal(price), is_published=published)
        m = Module.objects.create(course=course, title="M", order=1)
        self.l1 = Lesson.objects.create(module=m, title="L1", order=1)
        self.l2 = Lesson.objects.create(module=m, title="L2", order=2)
        return course

    # --- enrolling ----------------------------------------------------------
    def test_student_enrolls_in_free_course(self):
        course = self._course()
        self.client.force_authenticate(self.student)
        r = self.client.post(ENROLLMENTS, {"course": course.id}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "active")
        self.assertEqual(Decimal(r.data["progress_percent"]), Decimal("0.00"))

    def test_enroll_is_idempotent(self):
        course = self._course()
        self.client.force_authenticate(self.student)
        r1 = self.client.post(ENROLLMENTS, {"course": course.id}, format="json")
        r2 = self.client.post(ENROLLMENTS, {"course": course.id}, format="json")
        self.assertEqual(r1.data["id"], r2.data["id"])
        self.assertEqual(Enrollment.objects.filter(student=self.student).count(), 1)

    def test_paid_course_requires_payment(self):
        course = self._course(price="5000.00")
        self.client.force_authenticate(self.student)
        r = self.client.post(ENROLLMENTS, {"course": course.id}, format="json")
        self.assertEqual(r.status_code, 402)
        self.assertEqual(r.data["error"]["code"], "payment_required")

    def test_instructor_cannot_enroll(self):
        course = self._course()
        self.client.force_authenticate(self.instr)
        r = self.client.post(ENROLLMENTS, {"course": course.id}, format="json")
        self.assertEqual(r.status_code, 403)

    # --- progress -----------------------------------------------------------
    def test_mark_lesson_complete_updates_progress(self):
        course = self._course()
        self.client.force_authenticate(self.student)
        self.client.post(ENROLLMENTS, {"course": course.id}, format="json")

        r = self.client.post(COMPLETE, {"lesson": self.l1.id}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Decimal(r.data["progress_percent"]), Decimal("50.00"))
        self.assertEqual(r.data["status"], "active")

    def test_completing_all_lessons_completes_enrollment(self):
        course = self._course()
        self.client.force_authenticate(self.student)
        self.client.post(ENROLLMENTS, {"course": course.id}, format="json")
        self.client.post(COMPLETE, {"lesson": self.l1.id}, format="json")
        r = self.client.post(COMPLETE, {"lesson": self.l2.id}, format="json")
        self.assertEqual(Decimal(r.data["progress_percent"]), Decimal("100.00"))
        self.assertEqual(r.data["status"], "completed")
        self.assertIsNotNone(r.data["completed_at"])

    def test_mark_complete_is_idempotent(self):
        course = self._course()
        self.client.force_authenticate(self.student)
        self.client.post(ENROLLMENTS, {"course": course.id}, format="json")
        self.client.post(COMPLETE, {"lesson": self.l1.id}, format="json")
        r = self.client.post(COMPLETE, {"lesson": self.l1.id}, format="json")
        self.assertEqual(Decimal(r.data["progress_percent"]), Decimal("50.00"))

    def test_cannot_complete_lesson_without_enrollment(self):
        course = self._course()
        self.client.force_authenticate(self.student)
        r = self.client.post(COMPLETE, {"lesson": self.l1.id}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["error"]["code"], "not_enrolled")

    # --- listing scope ------------------------------------------------------
    def test_list_returns_only_my_enrollments(self):
        course = self._course()
        self.client.force_authenticate(self.student)
        self.client.post(ENROLLMENTS, {"course": course.id}, format="json")
        self.client.force_authenticate(self.other)
        r = self.client.get(ENROLLMENTS)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 0)
