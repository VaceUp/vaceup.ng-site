from datetime import timedelta
import io
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.challenges import assessment, jobs
from apps.challenges.models import AssessmentRun, ChallengeBudgetDay, ChallengeJob, EngagementSnapshot, EvidenceAsset
from apps.challenges.tests.test_assessment import FixtureMixin


@override_settings(CHALLENGE_AI_ENABLED=True, GROQ_API_KEY="fake-test-key", CHALLENGE_GROQ_MODEL="qwen/qwen3.8-27b", CHALLENGE_AI_DAILY_TOKEN_LIMIT=180000, CHALLENGE_AI_MAX_OUTPUT_TOKENS=1200, CHALLENGE_AI_TIMEOUT_SECONDS=5)
class JobTests(FixtureMixin, TestCase):
    def test_public_refresh_is_twenty_four_hours_and_final_refresh_is_separate(self):
        start = self.now.replace(hour=23, minute=59, second=0, microsecond=0)
        self.round.status = "open"
        self.round.final_collection_starts_at = start + timedelta(days=10)
        self.round.final_collection_ends_at = start + timedelta(days=10, hours=2)
        self.round.save()
        self.submission.accepted_at = start
        self.submission.save()
        with patch("apps.challenges.jobs.timezone.now", return_value=start + timedelta(seconds=1)):
            self.assertEqual(jobs.enqueue_due(), 1)
        with patch("apps.challenges.jobs.timezone.now", return_value=start + timedelta(minutes=2)):
            self.assertEqual(jobs.enqueue_due(), 0)
        with patch("apps.challenges.jobs.timezone.now", return_value=start + timedelta(days=1)):
            self.assertEqual(jobs.enqueue_due(), 1)
        with patch("apps.challenges.jobs.timezone.now", return_value=self.round.final_collection_starts_at + timedelta(minutes=1)):
            self.assertEqual(jobs.enqueue_due(), 1)
            self.assertEqual(jobs.enqueue_due(), 0)
        self.assertEqual(ChallengeJob.objects.filter(dedupe_key__endswith=":final").count(), 1)

    def job(self, **kwargs):
        return ChallengeJob.objects.create(round=self.round, registration=self.registration, submission=self.submission,
            kind="quality_assessment", dedupe_key="quality:" + str(ChallengeJob.objects.count()), **kwargs)

    def provider_result(self):
        return {"output": self.grade(), "usage": {"total_tokens": 100, "prompt_tokens": 80, "completion_tokens": 20},
                "model": "qwen/qwen3.8-27b", "latency_ms": 10, "response_id": "fake-response"}

    def mock_storage(self):
        return patch("apps.challenges.assessment.storage._client", return_value=type("Store", (), {"get_object": lambda store, **kwargs: {"Body": io.BytesIO(self.data)}})())

    @override_settings(GROQ_API_KEY="")
    def test_missing_key_queues_honest_configuration_state_without_provider(self):
        job = self.job()
        with patch("apps.challenges.assessment.call_groq") as provider:
            self.assertEqual(jobs.process_one(), "awaiting_configuration")
        provider.assert_not_called(); job.refresh_from_db()
        self.assertEqual(job.attempts, 0)
        self.assertFalse(AssessmentRun.objects.exists())

    def test_success_is_idempotent_per_evidence_revision_and_settles_tokens(self):
        self.job()
        with self.mock_storage(), patch("apps.challenges.assessment.call_groq", return_value=self.provider_result()) as provider:
            self.assertEqual(jobs.process_one(), "completed")
            self.job()
            self.assertEqual(jobs.process_one(), "completed")
        self.assertEqual(provider.call_count, 1)
        self.assertEqual(AssessmentRun.objects.count(), 1)
        run = AssessmentRun.objects.get()
        self.assertEqual(run.status, "ready")
        self.assertEqual(run.quality_points, 80)
        budget = ChallengeBudgetDay.objects.get()
        self.assertEqual(budget.used_tokens, 100)
        self.assertEqual(budget.reserved_tokens, 0)

    @override_settings(CHALLENGE_AI_DAILY_TOKEN_LIMIT=1)
    def test_daily_cap_blocks_before_provider_and_preserves_pending_grade(self):
        self.job()
        with self.mock_storage(), patch("apps.challenges.assessment.call_groq") as provider:
            self.assertEqual(jobs.process_one(), "waiting_budget")
        provider.assert_not_called()
        self.assertIsNone(AssessmentRun.objects.get().quality_points)

    def test_explicit_rate_limit_retries_after_header_without_reserved_tokens(self):
        job = self.job()
        with self.mock_storage(), patch("apps.challenges.assessment.call_groq", side_effect=assessment.ProviderFailure("provider_rate_limited", retryable=True, retry_after=120)):
            self.assertEqual(jobs.process_one(), "queued")
        job.refresh_from_db()
        self.assertGreater(job.run_after, timezone.now() + timedelta(seconds=110))
        self.assertEqual(ChallengeBudgetDay.objects.get().reserved_tokens, 0)

    def test_uncertain_request_retains_budget_and_does_not_automatically_repeat(self):
        self.job()
        with self.mock_storage(), patch("apps.challenges.assessment.call_groq", side_effect=assessment.ProviderFailure("provider_connection_uncertain", usage_uncertain=True)) as provider:
            self.assertEqual(jobs.process_one(), "needs_review")
            self.assertIsNone(jobs.process_one())
        self.assertEqual(provider.call_count, 1)
        self.assertGreater(ChallengeBudgetDay.objects.get().reserved_tokens, 0)
        self.assertIsNone(AssessmentRun.objects.get().quality_points)

    def test_worker_exit_after_dispatch_requires_review_not_duplicate_call(self):
        self.job(status="processing", lease_expires_at=timezone.now() - timedelta(seconds=1), metadata={"provider_dispatched": True})
        with patch("apps.challenges.assessment.call_groq") as provider:
            self.assertEqual(jobs.process_one(), "needs_review")
        provider.assert_not_called()

    def test_counter_csv_extraction_is_source_labelled_and_needs_no_model(self):
        self.asset.kind = "engagement"; self.asset.save()
        self.data = b"likes,comments,shares,views\n10,5,,\n"
        self.asset.size_bytes = len(self.data); self.asset.sha256 = ""; self.asset.save()
        snapshot = EngagementSnapshot.objects.create(registration=self.registration, submission=self.submission, observed_at=timezone.now(), declared_counts={"likes": 10, "comments": 5})
        snapshot.evidence.add(self.asset)
        ChallengeJob.objects.create(round=self.round, registration=self.registration, submission=self.submission, kind="engagement_extract", dedupe_key="counter", metadata={"snapshot_id": snapshot.pk})
        with self.mock_storage(), patch("apps.challenges.assessment.call_groq") as provider:
            self.assertEqual(jobs.process_one(), "completed")
        provider.assert_not_called(); snapshot.refresh_from_db()
        self.assertEqual(snapshot.verification_status, "extracted")
        self.assertEqual(snapshot.source, "participant_supplied")
        self.assertEqual(snapshot.likes, 10)
        self.assertIsNone(snapshot.views)

    def test_invalid_model_award_does_not_create_accepted_quality_score(self):
        self.job(); result = self.provider_result(); result["output"]["criteria"][0]["points"] = 101
        with self.mock_storage(), patch("apps.challenges.assessment.call_groq", return_value=result):
            self.assertEqual(jobs.process_one(), "completed")
        run = AssessmentRun.objects.get()
        self.assertEqual(run.status, "review")
        self.assertIsNone(run.quality_points)

    @override_settings(CHALLENGE_AI_ENABLED=False, GROQ_API_KEY="")
    def test_complete_table_with_screenshot_uses_no_ai_and_retains_review_source(self):
        from PIL import Image
        image = io.BytesIO()
        Image.new("RGB", (4, 4), "white").save(image, format="PNG")
        picture = image.getvalue()
        self.data = b"likes,comments\n10,5\n"
        self.asset.kind, self.asset.name, self.asset.content_type = "engagement", "counts.csv", "text/csv"
        self.asset.size_bytes, self.asset.sha256 = len(self.data), ""
        self.asset.save()
        screenshot = EvidenceAsset.objects.create(registration=self.registration, kind="engagement", name="public-counts.png", key="public-proof",
            content_type="image/png", size_bytes=len(picture), status="ready", uploaded_at=self.now)
        snapshot = EngagementSnapshot.objects.create(registration=self.registration, submission=self.submission, observed_at=self.now)
        snapshot.evidence.add(self.asset, screenshot)
        job = ChallengeJob.objects.create(round=self.round, registration=self.registration, submission=self.submission, kind="engagement_extract", dedupe_key="table-picture", metadata={"snapshot_id": snapshot.pk})
        client = type("Store", (), {"get_object": lambda store, **kwargs: {"Body": io.BytesIO(picture if kwargs["Key"] == "public-proof" else self.data)}})()
        with patch("apps.challenges.assessment.storage._client", return_value=client), patch("apps.challenges.assessment.call_groq") as provider:
            jobs.extract_snapshot(job)
        provider.assert_not_called()
        snapshot.refresh_from_db()
        self.assertEqual(snapshot.verification_status, "extracted")
        self.assertEqual(snapshot.likes, 10)
        self.assertEqual(snapshot.source, "participant_supplied")
        self.assertEqual(snapshot.extracted["evidence"][-1]["comparison"], "retained_for_finalist_review")

    @override_settings(GROQ_API_KEY="")
    def test_pilot_requires_real_configuration_and_makes_no_capacity_claim(self):
        with patch("apps.challenges.assessment.call_groq") as provider, self.assertRaises(CommandError):
            call_command("challenge_pilot", round=self.round.slug, samples="not-read.json", output="not-written.json")
        provider.assert_not_called()
