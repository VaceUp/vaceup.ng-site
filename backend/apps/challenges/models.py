"""Independent challenge identities; participation never grants LMS access."""
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class ChallengeRound(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        OPEN = "open", "Published round"
        CLOSED = "closed", "Submissions closed"
        FROZEN = "frozen", "Scorebook frozen"
        PUBLISHED = "published", "Results published"

    class Mode(models.TextChoices):
        HYBRID = "hybrid", "Project quality and engagement"
        QUALITY_ONLY = "quality_only", "Project quality only"

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.QUALITY_ONLY)
    hashtag = models.CharField(max_length=100, blank=True)
    linkedin_handle = models.CharField(max_length=200, blank=True)
    instagram_handle = models.CharField(max_length=200, blank=True)
    rules = models.TextField(blank=True)
    rules_version = models.PositiveIntegerField(default=1)
    registration_opens_at = models.DateTimeField()
    registration_closes_at = models.DateTimeField()
    submission_closes_at = models.DateTimeField()
    final_collection_starts_at = models.DateTimeField()
    final_collection_ends_at = models.DateTimeField()
    results_publish_at = models.DateTimeField()
    likes_target = models.PositiveIntegerField(null=True, blank=True)
    comments_target = models.PositiveIntegerField(null=True, blank=True)
    published_rules = models.JSONField(default=dict, blank=True)
    frozen_scorebook = models.JSONField(default=list, blank=True)
    scorebook_version = models.PositiveIntegerField(default=0)
    frozen_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-registration_opens_at",)

    def __str__(self):
        return self.title

    @property
    def registration_open(self):
        return self.status == self.Status.OPEN and self.registration_opens_at <= timezone.now() <= self.registration_closes_at


class RoundCategory(TimeStampedModel):
    round = models.ForeignKey(ChallengeRound, on_delete=models.CASCADE, related_name="categories")
    slug = models.SlugField(max_length=80)
    name = models.CharField(max_length=120)
    brief = models.TextField(blank=True)
    email_instructions = models.TextField(blank=True)
    brief_pdf_key = models.CharField(max_length=500, blank=True)
    requirements = models.JSONField(default=list, blank=True)
    rubric = models.JSONField(default=list, blank=True)
    rubric_version = models.PositiveIntegerField(default=1)
    enabled = models.BooleanField(default=True)
    winner_count = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    class Meta:
        ordering = ("name",)
        constraints = [models.UniqueConstraint(fields=["round", "slug"], name="challenge_round_category_slug")]

    def __str__(self):
        return f"{self.round}: {self.name}"


class ChallengeRegistration(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    round = models.ForeignKey(ChallengeRound, on_delete=models.PROTECT, related_name="registrations")
    category = models.ForeignKey(RoundCategory, on_delete=models.PROTECT, related_name="registrations")
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=40)
    accept_rules = models.BooleanField(default=False)
    make_public = models.BooleanField(default=False)
    accepted_rules_version = models.PositiveIntegerField(default=1)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    access_version = models.PositiveIntegerField(default=1)
    disqualified = models.BooleanField(default=False)
    disqualification_reason = models.TextField(blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["round", "email"], name="challenge_round_email")]
        ordering = ("created_at",)


class ParticipantToken(TimeStampedModel):
    registration = models.ForeignKey(ChallengeRegistration, on_delete=models.CASCADE, related_name="tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    kind = models.CharField(max_length=12, choices=[("verify", "Verification"), ("session", "Session")])
    access_version = models.PositiveIntegerField()
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)


class EvidenceAsset(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registration = models.ForeignKey(ChallengeRegistration, on_delete=models.CASCADE, related_name="assets")
    kind = models.CharField(max_length=20, choices=[("project", "Project"), ("engagement", "Public engagement evidence")])
    name = models.CharField(max_length=200)
    key = models.CharField(max_length=500, unique=True)
    content_type = models.CharField(max_length=120)
    size_bytes = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=20, choices=[("uploading", "Uploading"), ("ready", "Verified upload")], default="uploading")
    uploaded_at = models.DateTimeField(null=True, blank=True)


class BriefDocument(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(RoundCategory, on_delete=models.CASCADE, related_name="brief_documents")
    name = models.CharField(max_length=200)
    key = models.CharField(max_length=500, unique=True)
    content_type = models.CharField(max_length=120, default="application/pdf")
    size_bytes = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=20, default="uploading")
    uploaded_at = models.DateTimeField(null=True, blank=True)


