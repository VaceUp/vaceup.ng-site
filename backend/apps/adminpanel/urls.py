"""Router + wiring for admin panel (mount under /api/v1/)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.adminpanel.views import (
    AdminActionLogViewSet,
    AdminSettingsViewSet,
    SystemAnnouncementViewSet,
    AdminDashboardViewSet,
)

router = DefaultRouter()
router.register("admin/actions", AdminActionLogViewSet, basename="admin-action")
router.register("admin/settings", AdminSettingsViewSet, basename="admin-setting")
router.register("admin/announcements", SystemAnnouncementViewSet, basename="admin-announcement")

urlpatterns = [
    path("", include(router.urls)),
    path("admin/dashboard/", AdminDashboardViewSet.as_view({"get": "stats"}), name="admin-dashboard-stats"),
    path("admin/dashboard/staff/invite/", AdminDashboardViewSet.as_view({"post": "invite_staff"}), name="admin-staff-invite"),
    path("admin/dashboard/staff/deactivate/", AdminDashboardViewSet.as_view({"post": "deactivate_staff"}), name="admin-staff-deactivate"),
    path("admin/dashboard/staff/activate/", AdminDashboardViewSet.as_view({"post": "activate_staff"}), name="admin-staff-activate"),
    path("admin/dashboard/staff/promote/", AdminDashboardViewSet.as_view({"post": "promote_staff"}), name="admin-staff-promote"),
    path("admin/dashboard/courses/bulk-price/", AdminDashboardViewSet.as_view({"post": "bulk_price_update"}), name="admin-bulk-price"),
]