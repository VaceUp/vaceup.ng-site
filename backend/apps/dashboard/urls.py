"""URL wiring for the instructor dashboard (mount under /api/v1/)."""
from django.urls import path

from apps.dashboard.views import InstructorDashboardView, InstructorStudentsView

urlpatterns = [
    path("instructor/dashboard/", InstructorDashboardView.as_view(),
         name="instructor-dashboard"),
    path("instructor/students/", InstructorStudentsView.as_view(),
         name="instructor-students"),
]
