"""URL routing for public website content."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.website.views import (
    AcademyProfileView,
    BloggerSourceView,
    BlogPostViewSet,
    EventViewSet,
    TeamMemberViewSet,
)

router = DefaultRouter()
router.register("website/team", TeamMemberViewSet, basename="website-team")
router.register("website/events", EventViewSet, basename="website-event")
router.register("website/posts", BlogPostViewSet, basename="website-post")

urlpatterns = [
    path("website/profile/", AcademyProfileView.as_view(), name="website-profile"),
    path("website/blog/source/", BloggerSourceView.as_view(), name="website-blog-source"),
    path("", include(router.urls)),
]
