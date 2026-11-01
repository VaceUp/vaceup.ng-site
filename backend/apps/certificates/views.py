"""Certificate endpoints: issuance, verification, templates."""
import json
from django.contrib.auth import get_user_model
from django.http import HttpResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.views import APIView
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
from apps.courses.models import Course
from apps.enrollment.models import Enrollment


class IsAdminOrInstructor(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and (request.user.is_admin or request.user.is_instructor)
        )


class IsAcademyAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsTutor(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_instructor)


class TutorSignatureView(APIView):
    """GET/POST/DELETE /certificates/signature/ - the signed-in tutor's signature."""

    permission_classes = [IsAuthenticated, IsTutor]

    def get(self, request):
        data = services.tutor_signature(request.user)
        return Response({
            "signature": data["signature"],
            "updated_at": data["updated_at"],
            "name": request.user.full_name or request.user.email,
        })

    def post(self, request):
        upload = request.FILES.get("signature")
        if upload is None:
            raise ValidationError({"signature": "Choose a signature image to upload."})
        data = services.save_tutor_signature(tutor=request.user, signature=upload)
        return Response({
            "detail": "Your certificate signature has been saved.",
            "signature": data["signature"],
            "updated_at": data["updated_at"],
            "name": request.user.full_name or request.user.email,
        })

    def delete(self, request):
        services.clear_tutor_signature(tutor=request.user)
        return Response({"detail": "Your certificate signature has been removed."})


class ManagementSignatureView(APIView):
    """GET/POST/DELETE /certificates/signature/management/ - academy signatory."""

    permission_classes = [IsAuthenticated, IsAcademyAdmin]

    def get(self, request):
        return Response(services.management_signature())

    def post(self, request):
        upload = request.FILES.get("signature")
        has_name = "name" in request.data
        has_title = "title" in request.data
        if upload is None and not (has_name or has_title):
            raise ValidationError({"signature": "Choose a signature image to upload."})
        data = services.save_management_signature(
            signature=upload,
            name=request.data.get("name") if has_name else None,
            title=request.data.get("title") if has_title else None,
        )
        return Response({"detail": "The management signature has been saved.", **data})

    def delete(self, request):
        data = services.clear_management_signature()
        return Response({"detail": "The management signature has been removed.", **data})


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

    @action(detail=False, methods=["get"], url_path="preview")
    def preview(self, request):
        """GET /certificates/templates/preview/?course=&student= -> the rendered design."""
        course_id = request.query_params.get("course", "")
        student_id = request.query_params.get("student", "")
        if not (course_id.isdigit() and student_id.isdigit()):
            raise ValidationError("Choose both a course and a student to preview a certificate.")
        course = Course.objects.filter(pk=int(course_id)).select_related("instructor").first()
        if course is None:
            raise ValidationError("That course does not exist. Select a course from the list.")
        if not request.user.is_admin and course.instructor_id != request.user.pk:
            raise PermissionDenied("Tutors may only preview certificates for their own courses.")
        student = get_user_model().objects.filter(pk=int(student_id), is_active=True).first()
        if student is None:
            raise ValidationError("That student account is not available. Select another student.")
        tutor = course.instructor
        tutor_id = request.query_params.get("tutor", "")
        if tutor_id:
            if not tutor_id.isdigit():
                raise ValidationError("That tutor is not available. Select a tutor from the list.")
            tutor = get_user_model().objects.filter(
                pk=int(tutor_id), is_active=True, role="instructor",
            ).first()
            if tutor is None:
                raise ValidationError("That tutor is not available. Select a tutor from the list.")
        if not request.user.is_admin and tutor.pk != request.user.pk:
            raise PermissionDenied("Tutors may only preview certificates signed by themselves.")
        template_id = request.query_params.get("template", "")
        template = (
            CertificateTemplate.objects.filter(pk=int(template_id)).first()
            if template_id.isdigit() else None
        ) or services.get_template_for_course(course)
        if template is None:
            raise ValidationError("No active certificate template applies to this course.")
        if not request.user.is_admin and (template.course_id is None or template.course.instructor_id != request.user.pk):
            raise PermissionDenied("Tutors may only preview their own course templates.")
        try:
            html = services.preview_certificate_html(
                template=template, student=student, course=course, tutor=tutor,
            )
        except ValidationError:
            raise
        except Exception as exc:
            raise ValidationError(
                "This template could not be rendered. Check its Django template syntax."
            ) from exc
        return Response({
            "html": html,
            "template": template.name,
            "page_size": template.page_size,
            "orientation": template.orientation,
        })


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
    return redirect(f"{settings.FRONTEND_LINK_BASE.rstrip('/')}/verify/?{urlencode({'code': verification_code})}")
