"""Public challenge registration, scoped guest portal and administrator operations."""
import csv
import json
from collections.abc import Mapping
from io import BytesIO, StringIO
import uuid
from decimal import Decimal

from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import OuterRef, Subquery
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from rest_framework.views import APIView

from apps.core import storage
from apps.core.permissions import IsAdmin
from apps.core.throttling import DatabaseAnonRateThrottle
from .auth import participant, verify_token
from .models import (
    AssessmentRun, BriefDocument, ChallengeJob, ChallengeRegistration, ChallengeRound,
    ChallengeSubmission, EngagementSnapshot, EvidenceAsset, RoundCategory, ScoreOverride, SocialPostClaim,
)
from .serializers import (
    AssetSerializer, CategorySerializer, PublicRoundSerializer, RegisterSerializer, RegistrationSerializer,
    RoundSerializer, SnapshotSerializer, SubmissionSerializer, round_readiness,
)
from .uploads import complete_upload, validate_upload_name


class ChallengeAccessThrottle(DatabaseAnonRateThrottle):
    scope = "challenge_access"
    rate = "10/hour"


class PublicView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method == "POST" and not isinstance(request.data, Mapping):
            raise ValidationError("Send the form fields as a JSON object.")


def private_response(data, status=200):
    response = Response(data, status=status)
    response["Cache-Control"] = "no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


def queue_email(registration):
    ChallengeJob.objects.create(
        kind="brief_email", registration=registration, round=registration.round,
        dedupe_key=f"brief:{registration.pk}:{uuid.uuid4()}",
    )


class RegisterView(PublicView):
    throttle_classes = [ChallengeAccessThrottle]

    @transaction.atomic
    def post(self, request):
        data = RegisterSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        round = get_object_or_404(ChallengeRound.objects.select_for_update(), slug=values["round_slug"], status="open")
        if not round.registration_open:
            raise ValidationError("Registration is outside this round's published opening and closing times.")
        category = get_object_or_404(RoundCategory, pk=values["category_id"], round=round, enabled=True)
        existing = ChallengeRegistration.objects.filter(round=round, email=values["email"]).first()
        if existing:
            queue_email(existing)
        else:
            if round.registrations.count() >= getattr(settings, "CHALLENGE_MAX_REGISTRATIONS", 10000):
                raise ValidationError("This challenge has reached its registration capacity.")
            registration = ChallengeRegistration.objects.create(
                round=round, category=category, full_name=values["full_name"], email=values["email"], phone=values["phone"],
                accept_rules=True, make_public=values["make_public"], accepted_rules_version=round.rules_version,
            )
            queue_email(registration)
        return private_response({"detail": "Check your registration email for your personal challenge link and selected category brief. Existing registrations keep their original category.", "email_status": "queued"}, status=202)


class AccessView(PublicView):
    throttle_classes = [ChallengeAccessThrottle]

    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get("email")).lower()
        slug = serializers.SlugField().run_validation(request.data.get("round_slug"))
        registration = ChallengeRegistration.objects.filter(round__slug=slug, email=email).exclude(round__status="draft").first()
        if registration:
            queue_email(registration)
        return private_response({"detail": "If this email registered for the round, a personal access link has been queued for that inbox.", "email_status": "queued"}, status=202)


class VerifyView(PublicView):
    throttle_classes = [ChallengeAccessThrottle]

    def post(self, request):
        registration, token = verify_token(request.data.get("token"))
        return private_response({"access_token": token, "registration": RegistrationSerializer(registration).data})


class PortalView(PublicView):
    def get(self, request):
        registration = participant(request)
        submission = registration.submissions.prefetch_related("evidence").first()
        latest_assessment = submission.assessments.order_by("-created_at").first() if submission else None
        category_data = RegistrationSerializer(registration).data
        if registration.category.brief_pdf_key:
            category_data["category"]["brief_download_url"] = storage.presigned_download_url(registration.category.brief_pdf_key, expires=900)
        result = None
        if registration.round.status == "published":
            row = next((row for row in registration.round.frozen_scorebook if str(row.get("registration_id")) == str(registration.pk)), None)
            result = row
        return private_response({
            "registration": category_data,
            "submission": SubmissionSerializer(submission).data if submission else None,
            "assets": AssetSerializer(registration.assets.filter(status="ready"), many=True).data,
            "engagement": SnapshotSerializer(registration.engagement_snapshots.all()[:30], many=True).data,
            "assessment_status": latest_assessment.status if latest_assessment else "not_submitted" if not submission else "queued",
            "result": result,
            "email_status": registration.jobs.filter(kind="brief_email").order_by("-created_at").values("status", "error").first(),
        })


