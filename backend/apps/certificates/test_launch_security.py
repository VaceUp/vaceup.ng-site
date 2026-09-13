from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.storage import InMemoryStorage
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.certificates.models import Certificate, CertificateTemplate
from apps.certificates.services import issue_certificate, render_certificate_html
from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment

User = get_user_model()


class CertificateLaunchTests(APITestCase):
    def setUp(self):
        self.tutor = User.objects.create_user(email="t@example.org", password="x", full_name="Tutor", role="instructor", is_active=True)
        self.other = User.objects.create_user(email="o@example.org", password="x", full_name="Other", role="instructor", is_active=True)
        self.student = User.objects.create_user(email="s@example.org", password="x", full_name="Learner", role="student", is_active=True)
        category = Category.objects.create(name="Skills")
        self.course = Course.objects.create(title="Course", category=category, instructor=self.tutor, is_published=True)
        self.other_course = Course.objects.create(title="Other", category=category, instructor=self.other)
        self.template = CertificateTemplate.objects.create(name="Global", is_default=True, html_template="{{ student_name }}: {{ course_title }}")
        self.enrollment = Enrollment.objects.create(student=self.student, course=self.course, status="completed", completed_at=timezone.now())
        field = Certificate._meta.get_field("pdf_file")
        self.storage_patch = patch.object(field, "storage", InMemoryStorage())
        self.storage_patch.start()
        self.addCleanup(self.storage_patch.stop)

    def issue(self):
        with patch("apps.certificates.services.generate_certificate_pdf", return_value=b"%PDF-1.7\ntest"):
            return issue_certificate(enrollment=self.enrollment)

    def test_issue_is_idempotent_and_public_verify_works(self):
        first = self.issue()
        second = self.issue()
        self.assertEqual(first.pk, second.pk)
        response = self.client.get(f"/api/v1/verify/{first.verification_code}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["certificate"]["student_name"], "Learner")

    def test_revoked_certificate_cannot_be_downloaded(self):
        certificate = self.issue()
        self.client.force_authenticate(self.tutor)
        self.assertEqual(self.client.post(f"/api/v1/certificates/{certificate.certificate_number}/revoke/", {"reason": "Correcting award"}).status_code, 200)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(f"/api/v1/certificates/{certificate.certificate_number}/pdf/").status_code, 404)
        self.assertFalse(self.client.get(f"/api/v1/verify/{certificate.verification_code}/").data["valid"])

    def test_expiry_and_invalid_code_are_not_valid(self):
        certificate = self.issue()
        certificate.expires_at = timezone.now() - timedelta(seconds=1)
        certificate.save()
        self.assertFalse(self.client.get(f"/api/v1/verify/{certificate.verification_code}/").data["valid"])
        self.assertFalse(self.client.get("/api/v1/verify/NOTFOUND/").data["valid"])

    def test_instructor_cannot_edit_global_or_other_course_template(self):
        foreign = CertificateTemplate.objects.create(name="Foreign", course=self.other_course, html_template="Certificate")
        self.client.force_authenticate(self.tutor)
        for template in [self.template, foreign]:
            self.assertEqual(self.client.patch(f"/api/v1/certificates/templates/{template.pk}/", {"name": "Changed"}, format="json").status_code, 404)
        response = self.client.post("/api/v1/certificates/templates/", {"name": "Forbidden global", "html_template": "Certificate"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_course_template_cannot_be_reassigned_outside_owner(self):
        template = CertificateTemplate.objects.create(name="Own", course=self.course, html_template="Certificate")
        self.client.force_authenticate(self.tutor)
        response = self.client.patch(f"/api/v1/certificates/templates/{template.pk}/", {"course": self.other_course.pk}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_template_context_does_not_expose_account_objects(self):
        certificate = self.issue()
        certificate.template.html_template = "{{ certificate.student.password }} {{ student_name }}"
        html = render_certificate_html(certificate)
        self.assertNotIn(self.student.password, html)
        self.assertIn("Learner", html)

    def test_html_endpoint_redirects_to_branded_frontend(self):
        response = self.client.get("/api/v1/verify/ABC123/page/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/verify?code=ABC123", response["Location"])

    def test_admin_issue_cannot_force_completion_or_hide_pdf_failure(self):
        admin = User.objects.create_user(email="admin@example.org", password="x", full_name="Admin", role="admin", is_active=True)
        self.client.force_authenticate(admin)
        self.enrollment.status = "active"
        self.enrollment.completed_at = None
        self.enrollment.save()
        data = {"student_id": self.student.pk, "course_id": self.course.pk}
        response = self.client.post("/api/v1/admin/dashboard/certificates/issue/", data, format="json")
        self.assertEqual(response.status_code, 400)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.status, "active")
        self.assertFalse(Certificate.objects.exists())
        self.enrollment.status = "completed"
        self.enrollment.completed_at = timezone.now()
        self.enrollment.save()
        with patch("apps.certificates.services.generate_certificate_pdf", side_effect=RuntimeError("renderer down")):
            response = self.client.post("/api/v1/admin/dashboard/certificates/issue/", data, format="json")
        self.assertEqual(response.status_code, 503, response.data)
        self.assertFalse(Certificate.objects.exists())
