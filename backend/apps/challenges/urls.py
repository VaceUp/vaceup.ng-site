from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AccessView, AdminAssetDownloadView, AdminCategoryViewSet, AdminRoundViewSet, EngagementView,
    PortalView, PublicRoundViewSet, RegisterView, SubmissionView, UploadCompleteView, UploadDownloadView,
    UploadView, VerifyView,
)

router = DefaultRouter()
router.register("rounds", PublicRoundViewSet, basename="challenge-round")
router.register("admin/rounds", AdminRoundViewSet, basename="challenge-admin-round")
router.register("admin/categories", AdminCategoryViewSet, basename="challenge-admin-category")

urlpatterns = [path("challenges/", include([
    path("register/", RegisterView.as_view()), path("access/", AccessView.as_view()),
    path("verify/", VerifyView.as_view()), path("portal/", PortalView.as_view()),
    path("uploads/", UploadView.as_view()), path("uploads/<uuid:asset_id>/complete/", UploadCompleteView.as_view()),
    path("uploads/<uuid:asset_id>/download/", UploadDownloadView.as_view()),
    path("submissions/", SubmissionView.as_view()), path("engagement/", EngagementView.as_view()),
    path("admin/assets/<uuid:asset_id>/download/", AdminAssetDownloadView.as_view()),
    path("", include(router.urls)),
]))]
