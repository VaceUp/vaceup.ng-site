from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.adminpanel.models import AdminActionLog
from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.payments.models import Payment

User = get_user_model()
URL = "/api/v1/admin/dashboard/enrollments/grant/"


class EnrollmentGrantTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_superuser("admin@example.test", "test-password")
        self.tutor = User.objects.create_user("tutor@example.test", "test-password", role="instructor", is_active=True)
        self.student = User.objects.create_user("student@example.test", "test-password", role="student", is_active=True)
        category = Category.objects.create(name="Skills")
        self.course = Course.objects.create(title="Paid course", category=category, instructor=self.tutor, price=10000, is_published=True)
        self.data = {"student_id": self.student.pk, "course_id": self.course.pk,
                     "source": "legacy_paid_student", "reason": "Verified the previous cohort payment register.",
                     "payment_reference": "cohort-2025-record-14", "request_id": str(uuid4()), "confirmed": True}
        self.client.force_authenticate(self.admin)

    def test_grant_activates_access_without_payment_and_logs_reason(self):
        response = self.client.post(URL, self.data, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "active")
        self.assertFalse(Payment.objects.exists())
        log = AdminActionLog.objects.get(action_type="enrollment_grant")
        self.assertEqual(log.admin, self.admin)
        self.assertEqual(log.metadata["reason"], self.data["reason"])
        self.assertEqual(log.metadata["payment_reference"], self.data["payment_reference"])
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get("/api/v1/enrollments/").data["count"], 1)

    def test_retries_do_not_duplicate_enrollment_or_audit(self):
        first = self.client.post(URL, self.data, format="json")
        again = self.client.post(URL, self.data, format="json")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(first.data["id"], again.data["id"])
        self.assertEqual(Enrollment.objects.count(), 1)
        self.assertEqual(AdminActionLog.objects.filter(action_type="enrollment_grant").count(), 1)
        conflict = self.client.post(URL, {**self.data, "reason": "A different payment verification note."}, format="json")
        self.assertEqual(conflict.status_code, 409)

    def test_existing_completion_and_progress_are_preserved(self):
        existing = Enrollment.objects.create(student=self.student, course=self.course, status="completed", progress_percent=100)
        response = self.client.post(URL, self.data, format="json")
        self.assertEqual(response.status_code, 200)
        existing.refresh_from_db()
        self.assertEqual(existing.status, "completed")
        self.assertEqual(existing.progress_percent, 100)
        self.assertFalse(AdminActionLog.objects.filter(action_type="enrollment_grant").exists())

    def test_suspended_enrollment_is_not_reactivated_by_new_grant_or_retry(self):
        self.client.post(URL, self.data, format="json")
        Enrollment.objects.all().update(status="suspended")
        replay = self.client.post(URL, self.data, format="json")
        self.assertEqual(replay.data["status"], "suspended")
        fresh = self.client.post(URL, {**self.data, "request_id": str(uuid4())}, format="json")
        self.assertEqual(fresh.status_code, 409)
        self.assertEqual(Enrollment.objects.get().status, "suspended")

    def test_student_tutor_and_anonymous_cannot_grant(self):
        for user in (self.student, self.tutor, None):
            self.client.force_authenticate(user)
            self.assertIn(self.client.post(URL, self.data, format="json").status_code, (401, 403))
        self.assertFalse(Enrollment.objects.exists())

    def test_requires_confirmed_verification_and_active_student(self):
        for changes in ({"confirmed": False}, {"reason": ""}, {"source": "free"}, {"student_id": self.tutor.pk}):
            self.assertEqual(self.client.post(URL, {**self.data, **changes}, format="json").status_code, 400)
        self.student.is_active = False
        self.student.save(update_fields=["is_active"])
        self.assertEqual(self.client.post(URL, self.data, format="json").status_code, 400)
        self.assertFalse(Enrollment.objects.exists())

    def test_draft_course_cannot_be_granted(self):
        self.course.is_published = False
        self.course.save(update_fields=["is_published"])
        self.assertEqual(self.client.post(URL, self.data, format="json").status_code, 400)
        self.assertFalse(Enrollment.objects.exists())
