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
from django.conf import settings as django_settings
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


CERTIFICATE_STYLES = """
body { margin: 0; background: #ffffff; color: #101642;
       font-family: 'DejaVu Serif', Georgia, 'Times New Roman', serif; }
.certificate { position: relative; padding: 3mm; border: 1.4mm solid #00088A; }
.certificate-rule { position: relative; padding: 12mm 14mm; border: 0.4mm solid #FFC72C; text-align: center; }
.corner { position: absolute; width: 8mm; height: 8mm; }
.corner-tl { top: 2mm; left: 2mm; border-top: 0.6mm solid #008B8B; border-left: 0.6mm solid #008B8B; }
.corner-tr { top: 2mm; right: 2mm; border-top: 0.6mm solid #008B8B; border-right: 0.6mm solid #008B8B; }
.corner-bl { bottom: 2mm; left: 2mm; border-bottom: 0.6mm solid #008B8B; border-left: 0.6mm solid #008B8B; }
.corner-br { bottom: 2mm; right: 2mm; border-bottom: 0.6mm solid #008B8B; border-right: 0.6mm solid #008B8B; }
.cert-brand { font-family: 'DejaVu Sans', Helvetica, Arial, sans-serif; font-size: 15pt;
              font-weight: bold; letter-spacing: 0.32em; color: #00088A; }
.cert-kicker { margin-top: 1mm; font-family: 'DejaVu Sans', Helvetica, Arial, sans-serif;
               font-size: 7pt; letter-spacing: 0.28em; color: #007878; }
.cert-title { margin: 12mm 0 0; font-size: 26pt; font-weight: bold; color: #00088A; }
.cert-lead { margin-top: 8mm; font-size: 10pt; color: #4a5378; }
.cert-name { margin: 4mm auto 0; padding-bottom: 3mm; border-bottom: 0.4mm solid #FFC72C;
             width: 74%; font-size: 24pt; font-weight: bold; color: #0a1128; }
.cert-statement { margin-top: 7mm; font-size: 10pt; color: #4a5378; }
.cert-course { margin: 4mm auto 0; font-size: 15pt; font-weight: bold; color: #007878; }
.cert-detail { margin-top: 6mm; font-size: 9.5pt; line-height: 1.6; color: #101642; }
.cert-signatures { width: 100%; margin-top: 16mm; border-collapse: collapse; }
.cert-sign { width: 33%; padding: 0 4mm; vertical-align: bottom; text-align: center;
             font-family: 'DejaVu Sans', Helvetica, Arial, sans-serif; }
.cert-seal-cell { width: 34%; vertical-align: middle; text-align: center; }
.cert-sign-line { border-top: 0.3mm solid #a3a8f3; padding-top: 2mm; }
.cert-sign-name { font-size: 10pt; font-weight: bold; color: #00088A; }
.cert-sign-role { margin-top: 1mm; font-size: 7.5pt; letter-spacing: 0.12em;
                  text-transform: uppercase; color: #4a5378; }
.cert-seal { display: inline-block; width: 26mm; height: 26mm; border: 0.8mm solid #FFC72C;
             border-radius: 50%; text-align: center; }
.cert-seal-inner { margin: 1.6mm; height: 22.8mm; border: 0.3mm dashed #d4a025; border-radius: 50%; }
.cert-seal-text { padding-top: 7mm; font-family: 'DejaVu Sans', Helvetica, Arial, sans-serif;
                  font-size: 8pt; font-weight: bold; letter-spacing: 0.14em; color: #8a6508; }
.cert-footer { margin-top: 14mm; padding-top: 4mm; border-top: 0.3mm solid #d1d5f9;
               font-family: 'DejaVu Sans', Helvetica, Arial, sans-serif;
               font-size: 7.5pt; letter-spacing: 0.04em; color: #4a5378; }
.cert-code { color: #00088A; font-weight: bold; }
/* Selectors used by templates stored before the brand redesign, so an existing
   template renders in brand colours instead of losing all styling. */
.certificate-container { padding: 12mm 14mm; border: 0.4mm solid #FFC72C; text-align: center; color: #101642; }
.certificate-container .logo { margin-bottom: 4mm; }
.certificate-container .title { font-size: 22pt; font-weight: bold; color: #00088A; margin: 5mm 0; }
.certificate-container .subtitle { font-size: 12pt; color: #007878; margin: 3mm 0; }
.certificate-container .details { margin: 8mm 0; font-size: 10pt; }
.certificate-container .detail-row { margin: 2mm 0; }
.certificate-container .label { font-weight: bold; color: #00088A; }
.certificate-container .value { color: #101642; }
.certificate-container .verification { margin-top: 8mm; padding-top: 4mm; border-top: 0.3mm solid #d1d5f9; }
.certificate-container .verification-code { font-size: 9pt; color: #4a5378; }
"""

