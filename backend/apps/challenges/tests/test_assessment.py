from datetime import timedelta
from decimal import Decimal
import hashlib
import io
import json
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import HTTPError
from zipfile import ZipFile, ZIP_DEFLATED

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from apps.challenges import assessment
from apps.challenges.models import (AssessmentRun, ChallengeJob, ChallengeRegistration, ChallengeRound,
    ChallengeSubmission, EngagementSnapshot, EvidenceAsset, RoundCategory, ScoreOverride)


class FixtureMixin:
    def setUp(self):
        self.now = timezone.now()
        self.round = ChallengeRound.objects.create(title="November challenge", slug="november", status="closed", mode="quality_only",
            registration_opens_at=self.now - timedelta(days=10), registration_closes_at=self.now - timedelta(days=3),
            submission_closes_at=self.now - timedelta(days=2), final_collection_starts_at=self.now - timedelta(days=1),
            final_collection_ends_at=self.now - timedelta(hours=1), results_publish_at=self.now + timedelta(days=1), likes_target=100, comments_target=20)
        self.category = RoundCategory.objects.create(round=self.round, slug="data-analysis", name="Data Analysis", brief="Explain the supplied data.",
            requirements=["A correct analysis"], rubric=[{"id": "execution", "label": "Execution", "max_points": 100}])
        self.registration = ChallengeRegistration.objects.create(round=self.round, category=self.category, full_name="Test Participant",
            email="participant@example.invalid", phone="000", email_verified_at=self.now, accept_rules=True)
        self.submission = ChallengeSubmission.objects.create(registration=self.registration, revision=1, platform="instagram",
            post_url="https://www.instagram.com/p/Example123/", canonical_post_id="instagram:Example123", explanation="My analysis.")
        self.data = b"city,total\nLagos,10\nAbuja,20\n"
        self.asset = EvidenceAsset.objects.create(registration=self.registration, kind="project", name="analysis.csv", key="private/challenges/test.csv",
            content_type="text/csv", size_bytes=len(self.data), status="ready", uploaded_at=self.now - timedelta(days=2))
        self.submission.evidence.add(self.asset)
        self.admin = get_user_model().objects.create_user(email="challenge-admin@example.invalid", password="x", role="admin", is_active=True)

    def grade(self, points=80):
        return {"criteria": [{"id": "execution", "points": points, "reason": "The evidence supports this criterion.", "evidence_refs": [str(self.asset.pk)]}],
                "strengths": ["A clear analysis."], "weaknesses": ["Add further context."], "missing_deliverables": [], "needs_review": False, "review_reason": ""}

    def ready_run(self, points=80):
        return AssessmentRun.objects.create(submission=self.submission, input_hash=hashlib.sha256(str(self.submission.pk).encode()).hexdigest(),
            status="ready", quality_points=points, criterion_scores=self.grade(points)["criteria"], completed_at=self.now, model="configured-model")


