"""Thin HTTP layer for the accounts lifecycle.

Each view: validate with a serializer → call one service → return a response.
No business logic here. All endpoints are public except ``MeView``; login is
a hardened wrapper around simplejwt's token endpoint.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts import services
from apps.accounts.serializers import (
    EmailVerificationSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    UserSerializer,
)

User = get_user_model()

# Generic, non-committal message for flows that must not leak account existence.
_OK_IF_EXISTS = (
    "If an account matches, we've sent an email with the next steps."
)


class RegisterView(APIView):
    """POST: create an inactive account and email a verification link."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.register_user(**serializer.validated_data)
        return Response(
            {
                "detail": "Account created. Check your email to verify your "
                "address before logging in."
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
    """GET: the authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


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

        data["user"] = UserSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    """Hardened JWT login: clearer errors + user object in the response."""

    serializer_class = _LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_login"
