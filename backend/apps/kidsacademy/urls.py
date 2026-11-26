from django.urls import path

from .views import (
    KidsAdmissionListCreateView,
    KidsEnrollmentListView,
    KidsLearnerListCreateView,
    KidsLoginView,
    KidsLogoutView,
    KidsMeView,
    KidsPortalView,
    KidsProgramDetailView,
    KidsProgramListView,
    KidsRegisterView,
    KidsResendVerificationView,
    KidsVerifyEmailView,
)

urlpatterns = [
    path("auth/register/", KidsRegisterView.as_view(), name="kids-register"),
    path("auth/verify-email/", KidsVerifyEmailView.as_view(), name="kids-verify-email"),
    path("auth/resend-verification/", KidsResendVerificationView.as_view(), name="kids-resend-verification"),
    path("auth/login/", KidsLoginView.as_view(), name="kids-login"),
    path("auth/logout/", KidsLogoutView.as_view(), name="kids-logout"),
    path("auth/me/", KidsMeView.as_view(), name="kids-me"),
    path("programs/", KidsProgramListView.as_view(), name="kids-programs"),
    path("programs/<slug:slug>/", KidsProgramDetailView.as_view(), name="kids-program-detail"),
    path("learners/", KidsLearnerListCreateView.as_view(), name="kids-learners"),
    path("admissions/", KidsAdmissionListCreateView.as_view(), name="kids-admissions"),
    path("enrollments/", KidsEnrollmentListView.as_view(), name="kids-enrollments"),
    path("portal/", KidsPortalView.as_view(), name="kids-portal"),
]