class EvidenceAndValidationTests(SimpleTestCase):
    def test_web_source_archive_is_read_without_execution(self):
        data = io.BytesIO()
        with ZipFile(data, "w") as archive:
            archive.writestr("src/app.js", 'fetch("https://example.invalid/do-not-run");')
            archive.writestr("README.md", "This project solves the specified task.")
            archive.writestr("node_modules/unused.js", "This dependency is not submitted source.")
        result = assessment.extract_evidence(data.getvalue(), "source.zip", "source-one")
        self.assertIn("do-not-run", result["text"])
        self.assertIn("README.md", result["text"])
        self.assertNotIn("dependency", result["text"])
        self.assertEqual(result["flags"], [])

    def test_source_archive_rejects_unsafe_paths(self):
        data = io.BytesIO()
        with ZipFile(data, "w") as archive:
            archive.writestr("../outside.js", "untrusted source")
        with self.assertRaises(ValueError):
            assessment.extract_evidence(data.getvalue(), "source.zip", "source-one")

    def test_csv_is_bounded_and_formula_text_is_not_executed(self):
        result = assessment.extract_evidence(b"Name,Formula\nAda,=WEBSERVICE(\"https://example.invalid\")\n", "test.csv", "one")
        self.assertIn("WEBSERVICE", result["text"])
        self.assertEqual(result["rows"][1][0], "Ada")

    def test_sparse_xlsx_cells_preserve_counter_columns(self):
        data = io.BytesIO()
        with ZipFile(data, "w") as z:
            z.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="inlineStr"><is><t>likes</t></is></c><c r="B1" t="inlineStr"><is><t>comments</t></is></c></row><row><c r="B2"><v>5</v></c></row></sheetData></worksheet>')
        result = assessment.extract_evidence(data.getvalue(), "proof.xlsx", "one")
        self.assertEqual(result["rows"][1], ["", "5"])

    def test_compressed_document_bomb_and_entities_rejected(self):
        data = io.BytesIO()
        with ZipFile(data, "w", compression=ZIP_DEFLATED) as z:
            z.writestr("word/document.xml", "A" * 100000)
        with self.assertRaises(ValueError):
            assessment.extract_evidence(data.getvalue(), "bomb.docx", "one")
        with self.assertRaises(ValueError):
            assessment._xml(b'<!DOCTYPE x [<!ENTITY z "x">]><x>&z;</x>')

    def test_unsupported_formats_are_explicitly_unassessable(self):
        result = assessment.extract_evidence(b"video bytes", "demo.mp4", "one")
        self.assertIn("unsupported_evidence_format", result["flags"])
        self.assertIn("evidence_not_assessable", result["flags"])

    def test_category_rubric_maxima_and_unique_ids_validated(self):
        for rubric in ([{"id": "one", "max_points": 99}], [{"id": "one", "max_points": 50}, {"id": "one", "max_points": 50}], [{"id": "bad/id", "max_points": 100}]):
            with self.assertRaises(ValueError):
                assessment.normalized_rubric(rubric)

    def test_awards_need_exact_criteria_ranges_and_evidence_references(self):
        rubric = assessment.normalized_rubric([{"id": "execution", "max_points": 100}])
        valid = {"criteria": [{"id": "execution", "points": 80, "reason": "Supported by evidence.", "evidence_refs": ["one"]}],
                 "strengths": [], "weaknesses": [], "missing_deliverables": [], "needs_review": False, "review_reason": ""}
        self.assertEqual(assessment.validate_grade(valid, rubric, {"one"})[1], Decimal("80.0000"))
        for field, value in (("points", 101), ("points", True), ("points", float("nan")), ("id", "other"), ("evidence_refs", ["invented"]), ("reason", "")):
            invalid = json.loads(json.dumps(valid)); invalid["criteria"][0][field] = value
            with self.assertRaises(ValueError):
                assessment.validate_grade(invalid, rubric, {"one"})

    @override_settings(CHALLENGE_AI_ENABLED=False, GROQ_API_KEY="")
    def test_configuration_is_required_no_fake_grade(self):
        with self.assertRaises(assessment.AssessmentUnavailable):
            assessment.require_configuration()

    def test_provider_failure_does_not_expose_provider_body_or_key(self):
        error = HTTPError("https://api.groq.com", 401, "unauthorized", {}, io.BytesIO(b"private-key-material"))
        with patch("apps.challenges.assessment.build_opener") as opener:
            opener.return_value.open.side_effect = error
            with self.assertRaises(assessment.ProviderFailure) as caught:
                assessment.call_groq([], {}, config={"model": "openai/gpt-oss-20b", "key": "private-key-material", "max_output": 1000, "timeout": 5})
        self.assertNotIn("private-key-material", str(caught.exception))
        self.assertEqual(caught.exception.code, "provider_http_401")


