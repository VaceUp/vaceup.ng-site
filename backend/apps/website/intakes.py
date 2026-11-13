"""One source for the next advertised intake and administrator scheduling."""
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.permissions import IsAdmin
from apps.courses.models import Course
from apps.website.models import AcademyIntake


def upcoming_intakes(course_slug=None, today=None):
    rows = AcademyIntake.objects.filter(
        is_active=True, is_archived=False, starts_on__gte=today or timezone.localdate(),
    )
    if course_slug:
        rows = rows.filter(Q(all_courses=True) | Q(courses__slug=course_slug, courses__is_published=True))
    return rows.distinct().prefetch_related("courses").order_by("starts_on", "pk")


class IntakeSerializer(serializers.ModelSerializer):
    courses = serializers.PrimaryKeyRelatedField(many=True, queryset=Course.objects.all(), required=False)
    available_courses = serializers.SerializerMethodField()

    class Meta:
        model = AcademyIntake
        fields = (
            "id", "title", "starts_on", "ends_on", "is_active", "is_archived",
            "all_courses", "courses", "available_courses", "registration_url",
        )

    def get_available_courses(self, obj):
        rows = Course.objects.filter(is_published=True) if obj.all_courses else obj.courses.filter(is_published=True)
        return list(rows.values("id", "slug", "title"))

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
        fields = ("id", "title", "starts_on", "ends_on", "available_courses", "registration_url")


class IntakeViewSet(viewsets.ModelViewSet):
    queryset = AcademyIntake.objects.prefetch_related("courses").all()
    serializer_class = IntakeSerializer
    permission_classes = [IsAdmin]

    def get_permissions(self):
        return [AllowAny()] if self.action in ("list", "retrieve", "next_intake") and not self._admin() else [IsAdmin()]

    def _admin(self):
        user = self.request.user
        return bool(user and user.is_authenticated and user.is_admin)

    def get_queryset(self):
        if self._admin():
            return super().get_queryset()
        return upcoming_intakes(self.request.query_params.get("course"))

    def get_serializer_class(self):
        return IntakeSerializer if self._admin() else PublicIntakeSerializer

    @action(detail=False, methods=["get"], url_path="next")
    def next_intake(self, request):
        row = upcoming_intakes(request.query_params.get("course")).first()
        return Response({"intake": PublicIntakeSerializer(row).data if row else None})