DEFAULT_CERTIFICATE_HTML = """
<div class="certificate">
  <div class="certificate-rule">
    <span class="corner corner-tl"></span><span class="corner corner-tr"></span>
    <span class="corner corner-bl"></span><span class="corner corner-br"></span>
    <p class="cert-brand">VACEUP</p>
    <p class="cert-kicker">DIGITAL ACADEMY</p>
    <h1 class="cert-title">Certificate of Completion</h1>
    <p class="cert-lead">This certifies that</p>
    <p class="cert-name">{{ student_name }}</p>
    <p class="cert-statement">has successfully completed the full programme</p>
    <p class="cert-course">{{ course_title }}</p>
    <p class="cert-detail">Issued on {{ issue_date }} by {{ institution_name }}.<br />
      Course completed on {{ completion_date }} and assessed by {{ instructor_name }}.</p>
    <table class="cert-signatures">
      <tr>
        <td class="cert-sign">
          <p class="cert-sign-name">{{ instructor_name }}</p>
          <div class="cert-sign-line"><p class="cert-sign-role">Course Instructor</p></div>
        </td>
        <td class="cert-seal-cell">
          <div class="cert-seal"><div class="cert-seal-inner"><p class="cert-seal-text">VACEUP</p></div></div>
        </td>
        <td class="cert-sign">
          <p class="cert-sign-name">{{ institution_name }}</p>
          <div class="cert-sign-line"><p class="cert-sign-role">Academy Director</p></div>
        </td>
      </tr>
    </table>
    <p class="cert-footer">
      Certificate {{ certificate_number }}<br />
      Verify this award at {{ verify_url }} using code
      <span class="cert-code">{{ verification_code }}</span>
    </p>
  </div>
</div>
"""


def certificate_context(certificate: "Certificate") -> dict:
    """The award facts every renderer (HTML, PDF) draws from."""
    verify_base = str(getattr(django_settings, "FRONTEND_BASE_URL", "") or "https://vaceup.ng")
    return {
        "student_name": certificate.student_name_at_issue,
        "course_title": certificate.course_title_at_issue,
        "completion_date": certificate.completion_date.strftime("%B %d, %Y"),
        "certificate_number": str(certificate.certificate_number),
        "verification_code": certificate.verification_code,
        "instructor_name": certificate.instructor_name_at_issue,
        "institution_name": certificate.institution_name_at_issue,
        "issue_date": certificate.issue_date.strftime("%B %d, %Y"),
        "verify_url": f"{verify_base.rstrip('/')}/verify/",
    }


def render_certificate_html(certificate: "Certificate") -> str:
    """Render the certificate HTML using the template."""
    template = certificate.template
    context = certificate_context(certificate)

    template_obj = Template(template.html_template)
    rendered_html = template_obj.render(Context(context))
    # The brand sheet comes first so a template's own CSS still wins on ties.
    page_rule = "@page { size: %s %s; margin: 8mm; }" % (template.page_size, template.orientation)
    full_html = (
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Certificate</title>"
        f"<style>{page_rule}{CERTIFICATE_STYLES}{template.css_styles or ''}</style>"
        f"</head><body>{rendered_html}</body></html>"
    )
    return full_html


