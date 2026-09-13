"""Certificate endpoints: issuance, verification, templates."""
import json
from django.http import HttpResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction

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

    def get_queryset(self):
        if self.request.user.is_admin:
            return self.queryset.all()
        return self.queryset.filter(course__instructor=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return CertificateTemplateCreateSerializer
        return CertificateTemplateSerializer

    def perform_create(self, serializer):
        self._check_course(serializer)
        self._save_template(serializer)

    def perform_update(self, serializer):
        self._check_course(serializer)
        self._save_template(serializer)

    def _save_template(self, serializer):
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            raise ValidationError("That template conflicts with an existing name or default. Choose one default per course/global scope.") from None

    def _check_course(self, serializer):
        course = serializer.validated_data.get("course", getattr(serializer.instance, "course", None))
        if not self.request.user.is_admin and (course is None or course.instructor_id != self.request.user.pk):
            raise PermissionDenied("Only administrators manage global templates; tutors may manage their own courses only.")


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
        if not services.certificate_pdf_url(certificate):
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
        services.revoke_certificate(certificate=certificate, user=request.user, reason=reason)

        return Response({"detail": "Certificate revoked."})


@csrf_exempt
@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def verify_certificate(request, verification_code):
    """GET /verify/{code}/ - public certificate verification page/API."""
    # Accept both GET and POST
    if request.method == "POST":
        code = request.data.get("verification_code") or verification_code
    else:
        code = verification_code or request.GET.get("code")

    if not code:
        return Response({"valid": False, "error": "Verification code required."}, status=400)

    result = services.verify_certificate(code, request=request)
    return Response(result, headers={"Cache-Control": "no-store"})


def certificate_verification_page(request, verification_code):
    """Use the established branded frontend instead of a separate HTML shell."""
    from urllib.parse import urlencode
    from django.conf import settings
    from django.shortcuts import redirect
    return redirect(f"{settings.FRONTEND_BASE_URL.rstrip('/')}/verify?{urlencode({'code': verification_code})}")
