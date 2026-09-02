"""Router wiring for live classes (mount under /api/v1/)."""
from rest_framework.routers import DefaultRouter

from apps.liveclasses.views import LiveClassViewSet

router = DefaultRouter()
router.register("live-classes", LiveClassViewSet, basename="liveclass")

urlpatterns = router.urls
