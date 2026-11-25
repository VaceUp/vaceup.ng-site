"""One source for the next advertised intake and administrator scheduling."""
from django.db.models import Q, Count
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.permissions import IsAdmin
from apps.courses.models import Course
from apps.website.models import AcademyIntake, IntakeWaitlistEntry
from apps.accounts.mail_delivery import send_account_message


def upcoming_intakes(course_slug=None, today=None):
    rows = AcademyIntake.objects.filter(
        is_active=True, is_archived=False, starts_on__gte=today or timezone.localdate(),
    )
    if course_slug:
        rows = rows.filter(Q(all_courses=True) | Q(courses__slug=course_slug, courses__is_published=True))
    return rows.distinct().prefetch_related("courses").order_by("starts_on", "pk")


class IntakeSerializer(serializers.ModelSerializer):
    courses = serializers.PrimaryKeyRelatedField(many=True, queryset=Course.objects.all(), required=False)
    capacity_per_course = serializers.IntegerField(min_value=1, max_value=10000, required=False)
    available_courses = serializers.SerializerMethodField()
    capacity_summary = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = AcademyIntake
        fields = (
            "id", "title", "starts_on", "ends_on", "is_active", "is_archived",
            "all_courses", "courses", "available_courses", "registration_url",
            "capacity_per_course", "status",
            "capacity_summary",
        )

    def get_available_courses(self, obj):
        rows = Course.objects.filter(is_published=True) if obj.all_courses else obj.courses.filter(is_published=True)
        data = []
        for course in rows:
            enrolled = obj.enrollments.filter(course=course, status__in=("active", "completed")).count()
            remaining = max(obj.capacity_per_course - enrolled, 0)
            data.append({"id": course.id, "slug": course.slug, "title": course.title,
                         "capacity": obj.capacity_per_course, "enrolled": enrolled,
                         "remaining": remaining, "status": "waitlist_open" if remaining == 0 else "open"})
        return data

    def get_status(self, obj):
        today = timezone.localdate()
        if obj.is_archived or obj.ends_on < today:
            return "closed"
        if not obj.is_active:
            return "upcoming"
        return "open" if obj.starts_on > today else "open"

    def get_capacity_summary(self, obj):
        return [{"course": row["course_id"], "enrolled": row["enrolled"], "remaining": max(obj.capacity_per_course - row["enrolled"], 0)} for row in obj.enrollments.filter(status__in=("active", "completed")).values("course_id").annotate(enrolled=Count("id"))]

    def validate(self, attrs):
        def value(name, default=None):
            return attrs.get(name, getattr(self.instance, name, default))
        if value("ends_on") < value("starts_on"):
            raise serializers.ValidationError({"ends_on": "The intake must end on or after its start date."})
        if value("is_active", False) and value("is_archived", False):
            raise serializers.ValidationError({"is_active": "Unarchive this intake before making it active."})
        courses = attrs.get("courses")
        if courses is None:
            courses = list(self.instance.courses.all()) if self.instance else []
        if value("is_active", False) and not value("all_courses", False) and not courses:
            raise serializers.ValidationError({"courses": "Select available courses or enable all courses before activating."})
        return attrs


class PublicIntakeSerializer(IntakeSerializer):
    class Meta(IntakeSerializer.Meta):
        fields = ("id", "title", "starts_on", "ends_on", "is_active", "available_courses", "registration_url", "capacity_per_course", "status")


