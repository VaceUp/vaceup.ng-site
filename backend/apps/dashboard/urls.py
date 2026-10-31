"""URL wiring for the instructor dashboard (mount under /api/v1/)."""
from django.urls import path

from apps.dashboard.views import InstructorDashboardView, InstructorStudentsView
from apps.dashboard.member_views import (
    WorkspaceOverviewView, WorkspaceCourseListView, WorkspaceCourseDetailView,
    WorkspacePaymentListView, WorkspaceApplicationListView,
)
from apps.dashboard.teaching_views import CourseGradebookView

urlpatterns = [
    path("dashboard/overview/", WorkspaceOverviewView.as_view(), name="workspace-overview"),
    path("dashboard/courses/", WorkspaceCourseListView.as_view(), name="workspace-courses"),
    path("dashboard/courses/<int:pk>/", WorkspaceCourseDetailView.as_view(), name="workspace-course-detail"),
    path("dashboard/payments/", WorkspacePaymentListView.as_view(), name="workspace-payments"),
    path("dashboard/applications/", WorkspaceApplicationListView.as_view(), name="workspace-applications"),
    path("instructor/dashboard/", InstructorDashboardView.as_view(),
         name="instructor-dashboard"),
    path("instructor/students/", InstructorStudentsView.as_view(),
         name="instructor-students"),
    path("instructor/courses/<int:pk>/gradebook/", CourseGradebookView.as_view(),
         name="instructor-course-gradebook"),
]
