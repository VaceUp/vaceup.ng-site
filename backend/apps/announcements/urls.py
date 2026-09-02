"""URL routing for announcements."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.announcements.views import (
    AnnouncementViewSet,
    AnnouncementCommentViewSet,
    AnnouncementReadReceiptViewSet,
)

router = DefaultRouter()
router.register("announcements", AnnouncementViewSet, basename="announcement")

urlpatterns = [
    path("", include(router.urls)),
]