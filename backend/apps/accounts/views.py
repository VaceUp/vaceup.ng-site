"""Thin HTTP layer for the accounts lifecycle.

Each view: validate with a serializer → call one service → return a response.
No business logic here. All endpoints are public except ``MeView``; login is
a hardened wrapper around simplejwt's token endpoint.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from apps.core.throttling import DatabaseScopedRateThrottle as ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts import services
from apps.accounts.serializers import (
    AdminGuidePreferenceSerializer,
    AvatarUploadSerializer,
    ChangePasswordSerializer,
    EmailVerificationSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    UserSerializer,
)

User = get_user_model()

# Generic, non-committal message for flows that must not leak account existence.
_OK_IF_EXISTS = (
    "If an account matches and needs this email, delivery will be attempted. "
    "Check your inbox and spam folder. If it does not arrive, try again shortly or contact support."
)


class RegisterView(APIView):
    """POST: create an inactive account and email a verification link."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register_user(**serializer.validated_data)
        return Response(
            {
                "detail": (
                    "Account created. Check your email to verify your address before logging in."
                    if user.verification_email_queued else
                    "Account created, but verification email delivery could not be started. "
                    "Please request a new verification link shortly. Do not register again."
                ),
                "verification_email_queued": user.verification_email_queued,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    """POST {token}: activate the account behind a verification token."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_verify"

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.verify_email(token=serializer.validated_data["token"])
        return Response(
            {"detail": "Email verified. You can now log in."},
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(APIView):
    """POST {email}: re-send a verification link (always 200)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_resend"

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.resend_verification(email=serializer.validated_data["email"])
        return Response({"detail": _OK_IF_EXISTS}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    """POST {email}: issue a reset link (always 200, no enumeration)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(
            email=serializer.validated_data["email"]
        )
        return Response({"detail": _OK_IF_EXISTS}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """POST {token, new_password}: set a new password and revoke sessions."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_password_reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reset_password(
            token=serializer.validated_data["token"],
            new_password=serializer.validated_data["new_password"],
        )
        return Response(
            {"detail": "Password updated. Please log in with your new "
             "password."},
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    """GET/PATCH: the authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        if "admin_guide_dismissed" in request.data:
            if not request.user.is_admin:
                raise PermissionDenied("Only administrators have an admin guide preference.")
            serializer = AdminGuidePreferenceSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            request.user.admin_guide_dismissed = serializer.validated_data["admin_guide_dismissed"]
            request.user.save(update_fields=["admin_guide_dismissed"])
        else:
            serializer = ProfileUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            request.user.full_name = serializer.validated_data["full_name"]
            request.user.save(update_fields=["full_name"])
        return Response(UserSerializer(request.user, context={"request": request}).data)


class AvatarView(APIView):
    """POST a profile picture, DELETE it. Both answer with the updated user.

    The picture is shown beside the learner's name, so it belongs in the public
    image store (Cloudinary, or the bucket when Cloudinary is off) — never the
    private bucket that lesson videos use.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        previous = user.avatar
        user.avatar = serializer.validated_data["avatar"]
        user.avatar_updated_at = timezone.now()
        user.save(update_fields=["avatar", "avatar_updated_at"])
        # Only after the new picture is stored: a failed save must not leave
        # the account with no picture at all. The file is removed through the
        # storage, because FieldFile.delete() clears the field on the user
        # instance and would report the new picture as missing.
        if previous and previous.name != user.avatar.name:
            previous.storage.delete(previous.name)
        return Response(UserSerializer(user, context={"request": request}).data)

    def delete(self, request):
        user = request.user
        if user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
            user.avatar_updated_at = None
            user.save(update_fields=["avatar", "avatar_updated_at"])
        return Response(UserSerializer(user, context={"request": request}).data)


class ChangePasswordView(APIView):
    """POST {current_password, new_password}: change a known password."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_password_reset"

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)
        services.change_password(
            user=request.user,
            new_password=serializer.validated_data["new_password"],
        )
        return Response(
            {"detail": "Password updated. Every session, including this one, will need to sign in again once its access token expires."},
            status=status.HTTP_200_OK,
        )


class _LoginSerializer(TokenObtainPairSerializer):
    """Token serializer that distinguishes 'unverified' from 'bad password'.

    We only reveal that an account is unverified when the *password is
    correct* — so wrong-password attempts can't be used to enumerate accounts.
    """

    def validate(self, attrs):
        from rest_framework.exceptions import AuthenticationFailed

        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            email = attrs.get(self.username_field)
            password = attrs.get("password")
            user = User.objects.filter(email__iexact=email).first()
            if (
                user is not None
                and not user.is_active
                and password
                and user.check_password(password)
            ):
                raise AuthenticationFailed(
                    "Your email is not verified yet. Check your inbox or "
                    "request a new verification link.",
                    code="email_not_verified",
                )
            raise  # genuine bad credentials

        data["user"] = UserSerializer(self.user, context={
            "request": self.context["request"]
        }).data
        return data


class LoginView(TokenObtainPairView):
    """Hardened JWT login: clearer errors + user object in the response."""

    serializer_class = _LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_login"
