"""URL routing for staff meetings (mounted under /api/v1/)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.meetings.views import MeetingViewSet

router = DefaultRouter()
router.register("meetings", MeetingViewSet, basename="meeting")

urlpatterns = [path("", include(router.urls))]
