"""Validation and deliberate separation of public, participant and admin data."""
from decimal import Decimal, InvalidOperation
import re

from django.utils import timezone
from rest_framework import serializers

from .models import ChallengeRound, RoundCategory, ChallengeRegistration, ChallengeSubmission, EvidenceAsset, EngagementSnapshot

LOCKED_ROUND_FIELDS = {
    "mode", "rules", "hashtag", "linkedin_handle", "instagram_handle", "likes_target", "comments_target",
    "registration_opens_at", "registration_closes_at", "submission_closes_at",
    "final_collection_starts_at", "final_collection_ends_at", "results_publish_at",
}


def validate_rubric(value):
    if not isinstance(value, list) or not value or len(value) > 20:
        raise serializers.ValidationError("Add a list of category-specific criteria totaling 100 points.")
    seen, total = set(), Decimal(0)
    for criterion in value:
        if not isinstance(criterion, dict) or not re.fullmatch(r"[a-z][a-z0-9_]{0,49}", str(criterion.get("id", ""))):
            raise serializers.ValidationError("Each criterion needs a unique lowercase id, label, description and max_points.")
        if criterion["id"] in seen or not str(criterion.get("label", "")).strip() or not str(criterion.get("description", "")).strip():
            raise serializers.ValidationError("Give every criterion a unique id and a real label and scoring description.")
        try:
            points = Decimal(str(criterion.get("max_points", "")))
            if not points.is_finite() or points <= 0 or points > 100:
                raise InvalidOperation()
        except (InvalidOperation, ValueError, TypeError):
            raise serializers.ValidationError("Criterion max_points must be a positive number up to 100.")
        total += points
        seen.add(criterion["id"])
    if total != 100:
        raise serializers.ValidationError("The category rubric must total exactly 100 points.")
    return value


class CategorySerializer(serializers.ModelSerializer):
    brief_pdf_available = serializers.SerializerMethodField()

    class Meta:
        model = RoundCategory
        fields = ("id", "round", "slug", "name", "brief", "email_instructions", "requirements", "rubric", "rubric_version", "enabled", "winner_count", "brief_pdf_available")
        read_only_fields = ("rubric_version",)

    def get_brief_pdf_available(self, obj):
        return bool(obj.brief_pdf_key)

    def validate_requirements(self, value):
        if not isinstance(value, list) or len(value) > 30 or any(not isinstance(item, str) or not item.strip() or len(item) > 2000 for item in value):
            raise serializers.ValidationError("Use a list of clear deliverable descriptions.")
        return value

    def validate_rubric(self, value):
        return validate_rubric(value) if value else value

    def validate(self, attrs):
        round = attrs.get("round", self.instance.round if self.instance else None)
        if self.instance and "round" in attrs and attrs["round"].pk != self.instance.round_id:
            raise serializers.ValidationError("Categories cannot be moved between rounds.")
        if round and round.status != "draft":
            locked = set(attrs) - {"email_instructions"}
            if not self.instance or any(getattr(self.instance, key) != attrs[key] for key in locked):
                raise serializers.ValidationError("Published category requirements and rubrics are locked. Clone a new round to change them.")
        return attrs


class RoundSerializer(serializers.ModelSerializer):
    categories = CategorySerializer(many=True, read_only=True)
    registration_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = ChallengeRound
        fields = ("id", "title", "slug", "description", "status", "mode", "hashtag", "linkedin_handle", "instagram_handle", "rules", "rules_version", "registration_opens_at", "registration_closes_at", "submission_closes_at", "final_collection_starts_at", "final_collection_ends_at", "results_publish_at", "likes_target", "comments_target", "categories", "registration_open", "scorebook_version", "published_at")
        read_only_fields = ("status", "rules_version", "scorebook_version", "published_at")

    def validate(self, attrs):
        if self.instance and self.instance.status != "draft":
            for key in LOCKED_ROUND_FIELDS & set(attrs):
                if attrs[key] != getattr(self.instance, key):
                    raise serializers.ValidationError({key: "Published scoring rules and dates are locked for this round."})
        dates = [attrs.get(key, getattr(self.instance, key, None)) for key in ("registration_opens_at", "registration_closes_at", "submission_closes_at", "final_collection_starts_at", "final_collection_ends_at", "results_publish_at")]
        if all(dates) and dates != sorted(dates):
            raise serializers.ValidationError("Registration, submission, collection and result dates must be in chronological order.")
        return attrs


