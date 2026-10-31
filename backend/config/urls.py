"""Root URL configuration (API v1)."""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

from apps.core.views import HealthView

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    # Health probe for the load balancer / uptime monitor.
    path("healthz/", HealthView.as_view(), name="healthz"),
    # Auth: register / verify / password-reset / login / refresh / logout / me
    path("api/v1/auth/", include("apps.accounts.urls")),
    # App routers.
    path("api/v1/", include("apps.courses.urls")),
    path("api/v1/", include("apps.enrollment.urls")),
    path("api/v1/", include("apps.payments.urls")),
    path("api/v1/", include("apps.liveclasses.urls")),
    path("api/v1/", include("apps.messaging.urls")),
    path("api/v1/", include("apps.dashboard.urls")),
    path("api/v1/", include("apps.assignments.urls")),
    path("api/v1/", include("apps.applications.urls")),
    path("api/v1/", include("apps.cart.urls")),
    path("api/v1/", include("apps.codeeditor.urls")),
    path("api/v1/", include("apps.whiteboard.urls")),
    path("api/v1/", include("apps.adminpanel.urls")),
    path("api/v1/", include("apps.certificates.urls")),
    path("api/v1/", include("apps.marketing.urls")),
    path("api/v1/", include("apps.announcements.urls")),
    path("api/v1/", include("apps.website.urls")),
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if not settings.AWS_STORAGE_BUCKET_NAME:
    # Local fallback: only public assets are exposed; private media stays on disk.
    urlpatterns += [
        re_path(
            r"^media/public/(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT / "public"},
        )
    ]