def preview_certificate_html(*, template: CertificateTemplate, student, course) -> str:
    """Render the design for review. Nothing is saved and no award is issued."""
    sample = Certificate(
        student=student, course=course, template=template,
        certificate_number=uuid.uuid4(), verification_code="PREVIEW-SAMPLE",
        student_name_at_issue=student.full_name or student.email,
        course_title_at_issue=course.title,
        instructor_name_at_issue=course.instructor.full_name or course.instructor.email,
        institution_name_at_issue="VaceUp",
        completion_date=timezone.localdate(), issue_date=timezone.localdate(),
    )
    return render_certificate_html(sample)


def _embedded_resource_fetcher(url, *args, **kwargs):
    """Certificate rendering may read embedded data, never network or local files."""
    if not url.startswith("data:"):
        raise ValueError("Certificate assets must be embedded as data URLs.")
    from weasyprint import default_url_fetcher
    return default_url_fetcher(url, *args, **kwargs)


def generate_certificate_pdf(html: str, *, page_size="A4", orientation="portrait", context=None) -> bytes:
    """Generate PDF from HTML using WeasyPrint, or the drawn brand layout."""
    try:
        from weasyprint import HTML
        from weasyprint.text.fonts import FontConfiguration
        return HTML(string=html, url_fetcher=_embedded_resource_fetcher).write_pdf(
            font_config=FontConfiguration(),
        )
    except (ImportError, OSError):
        # Shared hosts may lack WeasyPrint's native font libraries.
        if context is not None:
            return generate_branded_pdf(context, page_size=page_size, orientation=orientation)
        return generate_pdf_fallback(html, page_size=page_size, orientation=orientation)


BRAND_NAVY = "#00088A"
BRAND_INK = "#0a1128"
BRAND_TEXT = "#101642"
BRAND_MUTED = "#4a5378"
BRAND_GOLD = "#FFC72C"
BRAND_GOLD_DEEP = "#8a6508"
BRAND_TEAL = "#007878"
BRAND_RULE = "#a3a8f3"


def _fit_size(text, font, size, max_width, minimum):
    from reportlab.pdfbase.pdfmetrics import stringWidth
    while size > minimum and stringWidth(text, font, size) > max_width:
        size -= 0.5
    return size


def _wrap(text, font, size, max_width, limit=2):
    from reportlab.pdfbase.pdfmetrics import stringWidth
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if not current or stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
            if len(lines) == limit:
                break
    if current and len(lines) < limit:
        lines.append(current)
    return lines


