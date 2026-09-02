"""Router + wiring for whiteboard (mount under /api/v1/)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.whiteboard.views import WhiteboardSessionViewSet

router = DefaultRouter()
router.register("whiteboard/sessions", WhiteboardSessionViewSet, basename="whiteboard-session")

urlpatterns = [
    path("", include(router.urls)),
]