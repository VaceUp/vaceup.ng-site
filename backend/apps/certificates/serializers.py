"""Serializers for certificates."""
from rest_framework import serializers

from apps.certificates.models import Certificate, CertificateTemplate, CertificateVerificationLog
from apps.courses.serializers import CourseBasicSerializer


class CertificateTemplateSerializer(serializers.ModelSerializer):
    """Serializer for certificate templates."""

    class Meta:
        model = CertificateTemplate
        fields = (
            "id",
            "name",
            "course",
            "html_template",
            "css_styles",
            "page_size",
            "orientation",
            "is_active",
            "is_default",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class CertificateSerializer(serializers.ModelSerializer):
    """Read shape for certificates."""

    student_name = serializers.CharField(source="student.full_name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True)
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = (
            "id",
            "certificate_number",
            "verification_code",
            "student",
            "student_name",
            "course",
            "course_title",
            "template",
            "template_name",
            "status",
            "student_name_at_issue",
            "course_title_at_issue",
            "instructor_name_at_issue",
            "institution_name_at_issue",
            "completion_date",
            "issue_date",
            "expires_at",
            "pdf_file",
            "pdf_url",
            "pdf_generated_at",
            "verification_code",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "certificate_number",
            "verification_code",
            "pdf_generated_at",
            "created_at",
            "updated_at",
        )

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None


class CertificateVerificationSerializer(serializers.Serializer):
    """Serializer for certificate verification response."""

    valid = serializers.BooleanField()
    error = serializers.CharField(required=False)
    code = serializers.CharField(required=False)
    certificate = serializers.DictField(required=False, child=serializers.CharField())


class CertificateTemplateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating certificate templates."""

    class Meta:
        model = CertificateTemplate
        fields = (
            "name",
            "course",
            "html_template",
            "css_styles",
            "page_size",
            "orientation",
            "is_active",
            "is_default",
        )

    def validate(self, attrs):
        if attrs.get("is_default") and attrs.get("course"):
            # Check if there's already a default for this course
            if CertificateTemplate.objects.filter(
                course=attrs["course"], is_default=True, is_active=True
            ).exists():
                raise serializers.ValidationError(
                    "A default template already exists for this course."
                )
        return attrs