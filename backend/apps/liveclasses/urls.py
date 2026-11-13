"""Router wiring for live classes (mount under /api/v1/)."""
from rest_framework.routers import DefaultRouter

from apps.liveclasses.views import LiveClassViewSet
from apps.liveclasses.recordings import RoomRecordingViewSet

router = DefaultRouter()
router.register("live-classes", LiveClassViewSet, basename="liveclass")
router.register("room-recordings", RoomRecordingViewSet, basename="room-recording")

urlpatterns = router.urls
