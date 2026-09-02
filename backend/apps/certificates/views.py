"""Certificate endpoints: issuance, verification, templates."""
import json
from django.http import HttpResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response

from apps.certificates import services
from apps.certificates.models import Certificate, CertificateTemplate
from apps.certificates.serializers import (
    CertificateSerializer,
    CertificateTemplateSerializer,
    CertificateVerificationSerializer,
    CertificateTemplateCreateSerializer,
)
from apps.core.exceptions import DomainError
from apps.enrollment.models import Enrollment


class IsAdminOrInstructor(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and (request.user.is_admin or request.user.is_instructor)
        )


class CertificateTemplateViewSet(viewsets.ModelViewSet):
    """Certificate template management (admin/instructor)."""

    permission_classes = [IsAdminOrInstructor]
    serializer_class = CertificateTemplateSerializer
    queryset = CertificateTemplate.objects.all()
    filterset_fields = ["is_active", "is_default", "course"]

    def get_serializer_class(self):
        if self.action == "create":
            return CertificateTemplateCreateSerializer
        return CertificateTemplateSerializer

    def perform_create(self, serializer):
        serializer.save()


class CertificateViewSet(viewsets.ReadOnlyModelViewSet):
    """Certificate verification and download (student access)."""

    permission_classes = [IsAuthenticated]
    serializer_class = CertificateSerializer
    lookup_field = "certificate_number"

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Certificate.objects.all().select_related("student", "course", "template")
        if user.is_instructor:
            return Certificate.objects.filter(course__instructor=self.request.user).select_related("student", "course", "template")
        return Certificate.objects.filter(student=self.request.user).select_related("student", "course", "template")

    @action(detail=True, methods=["get"], url_path="pdf")
    def download_pdf(self, request, certificate_number=None):
        """GET /certificates/{number}/pdf/ -> download PDF."""
        certificate = self.get_object()
        if not certificate.pdf_file:
            return Response({"detail": "PDF not generated."}, status=404)

        # Increment download count if needed
        response = FileResponse(
            certificate.pdf_file.open(),
            content_type="application/pdf",
            filename=f"certificate_{certificate.certificate_number}.pdf",
        )
        response["Content-Disposition"] = f'attachment; filename="certificate_{certificate.certificate_number}.pdf"'
        return response

    @action(detail=True, methods=["post"], url_path="revoke")
    def revoke(self, request, certificate_number=None):
        """POST /certificates/{number}/revoke/ - revoke certificate (admin/instructor)."""
        certificate = self.get_object()
        if not (request.user.is_admin or (request.user.is_instructor and certificate.course.instructor == request.user)):
            return Response({"detail": "Not authorized."}, status=403)

        reason = request.data.get("reason", "")
        if not certificate.revoke(request.user, reason):
            return Response({"detail": "Certificate cannot be revoked."}, status=400)

        return Response({"detail": "Certificate revoked."})


@csrf_exempt
@api_view(["GET"])
@permission_classes([AllowAny])
def verify_certificate(request, verification_code):
    """GET /verify/{code}/ - public certificate verification page/API."""
    # Accept both GET and POST
    if request.method == "POST":
        code = request.data.get("verification_code") or verification_code
    else:
        code = verification_code or request.GET.get("code")

    if not code:
        return Response({"valid": False, "error": "Verification code required."}, status=400)

    result = verify_certificate(code, request=request)
    return Response(result)


def certificate_verification_page(request, verification_code):
    """HTML page for public certificate verification."""
    result = verify_certificate(verification_code)

    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Certificate Verification - VaceUp</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 30px; max-width: 600px; margin: 0 auto; }
            .status { padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; font-weight: bold; }
            .valid { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .invalid { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .cert-info { background: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
            .detail { margin: 10px 0; }
            .label { font-weight: bold; color: #666; }
            .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Certificate Verification</h1>
            <div class="status {{ 'valid' if result.get('valid') else 'invalid' }}">
                {'✓ Valid Certificate' if result.get('valid') else '✗ Invalid Certificate'}
            </div>
            {% if result.valid %}
            <div class="cert-info">
                <div class="detail"><span class="label">Certificate #:</span> <span>{{ cert.certificate_number }}</span></div>
                <div class="detail"><span class="label">Student:</span> <span>{{ cert.student_name }}</span></div>
                <div class="detail"><span class="label">Course:</span> <span>{{ cert.course_title }}</span></div>
                <div class="detail"><span class="label">Instructor:</span> <span>{{ cert.instructor_name }}</span></div>
                <div class="detail"><span class="label">Issued:</span> <span>{{ cert.issue_date }}</span></div>
                <div class="detail"><span class="label">Verification Code:</span> <span>{{ cert.verification_code }}</span></div>
                {% if cert.pdf_url %}
                <a href="{{ cert.pdf_url }}" class="btn" target="_blank">Download PDF</a>
                {% endif %}
            </div>
            {% else %}
            <p>{{ result.error }}</p>
            {% endif %}
        </div>
    </body>
    </html>
    """
    from django.template import Template, Context
    from django.http import HttpResponse

    result = verify_certificate(verification_code)
    cert = result.get("certificate", {})

    template = Template(html)
    context = Context({"result": result, "cert": cert})
    return HttpResponse(template.render(context))