class IntakeViewSet(viewsets.ModelViewSet):
    queryset = AcademyIntake.objects.prefetch_related("courses").all()
    serializer_class = IntakeSerializer
    permission_classes = [IsAdmin]

    def get_permissions(self):
        public = self.action in ("list", "retrieve", "next_intake", "waitlist") and not self._admin()
        return [AllowAny()] if public else [IsAdmin()]

    def _admin(self):
        user = self.request.user
        return bool(user and user.is_authenticated and user.is_admin)

    def get_queryset(self):
        if self._admin():
            return super().get_queryset()
        if self.action in ("list", "retrieve", "waitlist"):
            return AcademyIntake.objects.filter(is_archived=False, ends_on__gte=timezone.localdate()).prefetch_related("courses").order_by("starts_on", "pk")
        return upcoming_intakes(self.request.query_params.get("course"))

    def get_serializer_class(self):
        return IntakeSerializer if self._admin() else PublicIntakeSerializer

    @action(detail=False, methods=["get"], url_path="next")
    def next_intake(self, request):
        row = upcoming_intakes(request.query_params.get("course")).first()
        return Response({"intake": PublicIntakeSerializer(row).data if row else None})

    @action(detail=True, methods=["post"], url_path="waitlist")
    def waitlist(self, request, pk=None):
        intake = self.get_object()
        if intake.is_archived or intake.ends_on < timezone.localdate():
            return Response({"detail": "This intake is not accepting waitlist requests."}, status=400)
        payload = {
            "intake": intake.pk,
            "full_name": str(request.data.get("full_name") or "").strip(),
            "email": str(request.data.get("email") or "").strip().lower(),
            "phone": str(request.data.get("phone") or "").strip(),
            "preferred_course": request.data.get("preferred_course"),
        }
        serializer = WaitlistEntrySerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        course = serializer.validated_data["preferred_course"]
        if not course.is_published or (not intake.all_courses and not intake.courses.filter(pk=course.pk).exists()):
            raise serializers.ValidationError({"preferred_course": "Choose a published course offered in this intake."})
        entry, created = IntakeWaitlistEntry.objects.get_or_create(
            intake=intake, email=serializer.validated_data["email"],
            preferred_course=course,
            defaults={"full_name": serializer.validated_data["full_name"], "phone": serializer.validated_data["phone"]},
        )
        if not created:
            entry.full_name = serializer.validated_data["full_name"]
            entry.phone = serializer.validated_data["phone"]
            entry.status = "active"
            entry.save(update_fields=["full_name", "phone", "status", "updated_at"])
        email_sent = False
        try:
            message = EmailMultiAlternatives(
                subject=f"VaceUp waitlist request received: {intake.title}",
                body=f"Hello {entry.full_name},\n\nWe received your waitlist request for {entry.preferred_course.title} in {intake.title}. We will contact you if a place opens.\n\nVaceUp",
                to=[entry.email],
            )
            send_account_message(message)
            email_sent = True
        except Exception:
            email_sent = False
        return Response({"detail": "You are on the waitlist.", "email_sent": email_sent}, status=201 if created else 200)

    @action(detail=False, methods=["get", "patch"], url_path="waitlist")
    def waitlist_list(self, request):
        if request.method == "PATCH":
            entry = IntakeWaitlistEntry.objects.select_related("intake", "preferred_course").filter(pk=request.data.get("id")).first()
            if entry is None:
                return Response({"detail": "Waitlist entry not found."}, status=404)
            status_value = request.data.get("status", entry.status)
            if status_value not in {"active", "contacted", "closed"}:
                return Response({"detail": "Invalid waitlist status."}, status=400)
            entry.status = status_value
            entry.save(update_fields=["status", "updated_at"])
            if request.data.get("send_reminder"):
                try:
                    send_account_message(EmailMultiAlternatives(
                        subject=f"VaceUp intake update: {entry.intake.title}",
                        body=f"Hello {entry.full_name},\n\nThere is an update about your {entry.preferred_course.title} waitlist request for {entry.intake.title}. Please reply to this email if you need help.\n\nVaceUp",
                        to=[entry.email],
                    ))
                except Exception:
                    pass
            return Response(WaitlistEntrySerializer(entry).data)
        rows = IntakeWaitlistEntry.objects.select_related("intake", "preferred_course").order_by("-created_at")
        if request.query_params.get("intake"):
            rows = rows.filter(intake_id=request.query_params["intake"])
        page = self.paginate_queryset(rows)
        if page is not None:
            return self.get_paginated_response(WaitlistEntrySerializer(page, many=True).data)
        return Response(WaitlistEntrySerializer(rows, many=True).data)


class WaitlistEntrySerializer(serializers.ModelSerializer):
    intake_title = serializers.CharField(source="intake.title", read_only=True)
    course_title = serializers.CharField(source="preferred_course.title", read_only=True)

    class Meta:
        model = IntakeWaitlistEntry
        fields = ("id", "intake", "intake_title", "full_name", "email", "phone", "preferred_course", "course_title", "status", "created_at")
        read_only_fields = ("id", "intake_title", "course_title", "status", "created_at")
