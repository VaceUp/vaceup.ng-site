"""Certificate services: generation, PDF rendering, verification."""
from __future__ import annotations

import base64
import hashlib
import os
import uuid
from decimal import Decimal
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.template import Template, Context
from django.utils import timezone

from apps.certificates.models import Certificate, CertificateTemplate, CertificateVerificationLog
from apps.core.exceptions import DomainError
from apps.enrollment.models import Enrollment


def generate_verification_code() -> str:
    """Generate a short verification code for public certificate lookup."""
    # Use first 8 chars of UUID4 + timestamp hash
    raw = f"{uuid.uuid4().hex}{timezone.now().timestamp()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12].upper()


def get_template_for_course(course) -> CertificateTemplate:
    """Get the appropriate template for a course."""
    # Try course-specific default template first
    template = CertificateTemplate.objects.filter(
        course__in=[course, None],
        is_default=True,
        is_active=True,
    ).order_by("-course").first()

    if not template:
        # Fallback to any active template
        template = CertificateTemplate.objects.filter(is_active=True).first()

    if not template:
        raise DomainError("No active certificate template available.", code="no_template")

    return template


def generate_verification_code_short() -> str:
    """Generate a shorter verification code (8 chars)."""
    import random
    import string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


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
        "certificate": certificate,
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


def generate_certificate_pdf(html: str) -> bytes:
    """Generate PDF from HTML using WeasyPrint."""
    try:
        from weasyprint import HTML, CSS
        from weasyprint.text.fonts import FontConfiguration

        font_config = FontConfiguration()
        html_doc = HTML(string=html)
        pdf_bytes = html_doc.write_pdf(font_config=font_config)
        return pdf_bytes
    except ImportError:
        # Fallback to reportlab if WeasyPrint not available
        return generate_pdf_fallback(html)


def generate_pdf_fallback(html: str) -> bytes:
    """Fallback PDF generation using reportlab."""
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.units import inch

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    # Simple fallback - just extract text from HTML
    import re
    text = re.sub('<[^<]+?>', '', html)
    for line in text.split('\n'):
        if line.strip():
            story.append(Paragraph(line.strip(), styles['Normal']))
            story.append(Spacer(1, 12))

    doc.build(story)
    return buffer.getvalue()


def issue_certificate(*, enrollment: Enrollment) -> "Certificate":
    """Issue a certificate for a completed enrollment."""
    from apps.certificates.models import Certificate

    if enrollment.status != Enrollment.Status.COMPLETED:
        raise DomainError("Enrollment must be completed to issue certificate.", code="not_completed")

    # Check if certificate already exists
    existing = Certificate.objects.filter(enrollment=enrollment).first()
    if existing:
        return existing

    course = enrollment.course
    student = enrollment.student

    # Get template
    template = get_template_for_course(course)

    # Create certificate
    certificate = Certificate.objects.create(
        student=student,
        course=course,
        enrollment=enrollment,
        template=template,
        status=Certificate.Status.PENDING,
        verification_code=generate_verification_code()[:12],
        student_name_at_issue=student.full_name or student.email,
        course_title_at_issue=course.title,
        instructor_name_at_issue=course.instructor.full_name if course.instructor else "VaceUp Instructor",
        institution_name_at_issue="VaceUp",
        completion_date=enrollment.completed_at.date() if enrollment.completed_at else timezone.now().date(),
        issue_date=timezone.now().date(),
    )

    # Render HTML and generate PDF
    html = render_certificate_html(certificate)
    pdf_bytes = generate_certificate_pdf(html)

    # Save PDF
    pdf_filename = f"certificate_{certificate.certificate_number}.pdf"
    certificate.pdf_file.save(pdf_filename, ContentFile(pdf_bytes), save=False)
    certificate.pdf_generated_at = timezone.now()
    certificate.status = Certificate.Status.ISSUED
    certificate.save()

    return certificate


def verify_certificate(verification_code: str, request=None) -> dict:
    """
    Verify a certificate by its verification code.
    Returns dict with verification result and certificate details if valid.
    """
    from apps.certificates.models import Certificate

    try:
        certificate = Certificate.objects.select_related(
            "student", "course", "template"
        ).get(verification_code=verification_code)
    except Certificate.DoesNotExist:
        return {
            "valid": False,
            "error": "Certificate not found.",
            "code": "not_found",
        }

    # Log verification attempt
    if request:
        CertificateVerificationLog.objects.create(
            certificate=certificate,
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            verified=True,
            referrer=request.META.get("HTTP_REFERER", ""),
        )
    else:
        CertificateVerificationLog.objects.create(
            certificate=certificate,
            verified=True,
        )

    if certificate.status != Certificate.Status.ISSUED:
        return {
            "valid": False,
            "error": f"Certificate is {certificate.status}.",
            "code": "invalid_status",
            "certificate": certificate_data(certificate),
        }

    if certificate.expires_at and certificate.expires_at < timezone.now():
        return {
            "valid": False,
            "error": "Certificate has expired.",
            "code": "expired",
            "certificate": certificate_data(certificate),
        }

    return {
        "valid": True,
        "certificate": certificate_data(certificate),
    }


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
        "pdf_url": certificate.pdf_file.url if certificate.pdf_file else None,
    }


def get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def auto_issue_on_completion(enrollment: "Enrollment"):
    """Auto-issue certificate when enrollment completes (signal handler)."""
    try:
        if enrollment.status == Enrollment.Status.COMPLETED:
            issue_certificate(enrollment=enrollment)
    except Exception as e:
        # Log error but don't block enrollment completion
        import logging
        logging.getLogger(__name__).error(f"Certificate issuance failed: {e}")