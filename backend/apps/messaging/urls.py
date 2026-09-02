"""Router wiring for messaging (mount under /api/v1/)."""
from rest_framework.routers import DefaultRouter

from apps.messaging.views import MessageViewSet, NotificationViewSet

router = DefaultRouter()
router.register("messages", MessageViewSet, basename="message")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