def allow_submission(registration, *, engagement=False):
    round = registration.round
    deadline = round.final_collection_ends_at if engagement else round.submission_closes_at
    if round.status not in ("open", "closed") or timezone.now() > deadline or registration.disqualified:
        raise PermissionDenied("This round is closed for this action or your entry is not eligible. Your saved work remains available in your portal.")
    if round.status == "closed" and not engagement:
        raise PermissionDenied("Project submissions have closed for this round.")


class UploadView(PublicView):
    def post(self, request):
        registration = participant(request)
        kind = serializers.ChoiceField(choices=["project", "engagement"]).run_validation(request.data.get("kind"))
        allow_submission(registration, engagement=kind == "engagement")
        from django.db.models import Sum
        quota = registration.assets.aggregate(total=Sum("size_bytes"))["total"] or 0
        if registration.assets.count() >= 100 or quota >= 1024 ** 3:
            raise ValidationError("Your entry has reached its upload limit. Contact the challenge team if you need to replace evidence.")
        name = serializers.CharField(max_length=200).run_validation(request.data.get("name"))
        content_type = serializers.CharField(max_length=120).run_validation(request.data.get("content_type"))
        size = serializers.IntegerField(min_value=1).run_validation(request.data.get("size_bytes"))
        name, extension = validate_upload_name(name, content_type, kind, size)
        asset_id = uuid.uuid4()
        key = f"private/challenges/incoming/{asset_id}{extension}"
        url = storage.presigned_upload_url(key, content_type, expires=900)
        asset = EvidenceAsset.objects.create(id=asset_id, registration=registration, kind=kind, name=name, key=key, content_type=content_type, size_bytes=size)
        return private_response({"id": str(asset.pk), "upload_url": url, "content_type": content_type}, status=201)


class UploadCompleteView(PublicView):
    def post(self, request, asset_id):
        registration = participant(request)
        asset = get_object_or_404(EvidenceAsset, pk=asset_id, registration=registration)
        allow_submission(registration, engagement=asset.kind == "engagement")
        try:
            with transaction.atomic():
                asset = EvidenceAsset.objects.select_for_update().get(pk=asset.pk)
                complete_upload(asset)
        except (BotoCoreError, ClientError):
            raise ValidationError("Storage could not verify the upload. Keep the original file and try completing it again.")
        return private_response(AssetSerializer(asset).data)


class UploadDownloadView(PublicView):
    def get(self, request, asset_id):
        registration = participant(request)
        asset = get_object_or_404(EvidenceAsset, pk=asset_id, registration=registration, status="ready")
        return private_response({"url": storage.presigned_download_url(asset.key, expires=900)})


def owned_evidence(registration, ids, kind):
    limit = 6 if kind == "project" else 10
    if not isinstance(ids, list) or not 1 <= len(ids) <= limit or len({str(value) for value in ids}) != len(ids):
        raise ValidationError("Attach between one and twelve different verified evidence files.")
    try:
        parsed = [uuid.UUID(str(value)) for value in ids]
    except (ValueError, TypeError, AttributeError):
        raise ValidationError("Evidence IDs must identify your verified uploads.")
    assets = list(EvidenceAsset.objects.filter(pk__in=parsed, registration=registration, kind=kind, status="ready"))
    if len(assets) != len(ids):
        raise PermissionDenied("Each evidence file must be one of your verified uploads for this evidence type.")
    return assets


class SubmissionView(PublicView):
    @transaction.atomic
    def post(self, request):
        registration = participant(request)
        registration = ChallengeRegistration.objects.select_for_update().select_related("round", "category").get(pk=registration.pk)
        allow_submission(registration)
        post_url = serializers.URLField(max_length=1000).run_validation(request.data.get("post_url"))
        explanation = serializers.CharField(min_length=20, max_length=20000).run_validation(request.data.get("explanation"))
        if serializers.BooleanField().run_validation(request.data.get("checklist_confirmed")) is not True:
            raise ValidationError("Confirm that this is your own public post, includes the required VaceUp tag, hashtag and presentation video, and will remain public through the announcement.")
        from .engagement import canonicalize_post_url
        try:
            platform, post_id, url = canonicalize_post_url(post_url)
        except ValueError as error:
            raise ValidationError(str(error))
        assets = owned_evidence(registration, request.data.get("evidence_ids"), "project")
        claim, _ = SocialPostClaim.objects.get_or_create(round=registration.round, canonical_post_id=post_id, defaults={"registration": registration})
        if claim.registration_id != registration.pk:
            raise ValidationError("This social post is already associated with another entry in this round.")
        previous = registration.submissions.first()
        submission = ChallengeSubmission.objects.create(
            registration=registration, revision=previous.revision + 1 if previous else 1,
            platform=platform, canonical_post_id=post_id, post_url=url, explanation=explanation,
            checklist_confirmed=True,
        )
        submission.evidence.set(assets)
        ChallengeJob.objects.create(kind="quality_assessment", registration=registration, submission=submission, round=registration.round, dedupe_key=f"quality:{submission.pk}")
        return private_response(SubmissionSerializer(submission).data, status=201)


