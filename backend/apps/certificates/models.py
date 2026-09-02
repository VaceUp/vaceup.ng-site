"""Certificates for course completion with PDF generation and public verification."""
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.courses.models import Course
from apps.enrollment.models import Enrollment


class CertificateTemplate(TimeStampedModel):
    """Template for certificate PDF generation."""

    name = models.CharField(max_length=200, unique=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="certificate_templates",
        null=True,
        blank=True,
        help_text="Null = global template for all courses without specific template",
    )
    # HTML template with placeholders: {{student_name}}, {{course_title}}, {{completion_date}},
    # {{certificate_number}}, {{instructor_name}}, {{institution_name}}, {{issue_date}}
    html_template = models.TextField(
        help_text="HTML template with Jinja2 placeholders"
    )
    # CSS for styling
    css_styles = models.TextField(blank=True, default="")
    # Page size: A4, Letter
    page_size = models.CharField(
        max_length=10,
        choices=[("A4", "A4"), ("Letter", "Letter")],
        default="A4",
    )
    # Orientation
    orientation = models.CharField(
        max_length=10,
        choices=[("portrait", "Portrait"), ("landscape", "Landscape")],
        default="portrait",
    )
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ("-is_default", "name")
        constraints = [
            models.UniqueConstraint(
                fields=["course", "is_default"],
                condition=models.Q(is_default=True),
                name="unique_default_template_per_course",
            )
        ]

    def __str__(self):
        return f"{self.name} ({'Global' if not self.course else self.course.title})"


class Certificate(TimeStampedModel):
    """Issued certificate for course completion."""

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        ISSUED = "issued", _("Issued")
        REVOKED = "revoked", _("Revoked")
        EXPIRED = "expired", _("Expired")

    # Unique certificate number for public verification
    certificate_number = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        db_index=True,
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="certificates",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="issued_certificates",
    )
    enrollment = models.OneToOneField(
        "enrollment.Enrollment",
        on_delete=models.CASCADE,
        related_name="certificate",
    )

    template = models.ForeignKey(
        CertificateTemplate,
        on_delete=models.PROTECT,
        related_name="issued_certificates",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    # PDF file (stored in private S3)
    pdf_file = models.FileField(
        upload_to="certificates/",
        null=True,
        blank=True,
    )
    pdf_generated_at = models.DateTimeField(null=True, blank=True)

    # Verification
    verification_code = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        db_index=True,
    )

    # Metadata snapshot at issuance
    student_name_at_issue = models.CharField(max_length=200)
    course_title_at_issue = models.CharField(max_length=200)
    instructor_name_at_issue = models.CharField(max_length=200)
    institution_name_at_issue = models.CharField(max_length=200, default="VaceUp")
    completion_date = models.DateField()
    issue_date = models.DateField(default=timezone.now)

    # Revocation
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revoked_certificates",
    )
    revocation_reason = models.TextField(blank=True)

    # Expiry
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["student", "course"]),
            models.Index(fields=["certificate_number"]),
            models.Index(fields=["verification_code"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "course"],
                name="unique_certificate_per_student_course",
            )
        ]

    def __str__(self):
        return f"Certificate {self.certificate_number} - {self.student} - {self.course}"


class CertificateVerificationLog(TimeStampedModel):
    """Log of public certificate verification attempts."""

    certificate = models.ForeignKey(
        Certificate,
        on_delete=models.CASCADE,
        related_name="verification_logs",
    )
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    verified = models.BooleanField(default=False)
    referrer = models.URLField(blank=True, max_length=500)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["certificate", "-created_at"]),
        ]

    def __str__(self):
        return f"Verification of {self.certificate.certificate_number}"