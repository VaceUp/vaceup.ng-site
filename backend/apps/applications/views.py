"""Application endpoints: submit, list, review."""

from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.applications import services
from apps.applications.models import Application
from apps.applications.serializers import (
    ApplicationSerializer,
    ApplicationCreateSerializer,
    ApplicationReviewSerializer,
)

User = get_user_model()


class IsAdminOrInstructor:
    """Permission: admin or instructor only."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_admin or user.is_instructor))


class ApplicationViewSet(viewsets.GenericViewSet):
    """Student submits applications; admin/instructor reviews."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return ApplicationCreateSerializer
        return ApplicationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Application.objects.all()
        if user.is_instructor:
            return Application.objects.filter(course__instructor=user)
        return Application.objects.filter(student=user)

    def create(self, request):
        """POST /applications/ {course, motivation} -> submit application."""
        serializer = ApplicationCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        application = services.application_submit(
            student=request.user,
            course=serializer.validated_data["course"],
            motivation=serializer.validated_data.get("motivation", ""),
        )
        return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)

    def list(self, request):
        """GET /applications/ -> list applications (scoped to user)."""
        queryset = self.get_queryset()
        serializer = ApplicationSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        """POST /applications/{id}/review/ {action, rejection_reason?} -> approve/reject."""
        application = self.get_object()
        serializer = ApplicationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not (request.user.is_admin or request.user.is_instructor):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)

        try:
            application = services.application_review(
                application=application,
                reviewer=request.user,
                action=serializer.validated_data["action"],
                rejection_reason=serializer.validated_data.get("rejection_reason", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ApplicationSerializer(application).data)

    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        """POST /applications/{id}/withdraw/ -> student withdraws own application."""
        try:
            application = Application.objects.get(pk=pk)
        except Application.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if application.student_id != request.user.id:
            return Response({"detail": "Not your application."}, status=status.HTTP_403_FORBIDDEN)

        try:
            application = services.application_withdraw(application=application, student=request.user)
        except (PermissionError, ValueError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ApplicationSerializer(application).data)