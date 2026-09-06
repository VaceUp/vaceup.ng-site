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
    path("admin/dashboard/users/", AdminDashboardViewSet.as_view({"get": "users_list"}), name="admin-users-list"),
    path("admin/dashboard/users/password/", AdminDashboardViewSet.as_view({"post": "user_password"}), name="admin-user-password"),
    path("admin/dashboard/payments/", AdminDashboardViewSet.as_view({"get": "payments_list"}), name="admin-payments-list"),
    path("admin/dashboard/enrollments/", AdminDashboardViewSet.as_view({"get": "enrollments_list"}), name="admin-enrollments-list"),
    path("admin/dashboard/submissions/", AdminDashboardViewSet.as_view({"get": "submissions_list"}), name="admin-submissions-list"),
    path("admin/dashboard/courses/", AdminDashboardViewSet.as_view({"get": "courses_list"}), name="admin-courses-list"),
    path("admin/dashboard/courses/create/", AdminDashboardViewSet.as_view({"post": "course_create"}), name="admin-course-create"),
    path("admin/dashboard/courses/update/", AdminDashboardViewSet.as_view({"post": "course_update"}), name="admin-course-update"),
]