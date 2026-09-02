"""Tests for applications (admissions)."""

import django
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.applications.models import Application
from apps.courses.models import Course, Category
from apps.enrollment.models import Enrollment

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class ApplicationTests(APITestCase):
    """Student application submission, instructor/admin review."""

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
            instructor=self.instr, price=0, is_published=True)

    def _create_application(self, student=None, course=None, status=None):
        """Helper to create an application."""
        from apps.applications.models import Application
        if student is None:
            student = self.student
        if course is None:
            course = self.course
        app = Application.objects.create(
            student=student, course=course,
            motivation="I want to learn!")
        if status:
            app.status = status
            app.save()
        return app

    # --- submission ---
    def test_student_submits_application(self):
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/applications/", {
            "course": self.course.id,
            "motivation": "I want to learn!",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "submitted")
        self.assertEqual(Application.objects.count(), 1)

    def test_student_cannot_submit_twice(self):
        """Re-submission returns existing application."""
        self.client.force_authenticate(self.student)
        r1 = self.client.post("/api/v1/applications/", {
            "course": self.course.id, "motivation": "First try"
        }, format="json")
        self.assertEqual(r1.status_code, 201)
        r2 = self.client.post("/api/v1/applications/", {
            "course": self.course.id, "motivation": "Second try"
        }, format="json")
        self.assertEqual(r2.status_code, 201)  # returns existing
        self.assertEqual(Application.objects.count(), 1)

    def test_already_enrolled_cannot_apply(self):
        Enrollment.objects.create(student=self.student, course=self.course,
                                  status=Enrollment.Status.ACTIVE)
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/applications/", {
            "course": self.course.id, "motivation": "Trying to apply"
        }, format="json")
        self.assertEqual(r.status_code, 400)

    # --- listing ---
    def test_student_lists_own_applications(self):
        self._create_application()
        self.client.force_authenticate(self.student)
        r = self.client.get("/api/v1/applications/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_instructor_lists_applications_for_their_courses(self):
        self._create_application()
        self.client.force_authenticate(self.instr)
        r = self.client.get("/api/v1/applications/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_student_cannot_see_others_applications(self):
        other = User.objects.create_user(
            email="s2@vaceup.ng", password="x", full_name="Other",
            role=User.Role.STUDENT, is_active=True)
        self._create_application(student=other)
        self.client.force_authenticate(self.student)
        r = self.client.get("/api/v1/applications/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 0)

    # --- review ---
    def test_instructor_approves_application(self):
        app = self._create_application()
        self.client.force_authenticate(self.instr)
        r = self.client.post(f"/api/v1/applications/{app.id}/review/", {
            "action": "approve"
        }, format="json")
        self.assertEqual(r.status_code, 200)
        app.refresh_from_db()
        self.assertEqual(app.status, Application.Status.APPROVED)
        self.assertIsNotNone(app.reviewed_at)
        # Auto-enrollment created
        from apps.enrollment.models import Enrollment
        self.assertTrue(Enrollment.objects.filter(
            student=self.student, course=self.course).exists())

    def test_instructor_rejects_application_with_reason(self):
        app = self._create_application()
        self.client.force_authenticate(self.instr)
        r = self.client.post(f"/api/v1/applications/{app.id}/review/", {
            "action": "reject", "rejection_reason": "Prerequisites not met"
        }, format="json")
        self.assertEqual(r.status_code, 200)
        app.refresh_from_db()
        self.assertEqual(app.status, Application.Status.REJECTED)
        self.assertEqual(app.rejection_reason, "Prerequisites not met")

    def test_reject_requires_reason(self):
        app = self._create_application()
        self.client.force_authenticate(self.instr)
        r = self.client.post(f"/api/v1/applications/{app.id}/review/", {
            "action": "reject"
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_student_cannot_review(self):
        app = self._create_application()
        self.client.force_authenticate(self.student)
        r = self.client.post(f"/api/v1/applications/{app.id}/review/", {
            "action": "approve"
        }, format="json")
        self.assertEqual(r.status_code, 403)

    # --- withdraw ---
    def test_student_withdraws_own_application(self):
        app = self._create_application()
        self.client.force_authenticate(self.student)
        r = self.client.post(f"/api/v1/applications/{app.id}/withdraw/")
        self.assertEqual(r.status_code, 200)
        app.refresh_from_db()
        self.assertEqual(app.status, Application.Status.WITHDRAWN)

    def test_student_cannot_withdraw_others(self):
        other = User.objects.create_user(
            email="s2@vaceup.ng", password="x", full_name="Other",
            role=User.Role.STUDENT, is_active=True)
        app = self._create_application(student=other)
        self.client.force_authenticate(self.student)
        r = self.client.post(f"/api/v1/applications/{app.id}/withdraw/")
        self.assertEqual(r.status_code, 403)

    def test_cannot_withdraw_approved_application(self):
        app = self._create_application(status=Application.Status.APPROVED)
        self.client.force_authenticate(self.student)
        r = self.client.post(f"/api/v1/applications/{app.id}/withdraw/")
        self.assertEqual(r.status_code, 400)