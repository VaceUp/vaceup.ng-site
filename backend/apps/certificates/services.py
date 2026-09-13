"""Certificate services: generation, PDF rendering, verification."""
from __future__ import annotations

import hashlib
import logging
import uuid
from html import escape
from html.parser import HTMLParser
from ipaddress import ip_address
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.template import Template, Context
from django.urls import reverse
from django.utils import timezone

from apps.certificates.exceptions import CertificateConflict, CertificateNotFound, CertificateUnavailable
from apps.certificates.models import Certificate, CertificateTemplate, CertificateVerificationLog
from apps.core.exceptions import DomainError
from apps.courses.models import Course
from apps.enrollment.models import Enrollment

logger = logging.getLogger(__name__)


def generate_verification_code() -> str:
    """Generate a short verification code for public certificate lookup."""
    # Use first 8 chars of UUID4 + timestamp hash
    raw = f"{uuid.uuid4().hex}{timezone.now().timestamp()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12].upper()


def get_template_for_course(course) -> CertificateTemplate:
    """Prefer a course default, then a global default, then scoped fallbacks."""
    active = CertificateTemplate.objects.filter(is_active=True)
    for scope in (
        {"course": course, "is_default": True},
        {"course__isnull": True, "is_default": True},
        {"course": course},
        {"course__isnull": True},
    ):
        template = active.filter(**scope).order_by("pk").first()
        if template:
            return template
    raise CertificateUnavailable(
        "No active certificate template applies to this course. Activate a template "
        "for this course or a global template, then retry.", code="no_template",
    )


def enrollment_for_issuance(*, student_id: int, course_id: int) -> Enrollment:
    user_model = get_user_model()
    student = user_model.objects.filter(pk=student_id).first()
    if student is None:
        raise CertificateNotFound("Student not found. Select an existing student.", code="student_not_found")
    if not student.is_student:
        raise DomainError("Select a student account to issue a certificate.", code="not_student")
    if not Course.objects.filter(pk=course_id).exists():
        raise CertificateNotFound("Course not found. Select an existing course.", code="course_not_found")
    enrollment = Enrollment.objects.filter(student_id=student_id, course_id=course_id).first()
    if enrollment is None:
        raise DomainError(
            "That student is not enrolled in this course. Select their enrolled course.",
            code="not_enrolled",
        )
    return enrollment


