"""Router wiring for the courses app (mount under /api/v1/)."""
from rest_framework.routers import DefaultRouter

from apps.courses.views import (
    CategoryViewSet,
    CourseViewSet,
    LessonViewSet,
    ModuleViewSet,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("courses", CourseViewSet, basename="course")
router.register("modules", ModuleViewSet, basename="module")
router.register("lessons", LessonViewSet, basename="lesson")

urlpatterns = router.urls
