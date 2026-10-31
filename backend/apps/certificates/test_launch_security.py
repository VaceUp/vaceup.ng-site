from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.storage import InMemoryStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image, ImageDraw
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
        # Migration 0003 already seeds the academy-wide default; reuse it so this
        # suite exercises the design real deployments render.
        self.template = CertificateTemplate.objects.filter(course__isnull=True, is_default=True).order_by("pk").first()
        if self.template is None:
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

    def test_admin_previews_the_shipped_design_without_issuing(self):
        admin = User.objects.create_user(email="preview@example.org", password="x", full_name="Previewer", role="admin", is_active=True)
        self.client.force_authenticate(admin)
        response = self.client.get(
            f"/api/v1/certificates/templates/preview/?course={self.course.pk}&student={self.student.pk}"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("Learner", response.data["html"])
        self.assertIn("Certificate of Completion", response.data["html"])
        self.assertNotIn(self.student.email, response.data["html"])
        self.assertEqual(Certificate.objects.count(), 0)

    def test_preview_rejects_incomplete_or_foreign_requests(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(
            self.client.get(f"/api/v1/certificates/templates/preview/?course={self.course.pk}").status_code, 403
        )
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.get(
                f"/api/v1/certificates/templates/preview/?course={self.course.pk}&student={self.student.pk}"
            ).status_code, 403
        )

    def test_renderer_without_weasyprint_still_draws_the_brand_certificate(self):
        """Shared hosts lack WeasyPrint; the drawn layout must still be a real PDF."""
        from apps.certificates.services import (
            certificate_context, generate_certificate_pdf, render_certificate_html,
        )
        certificate = self.issue()
        html = render_certificate_html(certificate)
        pdf = generate_certificate_pdf(
            html, page_size="A4", orientation="landscape",
            context=certificate_context(certificate),
        )
        self.assertTrue(pdf.startswith(b"%PDF-"))
        self.assertGreater(len(pdf), 1500)

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

    def test_admin_sets_management_signature_and_award_uses_it(self):
        buffer = BytesIO()
        image = Image.new("RGB", (360, 120), "white")
        draw = ImageDraw.Draw(image)
        draw.line((20, 80, 340, 40), fill="black", width=6)
        image.save(buffer, format="PNG")
        upload = SimpleUploadedFile("management.png", buffer.getvalue(), content_type="image/png")
        admin = User.objects.create_user(email="signatory@example.org", password="x", full_name="Signatory", role="admin", is_active=True)
        self.client.force_authenticate(admin)
        response = self.client.post(
            "/api/v1/certificates/signature/management/",
            {"signature": upload, "name": "Dr Ada Obi", "title": "Academy Director"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["signature"].startswith("data:image/png;base64,"))
        self.assertEqual(response.data["name"], "Dr Ada Obi")

        certificate = self.issue()
        html = render_certificate_html(certificate)
        self.assertIn("data:image/png;base64,", html)
        self.assertIn("Dr Ada Obi", html)

        removed = self.client.delete("/api/v1/certificates/signature/management/")
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(removed.data["signature"], "")

    def test_tutor_sets_signature_and_admin_selects_the_signer(self):
        buffer = BytesIO()
        Image.new("RGBA", (320, 100), (0, 0, 0, 0)).save(buffer, format="PNG")
        upload = SimpleUploadedFile("tutor.png", buffer.getvalue(), content_type="image/png")
        self.client.force_authenticate(self.other)
        response = self.client.post(
            "/api/v1/certificates/signature/", {"signature": upload}, format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["signature"].startswith("data:image/png;base64,"))

        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get("/api/v1/certificates/signature/").status_code, 403)

        admin = User.objects.create_user(email="issuer@example.org", password="x", full_name="Issuer", role="admin", is_active=True)
        self.client.force_authenticate(admin)
        with patch("apps.certificates.services.generate_certificate_pdf", return_value=b"%PDF-1.7\ntest"):
            response = self.client.post(
                "/api/v1/admin/dashboard/certificates/issue/",
                {"student_id": self.student.pk, "course_id": self.course.pk, "tutor_id": self.other.pk},
                format="json",
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["tutor_name"], "Other")
        certificate = Certificate.objects.get(certificate_number=response.data["certificate_number"])
        self.assertEqual(certificate.tutor, self.other)
        self.assertIn("data:image/png;base64,", render_certificate_html(certificate))

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
