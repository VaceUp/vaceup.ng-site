"""Explicit, audited access for students whose payment happened off-platform."""
import hashlib
import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.adminpanel.models import AdminActionLog
from apps.adminpanel.services import log_admin_action
from apps.core.exceptions import IllegalStateTransition
from apps.core.permissions import IsAdmin
from apps.core.throttling import DatabaseUserRateThrottle
from apps.courses.models import Course
from apps.enrollment.models import Enrollment
from apps.enrollment.services import grant_enrollment
from apps.enrollment.serializers import EnrollmentSerializer

User = get_user_model()


class EnrollmentGrantSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(min_value=1)
    course_id = serializers.IntegerField(min_value=1)
    source = serializers.ChoiceField(choices=("external_payment", "legacy_paid_student"))
    reason = serializers.CharField(min_length=10, max_length=1000)
    payment_reference = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    request_id = serializers.UUIDField()
    confirmed = serializers.BooleanField()

    def validate_confirmed(self, value):
        if not value:
            raise serializers.ValidationError("Confirm you have verified this student's off-platform payment.")
        return value


class EnrollmentGrantThrottle(DatabaseUserRateThrottle):
    scope = "admin_enrollment_grant"
    rate = "20/min"


class EnrollmentGrantView(GenericAPIView):
    permission_classes = [IsAdmin]
    throttle_classes = [EnrollmentGrantThrottle]
    serializer_class = EnrollmentGrantSerializer

    @extend_schema(responses={200: EnrollmentSerializer, 201: EnrollmentSerializer})
    @transaction.atomic
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Shared actor lock serializes idempotency checks; student lock also
        # serializes against checkout. Stable ordering avoids reciprocal locks.
        accounts = {user.pk: user for user in User.objects.select_for_update().filter(
            pk__in=[request.user.pk, data["student_id"]],
        ).order_by("pk")}
        actor = accounts.get(request.user.pk)
        student = accounts.get(data["student_id"])
        if not actor or not actor.is_active or not actor.is_admin:
            raise PermissionDenied("An active administrator account is required.")
        if not student or not student.is_active or not student.is_student:
            raise ValidationError({"student_id": "Select an active student account. Account activation is separate from course access."})
        fingerprint = hashlib.sha256(json.dumps({
            key: str(value) for key, value in data.items() if key != "request_id"
        }, sort_keys=True).encode()).hexdigest()
        previous = AdminActionLog.objects.filter(
            admin=actor, action_type=AdminActionLog.ActionType.ENROLLMENT_GRANT,
            metadata__request_id=str(data["request_id"]),
        ).first()
        if previous:
            if previous.metadata.get("fingerprint") != fingerprint:
                raise IllegalStateTransition("This request identifier was already used for another grant. Review the form and start a new request.")
            enrollment = get_object_or_404(Enrollment, pk=previous.metadata["enrollment_id"])
            return Response(EnrollmentSerializer(enrollment).data)
        course = get_object_or_404(Course, pk=data["course_id"])
        if not course.is_published:
            raise ValidationError({"course_id": "Publish the course before granting student access."})
        enrollment = Enrollment.objects.filter(student=student, course=course).first()
        if enrollment and enrollment.status == Enrollment.Status.SUSPENDED:
            raise IllegalStateTransition("This enrollment is suspended. Review the suspension separately; an off-platform payment grant cannot override it.")
        if enrollment:
            return Response(EnrollmentSerializer(enrollment).data)
        enrollment = grant_enrollment(student=student, course=course)
        log_admin_action(
            admin=actor, action_type=AdminActionLog.ActionType.ENROLLMENT_GRANT,
            target_user=student, target_course=course,
            description="Course access granted after verification of off-platform payment.",
            metadata={"enrollment_id": enrollment.pk, "source": data["source"],
                      "reason": data["reason"], "payment_reference": data["payment_reference"],
                      "request_id": str(data["request_id"]), "fingerprint": fingerprint},
            request=request,
        )
        # No Payment record: this is an access grant, not newly collected revenue.
        return Response(EnrollmentSerializer(enrollment).data, status=201)
