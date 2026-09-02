"""Router + wiring for code editor (mount under /api/v1/)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.codeeditor.views import CodeEditorSessionViewSet

router = DefaultRouter()
router.register("code-editor/sessions", CodeEditorSessionViewSet, basename="code-editor-session")

urlpatterns = [
    path("", include(router.urls)),
]