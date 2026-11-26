from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound
from apps.core.throttling import DatabaseScopedRateThrottle

from apps.accounts import services as account_services
from apps.accounts.serializers import UserSerializer
from apps.courses.models import Course

from .authentication import KidsSessionAuthentication
from .models import KidsAdmission, KidsEnrollment, KidsLearner, KidsParentProfile, KidsSession
from .permissions import IsKidsParent
from .serializers import (
    KidsAdmissionSerializer,
    KidsEnrollmentSerializer,
    KidsLearnerSerializer,
    KidsLoginSerializer,
    KidsParentSerializer,
    KidsProgramSerializer,
    KidsRegisterSerializer,
)
from .services import create_learner, login_parent, register_parent, submit_admission

User = get_user_model()


class KidsRegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [DatabaseScopedRateThrottle]
    throttle_scope = "kids_auth_register"

    def post(self, request):
        serializer = KidsRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = register_parent(**serializer.validated_data)
        return Response(
            {
                "detail": "Parent account created. Check your email to activate the Kids Academy portal.",
                "verification_email_queued": getattr(user, "verification_email_queued", True),
            },
            status=status.HTTP_201_CREATED,
        )


class KidsVerifyEmailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [DatabaseScopedRateThrottle]
    throttle_scope = "kids_auth_verify"

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response({"token": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        user = account_services.verify_email(token=token)
        if not user.can_access_kids or not hasattr(user, "kids_parent_profile"):
            return Response({"detail": "This verification link is not a Kids Academy link."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Email verified. You can now sign in to Kids Academy."})


class KidsResendVerificationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [DatabaseScopedRateThrottle]
    throttle_scope = "kids_auth_resend"

    def post(self, request):
        email = request.data.get("email", "")
        account_services.resend_verification(email=email, kind="kids_verification")
        return Response({"detail": "If a Kids Academy account matches, a verification email will be sent."})


class KidsLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [DatabaseScopedRateThrottle]
    throttle_scope = "kids_auth_login"

    def post(self, request):
        serializer = KidsLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session, raw = login_parent(**serializer.validated_data)
        parent = session.user.kids_parent_profile
        return Response(
            {
                "access": raw,
                "expires_at": session.expires_at,
                "user": UserSerializer(session.user, context={"request": request}).data,
                "parent": KidsParentSerializer(parent).data,
            }
        )


class KidsLogoutView(APIView):
    authentication_classes = [KidsSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if isinstance(request.auth, KidsSession):
            request.auth.revoke()
        return Response(status=status.HTTP_204_NO_CONTENT)


class KidsMeView(APIView):
    authentication_classes = [KidsSessionAuthentication]
    permission_classes = [IsKidsParent]

    def get(self, request):
        parent = request.user.kids_parent_profile
        return Response({
            "user": UserSerializer(request.user, context={"request": request}).data,
            "parent": KidsParentSerializer(parent).data,
            "learners": KidsLearnerSerializer(parent.learners.all(), many=True).data,
        })


class KidsProgramListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        courses = Course.objects.filter(
            is_published=True,
        ).filter(Q(category__slug="kids-tech-academy") | Q(category__name__iexact="Kids Tech Academy")).select_related("category")
        return Response(KidsProgramSerializer(courses, many=True, context={"request": request}).data)


class KidsProgramDetailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        course = Course.objects.filter(
            slug=slug,
            is_published=True,
        ).filter(Q(category__slug="kids-tech-academy") | Q(category__name__iexact="Kids Tech Academy")).select_related("category").first()
        if course is None:
            raise NotFound("Kids Academy programme not found.")
        return Response(KidsProgramSerializer(course, context={"request": request}).data)


class KidsLearnerListCreateView(APIView):
    authentication_classes = [KidsSessionAuthentication]
    permission_classes = [IsKidsParent]

    def get(self, request):
        return Response(KidsLearnerSerializer(request.user.kids_parent_profile.learners.all(), many=True).data)

    def post(self, request):
        serializer = KidsLearnerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        learner = create_learner(parent=request.user.kids_parent_profile, **serializer.validated_data)
        return Response(KidsLearnerSerializer(learner).data, status=status.HTTP_201_CREATED)


class KidsAdmissionListCreateView(APIView):
    authentication_classes = [KidsSessionAuthentication]
    permission_classes = [IsKidsParent]

    def get(self, request):
        admissions = KidsAdmission.objects.filter(parent=request.user.kids_parent_profile).select_related("learner", "course", "intake")
        return Response(KidsAdmissionSerializer(admissions, many=True).data)

    def post(self, request):
        serializer = KidsAdmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        admission = submit_admission(parent=request.user.kids_parent_profile, **serializer.validated_data)
        return Response(KidsAdmissionSerializer(admission).data, status=status.HTTP_201_CREATED)


class KidsEnrollmentListView(APIView):
    authentication_classes = [KidsSessionAuthentication]
    permission_classes = [IsKidsParent]

    def get(self, request):
        enrollments = KidsEnrollment.objects.filter(parent=request.user.kids_parent_profile).select_related("learner", "course")
        return Response(KidsEnrollmentSerializer(enrollments, many=True).data)


class KidsPortalView(APIView):
    authentication_classes = [KidsSessionAuthentication]
    permission_classes = [IsKidsParent]

    def get(self, request):
        parent = request.user.kids_parent_profile
        admissions = KidsAdmission.objects.filter(parent=parent).select_related("learner", "course", "intake")
        enrollments = KidsEnrollment.objects.filter(parent=parent).select_related("learner", "course")
        return Response({
            "parent": KidsParentSerializer(parent).data,
            "learners": KidsLearnerSerializer(parent.learners.all(), many=True).data,
            "admissions": KidsAdmissionSerializer(admissions, many=True).data,
            "enrollments": KidsEnrollmentSerializer(enrollments, many=True).data,
        })
