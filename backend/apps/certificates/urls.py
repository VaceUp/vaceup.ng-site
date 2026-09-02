"""Router + wiring for certificates (mount under /api/v1/)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.certificates.views import (
    CertificateTemplateViewSet,
    CertificateViewSet,
    verify_certificate,
    certificate_verification_page,
)

router = DefaultRouter()
router.register("certificates/templates", CertificateTemplateViewSet, basename="certificate-template")
router.register("certificates", CertificateViewSet, basename="certificate")

urlpatterns = [
    path("", include(router.urls)),
    # Public verification endpoints
    path("verify/<str:verification_code>/", verify_certificate, name="verify-certificate"),
    path("verify/<str:verification_code>/page/", certificate_verification_page, name="verify-certificate-page"),
]