class ScorebookTests(FixtureMixin, TestCase):
    def test_daily_evidence_updates_provisional_score_but_is_not_final_proof(self):
        self.ready_run(80)
        self.round.mode = "hybrid"
        self.round.status = "open"
        self.round.final_collection_starts_at = self.now + timedelta(days=2)
        self.round.final_collection_ends_at = self.now + timedelta(days=2, hours=2)
        self.round.save()
        proof = EvidenceAsset.objects.create(registration=self.registration, kind="engagement", key="daily-proof", name="proof.csv", size_bytes=10,
            content_type="text/csv", status="ready", uploaded_at=self.now - timedelta(minutes=1))
        snapshot = EngagementSnapshot.objects.create(registration=self.registration, submission=self.submission, observed_at=self.now - timedelta(minutes=1),
            verification_status="extracted", likes=100, comments=20, source="participant_supplied")
        snapshot.evidence.add(proof)
        row = assessment.compute_scorebook(self.round)[0]
        self.assertEqual(row["score_phase"], "provisional")
        self.assertEqual(row["total"], "84.0000")
        with patch("apps.challenges.assessment.timezone.now", return_value=self.now + timedelta(days=3)):
            final = assessment.compute_scorebook(self.round)[0]
        self.assertEqual(final["status"], "needs_review")
        self.assertEqual(final["quality_points"], "80.0000")
        self.assertIsNone(final["total"])

    def test_quality_only_is_raw_score_out_of_100_not_80(self):
        self.ready_run(90)
        row = assessment.compute_scorebook(self.round)[0]
        self.assertEqual(row["total"], "90.0000")
        self.assertIsNone(row["engagement_points"])
        self.assertEqual(row["status"], "ranked")

    def test_hybrid_requires_final_receipt_and_asset_upload_not_backdated_claim(self):
        self.ready_run(80)
        self.round.mode = "hybrid"; self.round.save()
        proof = EvidenceAsset.objects.create(registration=self.registration, kind="engagement", key="proof", name="proof.csv", size_bytes=10,
            content_type="text/csv", status="ready", uploaded_at=self.now - timedelta(hours=2))
        snapshot = EngagementSnapshot.objects.create(registration=self.registration, submission=self.submission, observed_at=self.now - timedelta(hours=2),
            verification_status="extracted", likes=100, comments=20, source="participant_supplied")
        snapshot.evidence.add(proof)
        self.assertEqual(assessment.compute_scorebook(self.round)[0]["status"], "needs_review")
        EngagementSnapshot.objects.filter(pk=snapshot.pk).update(created_at=self.now - timedelta(hours=2))
        row = assessment.compute_scorebook(self.round)[0]
        self.assertEqual(row["total"], "84.0000")
        self.assertEqual(row["engagement_source"], "participant_supplied")
        proof.uploaded_at = self.now - timedelta(days=3); proof.save()
        self.assertEqual(assessment.compute_scorebook(self.round)[0]["status"], "needs_review")

    def test_partial_override_does_not_discard_previous_quality_correction(self):
        self.ready_run(60)
        ScoreOverride.objects.create(registration=self.registration, submission=self.submission, actor=self.admin, reason="Quality correction", quality_points=90, previous={})
        ScoreOverride.objects.create(registration=self.registration, submission=self.submission, actor=self.admin, reason="Separate engagement correction", engagement_points=5, previous={})
        self.assertEqual(assessment.compute_scorebook(self.round)[0]["total"], "90.0000")

    def test_early_publication_and_pending_job_freeze_are_blocked(self):
        self.ready_run()
        with self.assertRaises(ValidationError):
            assessment.publish_round(self.round, self.admin)
        ChallengeJob.objects.create(round=self.round, registration=self.registration, submission=self.submission, kind="quality_assessment", dedupe_key="pending")
        with self.assertRaises(ValidationError):
            assessment.freeze_round(self.round, self.admin)

    def test_freeze_retains_immutable_snapshot_and_draft_cannot_freeze(self):
        self.ready_run(90)
        self.round.status = "draft"; self.round.save()
        with self.assertRaises(ValidationError):
            assessment.freeze_round(self.round, self.admin)
        self.round.status = "closed"; self.round.save()
        locked = assessment.freeze_round(self.round, self.admin)
        self.assertEqual(locked.frozen_scorebook[0]["total"], "90.0000")
        AssessmentRun.objects.filter(submission=self.submission).update(quality_points=10)
        self.assertEqual(assessment.freeze_round(locked, self.admin).frozen_scorebook[0]["total"], "90.0000")

    def test_exact_winner_boundary_tie_blocks_freeze(self):
        self.ready_run(80)
        second = ChallengeRegistration.objects.create(round=self.round, category=self.category, full_name="Second", email="second@example.invalid", phone="0", accept_rules=True)
        submission = ChallengeSubmission.objects.create(registration=second, revision=1, platform="instagram", post_url="https://www.instagram.com/p/Other123/", canonical_post_id="instagram:Other123", explanation="Work")
        AssessmentRun.objects.create(submission=submission, input_hash="b" * 64, status="ready", quality_points=80, completed_at=self.now)
        with self.assertRaises(ValidationError):
            assessment.freeze_round(self.round, self.admin)