class ChallengeSubmission(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registration = models.ForeignKey(ChallengeRegistration, on_delete=models.CASCADE, related_name="submissions")
    revision = models.PositiveIntegerField()
    platform = models.CharField(max_length=20, choices=[("linkedin", "LinkedIn"), ("instagram", "Instagram")])
    post_url = models.URLField(max_length=1000)
    canonical_post_id = models.CharField(max_length=250)
    explanation = models.TextField()
    checklist_confirmed = models.BooleanField(default=False)
    evidence = models.ManyToManyField(EvidenceAsset, related_name="submissions")
    status = models.CharField(max_length=24, default="submitted")
    accepted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-revision",)
        constraints = [models.UniqueConstraint(fields=["registration", "revision"], name="challenge_submission_revision")]


class SocialPostClaim(TimeStampedModel):
    round = models.ForeignKey(ChallengeRound, on_delete=models.CASCADE)
    canonical_post_id = models.CharField(max_length=250)
    registration = models.ForeignKey(ChallengeRegistration, on_delete=models.CASCADE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["round", "canonical_post_id"], name="challenge_unique_post_claim")]


class AssessmentRun(TimeStampedModel):
    submission = models.ForeignKey(ChallengeSubmission, on_delete=models.CASCADE, related_name="assessments")
    status = models.CharField(max_length=30, default="queued")
    input_hash = models.CharField(max_length=64, unique=True)
    prompt_hash = models.CharField(max_length=64, blank=True)
    evidence_manifest = models.JSONField(default=list, blank=True)
    criterion_scores = models.JSONField(default=list, blank=True)
    reasons = models.JSONField(default=dict, blank=True)
    flags = models.JSONField(default=list, blank=True)
    quality_points = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    model = models.CharField(max_length=160, blank=True)
    rubric_version = models.PositiveIntegerField(default=1)
    usage = models.JSONField(default=dict, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)


class EngagementSnapshot(TimeStampedModel):
    registration = models.ForeignKey(ChallengeRegistration, on_delete=models.CASCADE, related_name="engagement_snapshots")
    submission = models.ForeignKey(ChallengeSubmission, on_delete=models.CASCADE, related_name="engagement_snapshots")
    likes = models.PositiveBigIntegerField(null=True, blank=True)
    comments = models.PositiveBigIntegerField(null=True, blank=True)
    shares = models.PositiveBigIntegerField(null=True, blank=True)
    views = models.PositiveBigIntegerField(null=True, blank=True)
    declared_counts = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=30, default="participant_supplied")
    observed_at = models.DateTimeField()
    scheduled_for = models.DateTimeField(null=True, blank=True)
    evidence = models.ManyToManyField(EvidenceAsset, related_name="engagement_snapshots")
    extracted = models.JSONField(default=dict, blank=True)
    extracted_at = models.DateTimeField(null=True, blank=True)
    verification_status = models.CharField(max_length=30, default="unverified")
    flags = models.JSONField(default=list, blank=True)
    score = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)

    class Meta:
        ordering = ("-observed_at", "-pk")


class ChallengeJob(TimeStampedModel):
    registration = models.ForeignKey(ChallengeRegistration, on_delete=models.CASCADE, related_name="jobs", null=True, blank=True)
    submission = models.ForeignKey(ChallengeSubmission, on_delete=models.CASCADE, related_name="jobs", null=True, blank=True)
    round = models.ForeignKey(ChallengeRound, on_delete=models.CASCADE, related_name="jobs", null=True, blank=True)
    kind = models.CharField(max_length=40)
    dedupe_key = models.CharField(max_length=220, unique=True)
    status = models.CharField(max_length=30, default="queued")
    run_after = models.DateTimeField(default=timezone.now)
    claimed_at = models.DateTimeField(null=True, blank=True)
    lease_expires_at = models.DateTimeField(null=True, blank=True)
    claim_id = models.UUIDField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    error = models.CharField(max_length=300, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("run_after", "pk")
        indexes = [models.Index(fields=["status", "run_after"], name="challenge_job_due")]


class ChallengeBudgetDay(TimeStampedModel):
    date = models.DateField(unique=True)
    reserved_tokens = models.PositiveBigIntegerField(default=0)
    used_tokens = models.PositiveBigIntegerField(default=0)


class ScoreOverride(TimeStampedModel):
    registration = models.ForeignKey(ChallengeRegistration, on_delete=models.PROTECT, related_name="overrides")
    submission = models.ForeignKey(ChallengeSubmission, on_delete=models.PROTECT, related_name="overrides")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    reason = models.TextField()
    quality_points = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    engagement_points = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    previous = models.JSONField(default=dict)

    class Meta:
        ordering = ("-created_at", "-pk")