class EngagementView(PublicView):
    @transaction.atomic
    def post(self, request):
        registration = participant(request)
        allow_submission(registration, engagement=True)
        submission = registration.submissions.first()
        if submission is None:
            raise ValidationError("Submit your project and public social post before adding engagement evidence.")
        from .engagement import parse_counts
        try:
            counts = parse_counts({key: request.data.get(key) for key in ("likes", "comments", "shares", "views")})
        except ValueError as error:
            raise ValidationError(str(error))
        observed = serializers.DateTimeField().run_validation(request.data.get("observed_at", timezone.now().isoformat()))
        if observed > timezone.now() + timezone.timedelta(minutes=5):
            raise ValidationError("The observation time cannot be in the future.")
        assets = owned_evidence(registration, request.data.get("evidence_ids"), "engagement")
        now = timezone.now()
        round = registration.round
        if round.final_collection_starts_at <= now <= round.final_collection_ends_at:
            if any(not asset.uploaded_at or not round.final_collection_starts_at <= asset.uploaded_at <= round.final_collection_ends_at for asset in assets):
                raise ValidationError("Final engagement evidence must be newly uploaded during this round's final collection window. Upload a fresh screenshot or count export before submitting it.")
        snapshot = EngagementSnapshot.objects.create(
            registration=registration, submission=submission, declared_counts=counts,
            observed_at=observed, source="participant_supplied", verification_status="unverified",
            flags=["Participant-provided evidence; social account analytics and authenticity are not independently verified."],
        )
        snapshot.evidence.set(assets)
        ChallengeJob.objects.create(kind="engagement_extract", registration=registration, submission=submission, round=registration.round, dedupe_key=f"engagement:{snapshot.pk}", metadata={"snapshot_id": snapshot.pk})
        return private_response(SnapshotSerializer(snapshot).data, status=201)


class PublicRoundViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PublicRoundSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return ChallengeRound.objects.exclude(status="draft").prefetch_related("categories")

    @action(detail=True, methods=["get"])
    def results(self, request, slug=None):
        round = self.get_object()
        if round.status != "published":
            return private_response({"status": "not_published", "results": []})
        public_ids = set(str(pk) for pk in round.registrations.filter(make_public=True).values_list("pk", flat=True))
        return Response({"round": round.title, "results": [{key: row.get(key) for key in ("name", "category", "rank", "winner", "total")} for row in round.frozen_scorebook if str(row.get("registration_id")) in public_ids and row.get("winner")]})


class AdminRoundViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = RoundSerializer
    queryset = ChallengeRound.objects.prefetch_related("categories").all()
    lookup_field = "slug"

    def get_renderers(self):
        if getattr(self, "action", None) == "export":
            class CSVRenderer(JSONRenderer):
                format, media_type = "csv", "text/csv"
            class XLSXRenderer(JSONRenderer):
                format, media_type = "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            return [JSONRenderer(), CSVRenderer(), XLSXRenderer()]
        return super().get_renderers()

    def perform_destroy(self, instance):
        if instance.status != "draft" or instance.registrations.exists():
            raise PermissionDenied("Only an unused draft round can be deleted. Existing participation history is retained.")
        instance.delete()

    @action(detail=True, methods=["get"])
    def readiness(self, request, slug=None):
        errors = round_readiness(self.get_object())
        return Response({"ready": not errors, "errors": errors})

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def clone(self, request, slug=None):
        source = self.get_object()
        values = dict(RoundSerializer(source).data)
        for key in ("id", "status", "categories", "registration_open", "rules_version", "scorebook_version", "published_at"):
            values.pop(key, None)
        # Reusing a round always requires an explicit new identity. Published status,
        # registrations, evidence, results and jobs are never copied.
        values["title"] = serializers.CharField(max_length=200).run_validation(request.data.get("title"))
        values["slug"] = serializers.SlugField(max_length=220).run_validation(request.data.get("slug"))
        values.update({key: value for key, value in request.data.items() if key in values})
        serializer = RoundSerializer(data=values)
        serializer.is_valid(raise_exception=True)
        target = serializer.save()
        for category in source.categories.all():
            RoundCategory.objects.create(round=target, slug=category.slug, name=category.name,
                brief=category.brief, email_instructions=category.email_instructions,
                brief_pdf_key=category.brief_pdf_key, requirements=category.requirements,
                rubric=category.rubric, enabled=category.enabled, winner_count=category.winner_count)
        return private_response(RoundSerializer(target).data, status=201)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def open(self, request, slug=None):
        round = ChallengeRound.objects.select_for_update().get(pk=self.get_object().pk)
        if round.status != "draft":
            raise ValidationError("Only a draft round can be opened.")
        errors = round_readiness(round)
        if errors:
            raise ValidationError({"readiness": errors})
        round.status = "open"
        round.published_rules = dict(RoundSerializer(round).data)
        from . import assessment
        round.published_rules.update({
            "assessment_model": str(getattr(settings, "CHALLENGE_GROQ_MODEL", "") or "").strip(),
            "assessment_prompt_hash": assessment._hash({"system": assessment.SYSTEM_PROMPT, "schema": assessment.grade_schema()}),
            "assessment_pipeline_version": assessment.PIPELINE_VERSION,
        })
        round.save(update_fields=["status", "published_rules", "updated_at"])
        return Response(RoundSerializer(round).data)

    @action(detail=True, methods=["post"])
    def close(self, request, slug=None):
        round = self.get_object()
        if round.status != "open":
            raise ValidationError("Only an open round can close project submissions.")
        round.status = "closed"
        round.save(update_fields=["status", "updated_at"])
        return Response(RoundSerializer(round).data)

    @action(detail=True, methods=["get"])
    def registrations(self, request, slug=None):
        round = self.get_object()
        query = round.registrations.select_related("category", "round")
        if request.query_params.get("category"):
            query = query.filter(category_id=request.query_params["category"])
        return private_response(RegistrationSerializer(query, many=True).data)

    def _scorebook(self, round):
        from .assessment import compute_scorebook
        rows = round.frozen_scorebook if round.status in ("frozen", "published") else compute_scorebook(round)
        return rows

    @action(detail=True, methods=["get"])
    def scorebook(self, request, slug=None):
        round = self.get_object()
        rows = self._scorebook(round)
        # Enrich only the administrator response. Frozen ranking inputs remain immutable.
        newest_snapshot = EngagementSnapshot.objects.filter(registration_id=OuterRef("pk")).order_by("-observed_at", "-pk").values("pk")[:1]
        participants = {str(reg.pk): reg for reg in round.registrations.select_related("category").annotate(latest_snapshot_id=Subquery(newest_snapshot))}
        submission_ids = {row["submission_id"] for row in rows if row.get("submission_id")}
        submissions = {str(item.pk): item for item in ChallengeSubmission.objects.filter(pk__in=submission_ids).prefetch_related("evidence", "assessments").iterator(chunk_size=400)}
        snapshot_ids = {row["engagement_snapshot_id"] for row in rows if row.get("engagement_snapshot_id")}
        snapshot_ids.update(reg.latest_snapshot_id for reg in participants.values() if reg.latest_snapshot_id)
        snapshots = {item.pk: item for item in EngagementSnapshot.objects.filter(pk__in=snapshot_ids).prefetch_related("evidence").iterator(chunk_size=400)}
        output = []
        for row in rows:
            reg = participants.get(str(row.get("registration_id")))
            item = dict(row)
            if reg:
                latest = submissions.get(str(row.get("submission_id")))
                item.update({"email": reg.email, "phone": reg.phone, "submission": SubmissionSerializer(latest).data if latest else None})
                snapshot = snapshots.get(row.get("engagement_snapshot_id") or reg.latest_snapshot_id)
                item["engagement"] = SnapshotSerializer(snapshot).data if snapshot else None
                if latest:
                    runs = list(latest.assessments.all())
                    run = next((item for item in runs if item.pk == row.get("assessment_id")), None) if row.get("assessment_id") else max(runs, key=lambda item: (item.created_at, item.pk), default=None)
                    item["assessment"] = {"status": run.status, "criterion_scores": run.criterion_scores, "reasons": run.reasons, "flags": run.flags, "model": run.model} if run else None
            output.append(item)
        return private_response({"round": RoundSerializer(round).data, "rows": output, "frozen": round.status in ("frozen", "published")})

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def overrides(self, request, slug=None):
        round = ChallengeRound.objects.select_for_update().get(pk=self.get_object().pk)
        if round.status in ("frozen", "published"):
            raise ValidationError("The frozen scorebook cannot be edited. Preserve the published result and use an audited correction process.")
        reg_id = serializers.UUIDField().run_validation(request.data.get("registration_id"))
        registration = get_object_or_404(ChallengeRegistration, pk=reg_id, round=round)
        submission = registration.submissions.first()
        if not submission:
            raise ValidationError("There is no submitted project to correct.")
        reason = serializers.CharField(min_length=10, max_length=5000).run_validation(request.data.get("reason"))
        quality = serializers.DecimalField(max_digits=8, decimal_places=4, min_value=0, max_value=100, required=False).run_validation(request.data["quality_points"]) if "quality_points" in request.data else None
        engagement = serializers.DecimalField(max_digits=8, decimal_places=4, min_value=0, max_value=20, required=False).run_validation(request.data["engagement_points"]) if "engagement_points" in request.data else None
        if round.mode == "quality_only" and engagement is not None:
            raise ValidationError("Engagement is not scored in this round's published quality-only mode.")
        previous = next((row for row in self._scorebook(round) if str(row.get("registration_id")) == str(registration.pk)), {})
        if "disqualified" in request.data:
            registration.disqualified = serializers.BooleanField().run_validation(request.data["disqualified"])
            registration.disqualification_reason = reason if registration.disqualified else ""
            registration.save(update_fields=["disqualified", "disqualification_reason", "updated_at"])
        elif quality is None and engagement is None:
            raise ValidationError("Enter a corrected score or an eligibility decision.")
        row = ScoreOverride.objects.create(registration=registration, submission=submission, actor=request.user, reason=reason, quality_points=quality, engagement_points=engagement, previous=previous)
        return private_response({"id": row.pk, "detail": "Correction recorded with its original values and reason."}, status=201)

    @action(detail=True, methods=["post"])
    def freeze(self, request, slug=None):
        from .assessment import freeze_round
        if request.data.get("approved") is not True:
            raise ValidationError("Review the final scorebook, finalists and exceptions, then explicitly approve the freeze.")
        try:
            round = freeze_round(self.get_object(), request.user)
        except DjangoValidationError as error:
            raise ValidationError(error.messages)
        return private_response({"round": RoundSerializer(round).data, "rows": round.frozen_scorebook})

    @action(detail=True, methods=["post"])
    def publish(self, request, slug=None):
        from .assessment import publish_round
        if request.data.get("approved") is not True:
            raise ValidationError("Review the frozen results and explicitly approve publication.")
        try:
            round = publish_round(self.get_object(), request.user)
        except DjangoValidationError as error:
            raise ValidationError(error.messages)
        return private_response(RoundSerializer(round).data)

    @action(detail=True, methods=["get"])
    def jobs(self, request, slug=None):
        query = self.get_object().jobs.order_by("-created_at")
        counts = {}
        from django.db.models import Count
        for item in query.values("status").annotate(count=Count("pk")):
            counts[item["status"]] = item["count"]
        return private_response({"counts": counts, "jobs": list(query.values("id", "kind", "status", "attempts", "error", "run_after", "completed_at")[:100])})

    @action(detail=True, methods=["get"])
    def export(self, request, slug=None):
        round = self.get_object()
        rows = self._scorebook(round)
        columns = ["round_slug", "scoring_mode", "round_status", "rules_version", "scorebook_version", "published_at", "category", "name", "registration_id", "email", "phone", "submission_id", "revision", "post_url", "quality_points", "engagement_points", "total", "rank", "status", "winner", "eligible", "likes", "comments", "shares", "views", "engagement_source", "observed_at", "received_at", "engagement_snapshot_id", "assessment_id", "assessment_model", "rubric_version", "criterion_scores", "flags"]
        participants = {str(reg.pk): reg for reg in round.registrations.all()}
        export_rows = []
        for row in rows:
            values = dict(row)
            registration = participants.get(str(row.get("registration_id")))
            submission = registration.submissions.filter(pk=row.get("submission_id")).first() if registration and row.get("submission_id") else None
            values.update(round_slug=round.slug, scoring_mode=round.mode, round_status=round.status,
                          rules_version=round.rules_version, scorebook_version=round.scorebook_version,
                          published_at=round.published_at.isoformat() if round.published_at else "",
                          email=registration.email if registration else "", phone=registration.phone if registration else "",
                          post_url=submission.post_url if submission else "", eligible=row.get("status") == "ranked")
            values["assessment_model"] = row.get("model", "")
            for key in ("quality_points", "engagement_points", "total"):
                if values.get(key) is not None:
                    values[key] = float(Decimal(str(values[key])))
            for key in ("criterion_scores", "flags"):
                values[key] = json.dumps(values.get(key, []), ensure_ascii=False)
            export_rows.append([safe_cell(values.get(key, "")) for key in columns])
        if request.query_params.get("format") == "xlsx":
            from openpyxl import Workbook
            workbook = Workbook(write_only=True)
            sheet = workbook.create_sheet("Scorebook")
            sheet.append(columns)
            for row in export_rows:
                sheet.append(row)
            metadata = workbook.create_sheet("Read me")
            for row in [("Round", round.title), ("Scoring mode", round.mode), ("Status", round.status),
                        ("Rules version", round.rules_version), ("Scorebook version", round.scorebook_version),
                        ("Exported at", timezone.now().isoformat()), ("Timezone", "Africa/Lagos; exported timestamps include UTC offset"),
                        ("Quality", "Raw project quality is out of 100. Hybrid total uses quality * 0.8 plus engagement out of 20."),
                        ("Engagement source", "Participant-supplied screenshots and exports are labelled; counts do not prove ownership or authenticity."),
                        ("Source of truth", "Frozen rankings are immutable. CSV/XLSX are administrator copies of the scorebook.")]:
                metadata.append([safe_cell(value) for value in row])
            output = BytesIO()
            workbook.save(output)
            response = HttpResponse(output.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            extension = "xlsx"
        else:
            output = StringIO()
            writer = csv.writer(output)
            writer.writerow(columns)
            writer.writerows(export_rows)
            response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
            extension = "csv"
        response["Content-Disposition"] = f'attachment; filename="{round.slug}-scorebook.{extension}"'
        response["Cache-Control"] = "no-store"
        return response


def safe_cell(value):
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


class AdminCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = CategorySerializer
    queryset = RoundCategory.objects.select_related("round").all()

    def perform_destroy(self, instance):
        if instance.round.status != "draft" or instance.registrations.exists():
            raise PermissionDenied("Published or used categories cannot be deleted.")
        instance.delete()

    @action(detail=True, methods=["post"], url_path="upload-brief")
    def upload_brief(self, request, pk=None):
        category = self.get_object()
        if category.round.status != "draft":
            raise ValidationError("Published briefs are locked for this round.")
        name = serializers.CharField(max_length=200).run_validation(request.data.get("name"))
        content_type = serializers.ChoiceField(choices=["application/pdf"]).run_validation(request.data.get("content_type"))
        size = serializers.IntegerField(min_value=1, max_value=10 * 1024 ** 2).run_validation(request.data.get("size_bytes"))
        name, extension = validate_upload_name(name, content_type, "project", size)
        asset_id = uuid.uuid4()
        key = f"private/challenges/incoming/brief-{asset_id}{extension}"
        url = storage.presigned_upload_url(key, content_type, expires=900)
        asset = BriefDocument.objects.create(id=asset_id, category=category, name=name, key=key, content_type=content_type, size_bytes=size)
        return private_response({"id": str(asset.pk), "upload_url": url, "content_type": content_type}, status=201)

    @action(detail=True, methods=["post"], url_path="complete-brief")
    @transaction.atomic
    def complete_brief(self, request, pk=None):
        category = self.get_object()
        if category.round.status != "draft":
            raise ValidationError("Published briefs are locked for this round.")
        asset_id = serializers.UUIDField().run_validation(request.data.get("id"))
        asset = get_object_or_404(BriefDocument.objects.select_for_update(), pk=asset_id, category=category)
        try:
            complete_upload(asset)
        except (BotoCoreError, ClientError):
            raise ValidationError("Storage could not verify the PDF. Retry completing the upload.")
        category.brief_pdf_key = asset.key
        category.save(update_fields=["brief_pdf_key", "updated_at"])
        return private_response(CategorySerializer(category).data)


class AdminAssetDownloadView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, asset_id):
        asset = get_object_or_404(EvidenceAsset, pk=asset_id, status="ready")
        return private_response({"url": storage.presigned_download_url(asset.key, expires=900)})
