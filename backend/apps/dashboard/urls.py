"""URL wiring for the instructor dashboard (mount under /api/v1/)."""
from django.urls import path

from apps.dashboard.views import InstructorDashboardView, InstructorStudentsView
from apps.dashboard.member_views import (
    WorkspaceOverviewView, WorkspaceCourseListView, WorkspaceCourseDetailView,
    WorkspacePaymentListView,
)

urlpatterns = [
    path("dashboard/overview/", WorkspaceOverviewView.as_view(), name="workspace-overview"),
    path("dashboard/courses/", WorkspaceCourseListView.as_view(), name="workspace-courses"),
    path("dashboard/courses/<int:pk>/", WorkspaceCourseDetailView.as_view(), name="workspace-course-detail"),
    path("dashboard/payments/", WorkspacePaymentListView.as_view(), name="workspace-payments"),
    path("instructor/dashboard/", InstructorDashboardView.as_view(),
         name="instructor-dashboard"),
    path("instructor/students/", InstructorStudentsView.as_view(),
         name="instructor-students"),
]
