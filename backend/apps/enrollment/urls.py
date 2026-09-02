"""Router wiring for the enrollment app (mount under /api/v1/)."""
from rest_framework.routers import DefaultRouter

from apps.enrollment.views import EnrollmentViewSet

router = DefaultRouter()
router.register("enrollments", EnrollmentViewSet, basename="enrollment")

urlpatterns = router.urls