def render_certificate_html(certificate: "Certificate") -> str:
    """Render the certificate HTML using the template."""
    template = certificate.template

    # Prepare context for template rendering
    context = {
        "student_name": certificate.student_name_at_issue,
        "course_title": certificate.course_title_at_issue,
        "completion_date": certificate.completion_date.strftime("%B %d, %Y"),
        "certificate_number": str(certificate.certificate_number),
        "verification_code": certificate.verification_code,
        "instructor_name": certificate.instructor_name_at_issue,
        "institution_name": certificate.institution_name_at_issue,
        "issue_date": certificate.issue_date.strftime("%B %d, %Y"),
    }

    template_obj = Template(template.html_template)
    rendered_html = template_obj.render(Context(context))

    # Wrap with CSS
    css = template.css_styles or ""
    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @page {{
                size: {template.page_size} {template.orientation};
                margin: 2cm;
            }}
            {css}
            body {{
                font-family: 'Georgia', serif;
                margin: 0;
                padding: 40px;
            }}
            .certificate-container {{
                border: 3px solid #2c3e50;
                border-radius: 10px;
                padding: 40px;
                text-align: center;
                max-width: 800px;
                margin: 0 auto;
            }}
            .logo {{ margin-bottom: 20px; }}
            .title {{ font-size: 36px; color: #2c3e50; margin: 20px 0; }}
            .subtitle {{ font-size: 18px; color: #34495e; margin: 10px 0; }}
            .details {{ margin: 30px 0; font-size: 16px; }}
            .detail-row {{ margin: 10px 0; }}
            .label {{ font-weight: bold; color: #2c3e50; }}
            .value {{ color: #34495e; }}
            .verification {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #bdc3c7; }}
            .verification-code {{ font-family: monospace; font-size: 14px; color: #7f8c8d; }}
        </style>
    </head>
    <body>
        {rendered_html}
    </body>
    </html>
    """
    return full_html


def _embedded_resource_fetcher(url, *args, **kwargs):
    """Certificate rendering may read embedded data, never network or local files."""
    if not url.startswith("data:"):
        raise ValueError("Certificate assets must be embedded as data URLs.")
    from weasyprint import default_url_fetcher
    return default_url_fetcher(url, *args, **kwargs)


def generate_certificate_pdf(html: str, *, page_size="A4", orientation="portrait") -> bytes:
    """Generate PDF from HTML using WeasyPrint."""
    try:
        from weasyprint import HTML
        from weasyprint.text.fonts import FontConfiguration
        return HTML(string=html, url_fetcher=_embedded_resource_fetcher).write_pdf(
            font_config=FontConfiguration(),
        )
    except (ImportError, OSError):
        # Shared hosts may lack WeasyPrint's native font libraries.
        return generate_pdf_fallback(html, page_size=page_size, orientation=orientation)


class _CertificateText(HTMLParser):
    """Extract visible text without accidentally printing CSS or executing markup."""

    blocks = {"p", "div", "br", "h1", "h2", "h3", "li", "tr", "section"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"head", "script", "style"}:
            self.hidden += 1
        if not self.hidden and tag in self.blocks:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"head", "script", "style"}:
            self.hidden = max(0, self.hidden - 1)
        if not self.hidden and tag in self.blocks:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def generate_pdf_fallback(html: str, *, page_size="A4", orientation="portrait") -> bytes:
    """Readable text-only PDF when WeasyPrint and its native libraries are absent."""
    from reportlab.lib.pagesizes import A4, letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    buffer = BytesIO()
    size = letter if page_size == "Letter" else A4
    if orientation == "landscape":
        size = landscape(size)
    doc = SimpleDocTemplate(buffer, pagesize=size)
    styles = getSampleStyleSheet()
    story = []

    parser = _CertificateText()
    parser.feed(html)
    for line in "".join(parser.parts).splitlines():
        if line.strip():
            story.append(Paragraph(escape(line.strip()), styles['Normal']))
            story.append(Spacer(1, 12))
    if not story:
        raise ValueError("Certificate template contains no visible text.")
    doc.build(story)
    return buffer.getvalue()


def issue_certificate(*, enrollment: Enrollment) -> "Certificate":
    """Serialize issuance and retries; success requires a persisted PDF.

    An enrollment lock serializes requests before a certificate exists. A
    certificate lock also serializes retries with revocation. PDF/storage
    failures roll back new rows; existing pending rows retain their identity.
    """
    saved_file = None
    try:
        with transaction.atomic():
            enrollment = Enrollment.objects.select_for_update().get(pk=enrollment.pk)
            certificate = Certificate.objects.select_for_update().filter(enrollment=enrollment).first()
            if certificate:
                if certificate.status == Certificate.Status.REVOKED or certificate.revoked_at:
                    raise CertificateConflict(
                        "This certificate was revoked and cannot be reissued. Review its revocation record.",
                        code="certificate_revoked",
                    )
                if is_expired(certificate):
                    raise CertificateConflict(
                        "This certificate has expired and cannot be reissued through this action.",
                        code="certificate_expired",
                    )
                if certificate.status == Certificate.Status.ISSUED and certificate.pdf_file:
                    return certificate

            if enrollment.status != Enrollment.Status.COMPLETED:
                raise DomainError(
                    "Enrollment is not completed. The student must finish the course requirements "
                    "before a certificate can be issued.", code="not_completed",
                )
            if enrollment.completed_at is None:
                raise DomainError(
                    "The completed enrollment has no completion date. Correct its completion record, then retry.",
                    code="completion_date_missing",
                )
            if not enrollment.student.is_student:
                raise DomainError("Certificates can only be issued to student accounts.", code="not_student")

            if certificate is None:
                student = enrollment.student
                course = enrollment.course
                certificate = Certificate.objects.create(
                    student=student, course=course, enrollment=enrollment,
                    template=get_template_for_course(course),
                    verification_code=generate_verification_code(),
                    student_name_at_issue=student.full_name or student.email,
                    course_title_at_issue=course.title,
                    instructor_name_at_issue=course.instructor.full_name or course.instructor.email,
                    institution_name_at_issue="VaceUp",
                    completion_date=enrollment.completed_at.date(),
                    issue_date=timezone.now().date(),
                )
            try:
                html = render_certificate_html(certificate)
            except Exception as exc:
                logger.exception("Certificate template rendering failed")
                raise CertificateUnavailable(
                    "The certificate template could not be rendered. Correct its Django template syntax, then retry.",
                    code="template_invalid",
                ) from exc
            try:
                pdf_bytes = generate_certificate_pdf(
                    html, page_size=certificate.template.page_size,
                    orientation=certificate.template.orientation,
                )
                if not isinstance(pdf_bytes, bytes) or not pdf_bytes.startswith(b"%PDF-"):
                    raise ValueError("Renderer did not produce a PDF.")
            except Exception as exc:
                logger.exception("Certificate PDF generation failed")
                raise CertificateUnavailable(
                    "The certificate PDF could not be generated. Ask the server administrator to check "
                    "ReportLab (or WeasyPrint and its font libraries) and the template, then retry.",
                    code="pdf_failed",
                ) from exc

            validate_pdf_storage(certificate.pdf_file.storage)
            try:
                certificate.pdf_file.save(
                    f"certificate_{certificate.certificate_number}.pdf", ContentFile(pdf_bytes), save=False,
                )
                saved_file = (certificate.pdf_file.storage, certificate.pdf_file.name)
            except Exception as exc:
                logger.exception("Certificate PDF storage failed")
                raise CertificateUnavailable(
                    "The certificate PDF could not be stored. Ask the server administrator to check "
                    "the private media bucket, credentials and write permissions, then retry.",
                    code="storage_failed",
                ) from exc
            certificate.pdf_generated_at = timezone.now()
            certificate.status = Certificate.Status.ISSUED
            certificate.save(update_fields=["pdf_file", "pdf_generated_at", "status", "updated_at"])
        return certificate
    except Exception:
        if saved_file:
            storage, name = saved_file
            try:
                storage.delete(name)
            except Exception:
                logger.exception("Could not clean up uncommitted certificate PDF %s", name)
        raise


def validate_pdf_storage(storage):
    from storages.backends.s3 import S3Storage
    if isinstance(storage, S3Storage) and not (
        storage.bucket_name and storage.access_key and storage.secret_key
    ):
        raise CertificateUnavailable(
            "Private certificate storage is not configured. Set AWS_STORAGE_BUCKET_NAME, "
            "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (and AWS_S3_ENDPOINT_URL for R2), then retry.",
            code="storage_not_configured",
        )


def is_expired(certificate):
    return certificate.status == Certificate.Status.EXPIRED or bool(
        certificate.expires_at and certificate.expires_at <= timezone.now()
    )


def certificate_pdf_url(certificate, request=None):
    """Use the authorized streaming endpoint without consulting remote storage."""
    if certificate.status != Certificate.Status.ISSUED or certificate.revoked_at or is_expired(certificate) or not certificate.pdf_file:
        return None
    url = reverse("certificate-download-pdf", kwargs={"certificate_number": certificate.certificate_number})
    return request.build_absolute_uri(url) if request else url


@transaction.atomic
def revoke_certificate(*, certificate, user, reason=""):
    certificate = Certificate.objects.select_for_update().get(pk=certificate.pk)
    if certificate.status == Certificate.Status.REVOKED:
        return certificate
    if certificate.status != Certificate.Status.ISSUED:
        raise CertificateConflict("Only an issued certificate can be revoked.", code="invalid_status")
    certificate.status = Certificate.Status.REVOKED
    certificate.revoked_at = timezone.now()
    certificate.revoked_by = user
    certificate.revocation_reason = reason
    certificate.save(update_fields=["status", "revoked_at", "revoked_by", "revocation_reason", "updated_at"])
    return certificate


def verify_certificate(verification_code: str, request=None) -> dict:
    """
    Verify a certificate by its verification code.
    Returns dict with verification result and certificate details if valid.
    """
    code = str(verification_code).strip()
    lookup = Q(verification_code=code.upper())
    try:
        lookup |= Q(certificate_number=uuid.UUID(code))
    except (ValueError, AttributeError):
        pass
    try:
        certificate = Certificate.objects.get(lookup)
    except Certificate.DoesNotExist:
        return {
            "valid": False,
            "error": "Certificate not found.",
            "code": "not_found",
        }

    data = certificate_data(certificate)
    if certificate.status != Certificate.Status.ISSUED or certificate.revoked_at:
        result = {
            "valid": False,
            "error": f"Certificate is {certificate.status}.",
            "code": "invalid_status",
            "certificate": data,
        }

    elif is_expired(certificate):
        result = {
            "valid": False,
            "error": "Certificate has expired.",
            "code": "expired",
            "certificate": data,
        }

    else:
        # Retain the nested API shape and the flat fields consumed by /verify.
        result = {"valid": True, "certificate": data, **data, "issued_at": data["issue_date"]}
    client_ip = get_client_ip(request) if request is not None else None
    if client_ip:
        CertificateVerificationLog.objects.create(
            certificate=certificate, ip_address=client_ip,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:2000],
            verified=result["valid"], referrer=request.META.get("HTTP_REFERER", "")[:500],
        )
    return result


def certificate_data(certificate: "Certificate") -> dict:
    """Serialize certificate data for verification response."""
    return {
        "certificate_number": str(certificate.certificate_number),
        "verification_code": certificate.verification_code,
        "student_name": certificate.student_name_at_issue,
        "course_title": certificate.course_title_at_issue,
        "instructor_name": certificate.instructor_name_at_issue,
        "institution_name": certificate.institution_name_at_issue,
        "completion_date": certificate.completion_date.isoformat(),
        "issue_date": certificate.issue_date.isoformat(),
        "expires_at": certificate.expires_at.isoformat() if certificate.expires_at else None,
        "status": certificate.status,
        "pdf_url": certificate_pdf_url(certificate),
    }


def get_client_ip(request):
    # Forwarded headers are user-controlled unless a trusted proxy strips them.
    try:
        return str(ip_address(request.META.get("REMOTE_ADDR", "")))
    except ValueError:
        return None


def auto_issue_on_completion(enrollment: "Enrollment"):
    """Auto-issue certificate when enrollment completes (signal handler)."""
    try:
        if enrollment.status == Enrollment.Status.COMPLETED:
            issue_certificate(enrollment=enrollment)
    except Exception:
        # Do not roll back legitimate course completion if PDF/storage is down.
        logger.exception("Automatic certificate issuance failed for enrollment %s", enrollment.pk)
