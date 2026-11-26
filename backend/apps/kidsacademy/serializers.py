from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.courses.models import Course
from apps.website.models import AcademyIntake

from .models import KidsAdmission, KidsEnrollment, KidsLearner, KidsParentProfile


class KidsParentSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = KidsParentProfile
        fields = ("id", "email", "full_name", "phone", "relationship", "consent_status", "consented_at")
        read_only_fields = ("id", "email", "full_name", "consent_status", "consented_at")


class KidsRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False, style={"input_type": "password"})
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    relationship = serializers.CharField(max_length=80, required=False, allow_blank=True)

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class KidsLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False, style={"input_type": "password"})


class KidsLearnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = KidsLearner
        fields = ("id", "full_name", "preferred_name", "date_of_birth", "status", "created_at")
        read_only_fields = ("id", "status", "created_at")


class KidsProgramSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="category.name", read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = (
            "id", "slug", "title", "description", "tagline", "learning_outcomes",
            "target_audience", "duration", "level", "price", "image", "category",
        )

    def get_image(self, obj):
        if obj.thumbnail:
            try:
                url = obj.thumbnail.url
            except ValueError:
                return obj.image_url or ""
            request = self.context.get("request")
            return request.build_absolute_uri(url) if request and url.startswith("/") else url
        return obj.image_url or ""


class KidsAdmissionSerializer(serializers.ModelSerializer):
    learner_name = serializers.CharField(source="learner.full_name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    intake_title = serializers.CharField(source="intake.title", read_only=True, default="")

    class Meta:
        model = KidsAdmission
        fields = (
            "id", "learner", "learner_name", "course", "course_title", "intake", "intake_title",
            "payment_preference", "status", "parent_note", "created_at", "reviewed_at",
        )
        read_only_fields = ("id", "course_title", "intake_title", "status", "created_at", "reviewed_at")

    def validate_course(self, value):
        if not value.is_published or value.category.name.lower() != "kids tech academy":
            raise serializers.ValidationError("Choose a published Kids Academy programme.")
        return value

    def validate_intake(self, value):
        if value is not None and (value.is_archived or not value.is_active):
            raise serializers.ValidationError("Choose an active admission period.")
        return value


class KidsEnrollmentSerializer(serializers.ModelSerializer):
    learner_name = serializers.CharField(source="learner.full_name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = KidsEnrollment
        fields = (
            "id", "learner", "learner_name", "course", "course_title", "status",
            "current_stage", "progress_percent", "started_at", "completed_at",
        )
        read_only_fields = fields