def round_readiness(round):
    errors = []
    from django.conf import settings
    from .assessment import AssessmentUnavailable, require_configuration
    try:
        require_configuration()
    except AssessmentUnavailable:
        errors.append("Configure and enable the assessment provider before opening registration.")
    if not getattr(settings, "CHALLENGE_ASSESSMENT_CALIBRATED", False):
        errors.append("Complete the representative assessment and capacity review before opening registration.")
    if not round.rules.strip() or not round.hashtag.strip() or not round.linkedin_handle.strip() or not round.instagram_handle.strip():
        errors.append("Publish the rules, hashtag and official LinkedIn and Instagram handles first.")
    categories = list(round.categories.filter(enabled=True))
    if not categories:
        errors.append("Enable at least one category.")
    for category in categories:
        if not category.brief.strip() or not category.requirements:
            errors.append(f"{category.name}: add the actual brief and required deliverables.")
        try:
            validate_rubric(category.rubric)
        except serializers.ValidationError:
            errors.append(f"{category.name}: add the complete category-specific rubric totaling 100 points.")
    if round.mode == "hybrid" and (not round.likes_target or not round.comments_target):
        errors.append("Set positive, published likes and comments targets before opening hybrid scoring.")
    if round.registration_closes_at <= timezone.now():
        errors.append("Registration has already closed. Create a round with current dates instead of opening a past round.")
    return errors


class RegisterSerializer(serializers.Serializer):
    round_slug = serializers.SlugField()
    category_id = serializers.IntegerField(min_value=1)
    full_name = serializers.CharField(max_length=150, min_length=2)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=40, min_length=5)
    accept_rules = serializers.BooleanField()
    make_public = serializers.BooleanField(default=False)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_accept_rules(self, value):
        if value is not True:
            raise serializers.ValidationError("Read and accept the published challenge rules before registering.")
        return value


class PublicRoundSerializer(RoundSerializer):
    categories = serializers.SerializerMethodField()

    def get_categories(self, obj):
        return [{"id": category.pk, "slug": category.slug, "name": category.name,
                 "rubric": category.rubric, "enabled": category.enabled} for category in obj.categories.filter(enabled=True)]


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenceAsset
        fields = ("id", "kind", "name", "content_type", "size_bytes", "status", "sha256", "uploaded_at", "created_at")


class SubmissionSerializer(serializers.ModelSerializer):
    evidence = AssetSerializer(many=True, read_only=True)

    class Meta:
        model = ChallengeSubmission
        fields = ("id", "revision", "platform", "post_url", "explanation", "checklist_confirmed", "status", "accepted_at", "evidence")


class SnapshotSerializer(serializers.ModelSerializer):
    evidence = AssetSerializer(many=True, read_only=True)

    class Meta:
        model = EngagementSnapshot
        fields = ("id", "declared_counts", "likes", "comments", "shares", "views", "source", "observed_at", "scheduled_for", "verification_status", "flags", "evidence", "created_at")


class RegistrationSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    round = PublicRoundSerializer(read_only=True)
    email_verified = serializers.SerializerMethodField()

    class Meta:
        model = ChallengeRegistration
        fields = ("id", "full_name", "email", "phone", "category", "round", "email_verified", "make_public", "created_at")

    def get_email_verified(self, obj):
        return obj.email_verified_at is not None