def generate_branded_pdf(context: dict, *, page_size="A4", orientation="portrait") -> bytes:
    """Draw the brand certificate with ReportLab, which needs no system fonts.

    This is the renderer TrueHost-style hosts actually use: WeasyPrint's Pango
    and Cairo libraries are usually unavailable there, so the award would
    otherwise degrade to a text dump.
    """
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4, landscape, letter
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.pdfgen import canvas as pdf_canvas

    base = letter if page_size == "Letter" else A4
    width, height = landscape(base) if orientation == "landscape" else base
    buffer = BytesIO()
    sheet = pdf_canvas.Canvas(buffer, pagesize=(width, height))
    center = width / 2

    def at(y, content, font, size, color, tracking=0, x=None, max_width=None):
        if max_width:
            size = _fit_size(content, font, size, max_width, size * 0.55)
        sheet.setFont(font, size)
        sheet.setFillColor(HexColor(color))
        if tracking:
            total = sum(stringWidth(ch, font, size) + tracking for ch in content) - tracking
            pen = (x if x is not None else center) - total / 2
            for ch in content:
                sheet.drawString(pen, y, ch)
                pen += stringWidth(ch, font, size) + tracking
        else:
            sheet.drawCentredString(x if x is not None else center, y, content)

    sheet.setLineJoin(0)
    sheet.setStrokeColor(HexColor(BRAND_NAVY)); sheet.setLineWidth(4)
    sheet.rect(14, 14, width - 28, height - 28)
    sheet.setStrokeColor(HexColor(BRAND_GOLD)); sheet.setLineWidth(1)
    sheet.rect(22, 22, width - 44, height - 44)
    sheet.setStrokeColor(HexColor(BRAND_TEAL)); sheet.setLineWidth(1.8)
    corner, arm = 29, 16
    for x, y, dx, dy in (
        (corner, height - corner, 1, -1), (width - corner, height - corner, -1, -1),
        (corner, corner, 1, 1), (width - corner, corner, -1, 1),
    ):
        sheet.line(x, y, x + dx * arm, y)
        sheet.line(x, y, x, y + dy * arm)

    usable = width - 130
    at(height - 74, "VACEUP", "Helvetica-Bold", 15, BRAND_NAVY, tracking=4.5)
    at(height - 90, "DIGITAL ACADEMY", "Helvetica", 6.5, BRAND_TEAL, tracking=2.6)
    at(height - 134, "Certificate of Completion", "Times-Bold", 26, BRAND_NAVY, max_width=usable)
    at(height - 158, "This certifies that", "Times-Italic", 10, BRAND_MUTED)

    name = str(context["student_name"])
    name_y = height - 196
    name_size = _fit_size(name, "Times-Bold", 24, usable * 0.78, 12)
    at(name_y, name, "Times-Bold", name_size, BRAND_INK)
    rule_half = max(stringWidth(name, "Times-Bold", name_size), 150) / 2 + 18
    sheet.setStrokeColor(HexColor(BRAND_GOLD)); sheet.setLineWidth(1.2)
    sheet.line(center - rule_half, name_y - 11, center + rule_half, name_y - 11)

    at(height - 224, "has successfully completed the full programme", "Times-Italic", 10, BRAND_MUTED)
    course_lines = _wrap(str(context["course_title"]), "Times-Bold", 15, usable, 2)
    for index, line in enumerate(course_lines):
        at(height - 252 - index * 19, line, "Times-Bold", 15, BRAND_TEAL, max_width=usable)
    detail_y = height - 252 - len(course_lines) * 19 - 12
    at(detail_y, f"Issued on {context['issue_date']} by {context['institution_name']}.",
       "Helvetica", 8.5, BRAND_TEXT)
    at(detail_y - 13, f"Course completed on {context['completion_date']} and assessed by "
       f"{context['instructor_name']}.", "Helvetica", 8.5, BRAND_TEXT)

    left, right = width * 0.27, width * 0.73
    sign_y = max(118.0, detail_y - 0.22 * height)
    for x, name_text, role in (
        (left, str(context["instructor_name"]), "COURSE INSTRUCTOR"),
        (right, str(context["institution_name"]), "ACADEMY DIRECTOR"),
    ):
        at(sign_y, name_text, "Helvetica-Bold", 10, BRAND_NAVY, x=x, max_width=width * 0.24)
        sheet.setStrokeColor(HexColor(BRAND_RULE)); sheet.setLineWidth(0.8)
        sheet.line(x - 76, sign_y - 11, x + 76, sign_y - 11)
        at(sign_y - 24, role, "Helvetica", 6.5, BRAND_MUTED, x=x, tracking=1.6)

    sheet.setStrokeColor(HexColor(BRAND_GOLD)); sheet.setLineWidth(2.4)
    sheet.circle(center, sign_y - 6, 27, stroke=1, fill=0)
    sheet.setLineWidth(0.7); sheet.setDash(2, 2)
    sheet.setStrokeColor(HexColor("#d4a025"))
    sheet.circle(center, sign_y - 6, 21, stroke=1, fill=0)
    sheet.setDash()
    at(sign_y - 9, "VACEUP", "Helvetica-Bold", 7, BRAND_GOLD_DEEP, tracking=1.2)

    at(66, f"Certificate {context['certificate_number']}", "Helvetica", 7, BRAND_MUTED)
    at(54, f"Verify this award at {context['verify_url']} using code "
       f"{context['verification_code']}", "Helvetica", 7, BRAND_MUTED,
       max_width=width - 90)

    sheet.showPage()
    sheet.save()
    return buffer.getvalue()


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
                    context=certificate_context(certificate),
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
