"""Challenge API tests use local mail/storage fakes and never contact providers."""
import csv
from datetime import timedelta
from decimal import Decimal
from io import BytesIO, StringIO
from unittest.mock import Mock, patch
from zipfile import ZipFile

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.challenges.auth import issue_token, token_digest
from apps.challenges.emails import deliver_challenge_email
from apps.challenges.models import (
    AssessmentRun, ChallengeJob, ChallengeRegistration, ChallengeRound, ChallengeSubmission,
    EngagementSnapshot, EvidenceAsset, ParticipantToken, RoundCategory, ScoreOverride,
)
from apps.challenges.uploads import complete_upload, inspect_bytes
from rest_framework.exceptions import ValidationError

ROOT = "/api/v1/challenges/"
RUBRIC = [{"id": "accuracy", "label": "Accuracy", "max_points": 100, "description": "Every required calculation matches the stated source data."}]


class ChallengeApiTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.round = ChallengeRound.objects.create(
            title="November challenge", slug="test-round", status="open", mode="hybrid",
            rules="Publish original work, tag VaceUp and submit public count evidence.",
            hashtag="#Challenge", linkedin_handle="vaceup", instagram_handle="vaceup",
            registration_opens_at=self.now - timedelta(days=1), registration_closes_at=self.now + timedelta(days=1),
            submission_closes_at=self.now + timedelta(days=2), final_collection_starts_at=self.now + timedelta(days=3),
            final_collection_ends_at=self.now + timedelta(days=3, hours=2), results_publish_at=self.now + timedelta(days=4),
            likes_target=100, comments_target=50,
        )
        self.category = RoundCategory.objects.create(round=self.round, slug="data", name="Data Analysis", brief="Build the required spreadsheet.", requirements=["An XLSX workbook and a short presentation video."], rubric=RUBRIC)
        self.other_category = RoundCategory.objects.create(round=self.round, slug="web", name="Web Development", brief="Secret web brief.", requirements=["Website source."], rubric=RUBRIC)
        self.registration = self.make_registration("guest@example.com")
        self.other_registration = self.make_registration("other@example.com", self.other_category)
        self.client = APIClient()
        self.session = issue_token(self.registration, "session")
        self.client.credentials(HTTP_X_CHALLENGE_TOKEN=self.session)
        self.admin = get_user_model().objects.create_user("admin@example.com", password="test-pass", role="admin", is_active=True)
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin)

    def make_registration(self, email, category=None):
        return ChallengeRegistration.objects.create(round=self.round, category=category or self.category, full_name="Sample Participant", email=email, phone="08012345678", accept_rules=True, email_verified_at=self.now)

    def asset(self, registration=None, kind="project", **kwargs):
        import uuid
        return EvidenceAsset.objects.create(registration=registration or self.registration, kind=kind, name="work.txt" if kind == "project" else "counts.csv", key=f"private/test/{uuid.uuid4()}", content_type="text/plain" if kind == "project" else "text/csv", size_bytes=12, status="ready", uploaded_at=self.now, **kwargs)

    def submit(self, post="https://www.instagram.com/p/ABCde123/", evidence=None):
        evidence = evidence or [self.asset()]
        return self.client.post(ROOT + "submissions/", {"post_url": post, "explanation": "This project calculates and explains the full dataset.", "evidence_ids": [str(asset.pk) for asset in evidence], "checklist_confirmed": True}, format="json")

    def test_guest_registration_queues_mail_without_lms_identity(self):
        user_count = get_user_model().objects.count()
        response = APIClient().post(ROOT + "register/", {"round_slug": self.round.slug, "category_id": self.category.pk, "full_name": "New Participant", "email": "NEW@Example.COM", "phone": "08012345678", "accept_rules": True}, format="json")
        self.assertEqual(response.status_code, 202, response.data)
        registration = ChallengeRegistration.objects.get(email="new@example.com")
        self.assertEqual(registration.category_id, self.category.pk)
        self.assertEqual(get_user_model().objects.count(), user_count)
        self.assertEqual(registration.jobs.get().kind, "brief_email")
        self.assertEqual(len(mail.outbox), 0)
        self.assertNotIn("access_token", response.data)

    def test_duplicate_registration_cannot_change_category(self):
        response = APIClient().post(ROOT + "register/", {"round_slug": self.round.slug, "category_id": self.other_category.pk, "full_name": "Impersonation", "email": self.registration.email.upper(), "phone": "00000000000", "accept_rules": True}, format="json")
        self.assertEqual(response.status_code, 202)
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.category_id, self.category.pk)
        self.assertEqual(self.registration.full_name, "Sample Participant")

    def test_registration_rejects_closed_window_and_foreign_category(self):
        self.round.registration_closes_at = self.now - timedelta(minutes=1)
        self.round.save()
        response = APIClient().post(ROOT + "register/", {"round_slug": self.round.slug, "category_id": self.category.pk, "full_name": "New Participant", "email": "new@example.com", "phone": "123456", "accept_rules": True}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_verification_single_use_hashed_and_version_revocable(self):
        token = issue_token(self.registration, "verify")
        self.assertFalse(ParticipantToken.objects.filter(token_hash=token).exists())
        self.assertTrue(ParticipantToken.objects.filter(token_hash=token_digest(token)).exists())
        response = APIClient().post(ROOT + "verify/", {"token": token}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.data)
        self.assertIn(APIClient().post(ROOT + "verify/", {"token": token}, format="json").status_code, (401, 403))
        self.registration.access_version += 1
        self.registration.save()
        self.assertIn(self.client.get(ROOT + "portal/").status_code, (401, 403))

    def test_expired_and_unverified_sessions_are_denied(self):
        ParticipantToken.objects.filter(token_hash=token_digest(self.session)).update(expires_at=self.now - timedelta(seconds=1))
        self.assertIn(self.client.get(ROOT + "portal/").status_code, (401, 403))
        self.registration.email_verified_at = None
        self.registration.save()
        self.client.credentials(HTTP_X_CHALLENGE_TOKEN=issue_token(self.registration, "session"))
        self.assertIn(self.client.get(ROOT + "portal/").status_code, (401, 403))

    def test_portal_category_isolation_and_unpublished_score_privacy(self):
        submission = self.submit().data
        AssessmentRun.objects.create(submission_id=submission["id"], input_hash="a" * 64, status="ready", quality_points=99)
        response = self.client.get(ROOT + "portal/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["result"])
        self.assertEqual(response.data["registration"]["category"]["brief"], self.category.brief)
        self.assertNotIn("Secret web brief", str(response.data))
        self.assertNotIn("quality_points", str(response.data))
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_recovery_is_uniform_for_unknown_email(self):
        one = APIClient().post(ROOT + "access/", {"round_slug": self.round.slug, "email": self.registration.email}, format="json")
        two = APIClient().post(ROOT + "access/", {"round_slug": self.round.slug, "email": "unknown@example.com"}, format="json")
        self.assertEqual(one.status_code, 202)
        self.assertEqual(one.data, two.data)
        self.assertEqual(ChallengeJob.objects.filter(kind="brief_email").count(), 1)

    def test_submission_ownership_unique_post_and_immutable_revisions(self):
        stolen = self.asset(self.other_registration)
        self.assertEqual(self.submit(evidence=[stolen]).status_code, 403)
        first = self.submit()
        self.assertEqual(first.status_code, 201, first.data)
        second = self.submit()
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.data["revision"], 2)
        self.assertNotEqual(first.data["id"], second.data["id"])
        self.client.credentials(HTTP_X_CHALLENGE_TOKEN=issue_token(self.other_registration, "session"))
        self.assertEqual(self.submit(evidence=[stolen]).status_code, 400)
        self.assertEqual(ChallengeJob.objects.filter(kind="quality_assessment").count(), 2)

    def test_submission_rejects_arbitrary_url_and_deadline(self):
        self.assertEqual(self.submit(post="https://127.0.0.1/private/").status_code, 400)
        self.round.submission_closes_at = self.now - timedelta(seconds=1)
        self.round.save()
        self.assertEqual(self.submit().status_code, 403)
        self.assertEqual(ChallengeSubmission.objects.count(), 0)

    def test_counts_are_declared_not_trusted_and_zero_is_preserved(self):
        self.submit()
        asset = self.asset(kind="engagement")
        response = self.client.post(ROOT + "engagement/", {"likes": 0, "comments": "hidden", "evidence_ids": [str(asset.pk)]}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["declared_counts"]["likes"], 0)
        self.assertIsNone(response.data["likes"])
        self.assertIsNone(response.data["declared_counts"]["comments"])
        self.assertEqual(response.data["verification_status"], "unverified")
        self.assertEqual(ChallengeJob.objects.get(kind="engagement_extract").metadata["snapshot_id"], response.data["id"])

    def test_final_collection_cannot_reuse_old_upload_or_backdate_it(self):
        self.submit()
        asset = self.asset(kind="engagement")
        self.round.final_collection_starts_at = self.now - timedelta(minutes=1)
        self.round.final_collection_ends_at = self.now + timedelta(minutes=5)
        self.round.save()
        EvidenceAsset.objects.filter(pk=asset.pk).update(uploaded_at=self.now - timedelta(days=2))
        response = self.client.post(ROOT + "engagement/", {"likes": 20, "comments": 5, "observed_at": self.now.isoformat(), "evidence_ids": [str(asset.pk)]}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(EngagementSnapshot.objects.exists())
        EvidenceAsset.objects.filter(pk=asset.pk).update(uploaded_at=self.now)
        self.assertEqual(self.client.post(ROOT + "engagement/", {"likes": 20, "comments": 5, "evidence_ids": [str(asset.pk)]}, format="json").status_code, 201)

    @patch("apps.challenges.views.storage.presigned_download_url", return_value="https://storage.example/private-signed")
    def test_private_download_scoped_to_owner_and_admin(self, sign):
        asset = self.asset(self.other_registration)
        self.assertEqual(self.client.get(ROOT + f"uploads/{asset.pk}/download/").status_code, 404)
        self.assertEqual(APIClient().get(ROOT + f"admin/assets/{asset.pk}/download/").status_code, 401)
        response = self.admin_client.get(ROOT + f"admin/assets/{asset.pk}/download/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["url"], sign.return_value)

    @override_settings(CHALLENGE_AI_ENABLED=True, GROQ_API_KEY="unit-test-key", CHALLENGE_ASSESSMENT_CALIBRATED=True)
    def test_open_readiness_requires_actual_briefs_and_locks_scoring_mode(self):
        self.round.status = "draft"
        self.round.save()
        self.category.rubric = [{"id": "accuracy", "label": "Accuracy", "max_points": 100, "description": ""}]
        self.category.save()
        base = ROOT + f"admin/rounds/{self.round.slug}/"
        self.assertEqual(self.admin_client.post(base + "open/").status_code, 400)
        self.category.rubric = RUBRIC
        self.category.save()
        self.assertEqual(self.admin_client.post(base + "open/").status_code, 200)
        self.assertEqual(self.admin_client.patch(base, {"mode": "quality_only"}, format="json").status_code, 400)
        self.assertEqual(self.admin_client.patch(ROOT + f"admin/categories/{self.category.pk}/", {"brief": "Changed after opening"}, format="json").status_code, 400)

    def test_open_registration_requires_provider_and_calibration(self):
        self.round.status = "draft"
        self.round.save()
        base = ROOT + f"admin/rounds/{self.round.slug}/"
        with override_settings(CHALLENGE_AI_ENABLED=False, CHALLENGE_ASSESSMENT_CALIBRATED=False):
            response = self.admin_client.post(base + "open/")
            self.assertEqual(response.status_code, 400)
            self.assertTrue(any("provider" in message for message in response.data["readiness"]))
            self.assertTrue(any("capacity" in message for message in response.data["readiness"]))
        with override_settings(CHALLENGE_AI_ENABLED=True, GROQ_API_KEY="unit-test-key", CHALLENGE_ASSESSMENT_CALIBRATED=False):
            response = self.admin_client.post(base + "open/")
            self.assertEqual(response.status_code, 400)
        self.round.refresh_from_db()
        self.assertEqual(self.round.status, "draft")

    def test_admin_corrections_are_audited_and_frozen_round_rejects_edits(self):
        self.submit()
        base = ROOT + f"admin/rounds/{self.round.slug}/"
        payload = {"registration_id": str(self.registration.pk), "quality_points": 97, "reason": "Reviewed the full spreadsheet calculation evidence."}
        self.assertEqual(self.admin_client.post(base + "overrides/", payload, format="json").status_code, 201)
        correction = ScoreOverride.objects.get()
        self.assertEqual(correction.quality_points, Decimal(97))
        self.assertEqual(correction.actor_id, self.admin.pk)
        self.assertEqual(correction.previous["status"], "awaiting_assessment")
        self.assertEqual(self.admin_client.post(base + "freeze/", {"approved": True}, format="json").status_code, 400)
        self.round.status = "frozen"
        self.round.save()
        self.assertEqual(self.admin_client.post(base + "overrides/", payload, format="json").status_code, 400)
        self.assertEqual(self.admin_client.post(base + "freeze/", {}, format="json").status_code, 400)
        self.assertEqual(self.admin_client.post(base + "publish/", {"approved": True}, format="json").status_code, 400)

    def test_clone_creates_draft_without_participant_records_or_results(self):
        self.submit()
        response = self.admin_client.post(ROOT + f"admin/rounds/{self.round.slug}/clone/", {"slug": "january-2027", "title": "January challenge"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        cloned = ChallengeRound.objects.get(slug="january-2027")
        self.assertEqual(cloned.status, "draft")
        self.assertEqual(cloned.categories.count(), 2)
        self.assertEqual(cloned.registrations.count(), 0)
        self.assertEqual(cloned.jobs.count(), 0)
        self.assertEqual(cloned.frozen_scorebook, [])
        self.assertEqual(cloned.categories.get(slug="data").brief, self.category.brief)

    def test_public_results_include_only_consented_winners_and_no_contact(self):
        self.round.status = "published"
        self.round.frozen_scorebook = [{"registration_id": str(self.registration.pk), "name": "Public winner", "category": "Data Analysis", "rank": 1, "winner": True, "total": "95"}, {"registration_id": str(self.other_registration.pk), "name": "Private winner", "category": "Web Development", "rank": 1, "winner": True, "total": "94"}]
        self.round.save()
        self.registration.make_public = True
        self.registration.save()
        response = APIClient().get(ROOT + f"rounds/{self.round.slug}/results/")
        self.assertEqual(len(response.data["results"]), 1)
        self.assertNotIn("@", str(response.data))
        self.assertNotIn("Private winner", str(response.data))

    def test_csv_and_xlsx_exports_are_safe_numeric_and_source_labelled(self):
        self.round.status = "frozen"
        self.round.frozen_scorebook = [{"registration_id": str(self.registration.pk), "name": "=HYPERLINK(\"bad\")", "category": "Data Analysis", "quality_points": "90", "engagement_points": "10.5", "total": "82.5", "likes": 10, "comments": 3, "engagement_source": "participant_supplied", "observed_at": self.now.isoformat(), "received_at": self.now.isoformat(), "status": "ranked", "winner": True, "criterion_scores": [{"id": "accuracy", "points": 90}], "flags": []}]
        self.round.save()
        base = ROOT + f"admin/rounds/{self.round.slug}/export/"
        response = self.admin_client.get(base + "?format=csv")
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        csv_row = next(csv.DictReader(StringIO(content)))
        self.assertTrue(csv_row["name"].startswith("'="))
        self.assertIn("participant_supplied", content)
        self.assertIn("received_at", content)
        response = self.admin_client.get(base + "?format=xlsx")
        self.assertEqual(response.status_code, 200)
        from openpyxl import load_workbook
        workbook = load_workbook(BytesIO(response.content), read_only=True, data_only=False)
        rows = list(workbook["Scorebook"].iter_rows())
        headers = [cell.value for cell in rows[0]]
        self.assertEqual(rows[1][headers.index("total")].value, 82.5)
        self.assertEqual(rows[1][headers.index("total")].data_type, "n")
        self.assertTrue(rows[1][headers.index("name")].value.startswith("'="))
        self.assertIn("Read me", workbook.sheetnames)
        workbook.close()

    def test_category_email_is_branded_isolated_and_uses_personal_verification(self):
        job = ChallengeJob.objects.create(kind="brief_email", registration=self.registration, round=self.round, dedupe_key="email-test")
        with patch("apps.challenges.emails.send_account_message", side_effect=lambda message: message.send()):
            self.assertTrue(deliver_challenge_email(job))
        message = mail.outbox[-1]
        self.assertEqual(message.to, [self.registration.email])
        self.assertIn(self.category.brief, message.body)
        self.assertNotIn(self.other_category.brief, message.body)
        self.assertIn("verify=", message.body)
        self.assertIn("Africa/Lagos", message.body)
        self.assertIn("<table", message.alternatives[0].content)
        self.assertNotIn("Secret web brief", message.alternatives[0].content)

    def test_malformed_body_is_rejected_and_seed_is_draft_idempotent(self):
        self.assertEqual(self.client.post(ROOT + "uploads/", [], format="json").status_code, 400)
        out = StringIO()
        call_command("seed_november_challenge", stdout=out)
        call_command("seed_november_challenge", stdout=out)
        seeded = ChallengeRound.objects.get(slug="november-2026")
        self.assertEqual(seeded.status, "draft")
        self.assertEqual(seeded.categories.count(), 5)
        self.assertEqual(timezone.localtime(seeded.final_collection_starts_at).hour, 18)
        self.assertEqual(timezone.localtime(seeded.final_collection_ends_at).hour, 20)


@override_settings(AWS_STORAGE_BUCKET_NAME="test-private")
class UploadVerificationTests(TestCase):
    def test_signature_archive_traversal_and_macros_rejected(self):
        with self.assertRaises(ValidationError):
            inspect_bytes(b"<html>not a PDF</html>", "data.pdf")
        for entry in ("../escape.txt", "xl/vbaProject.bin"):
            output = BytesIO()
            with ZipFile(output, "w") as archive:
                archive.writestr(entry, "unsafe")
            with self.assertRaises(ValidationError):
                inspect_bytes(output.getvalue(), "data.zip")

    @patch("apps.challenges.uploads.storage._client")
    def test_verified_copy_is_private_and_cannot_be_overwritten_by_original_put(self, client_factory):
        asset = Mock(status="uploading", size_bytes=12, content_type="text/csv", key="incoming/original", registration_id="participant", pk="asset")
        asset.name = "counts.csv"
        data = b"likes,20\n\n\n\n"
        self.assertEqual(len(data), 12)
        client = client_factory.return_value
        uploaded_at = timezone.now() - timedelta(hours=2)
        client.head_object.return_value = {"ContentLength": 12, "ContentType": "text/csv", "LastModified": uploaded_at}
        client.get_object.return_value = {"Body": BytesIO(data)}
        complete_upload(asset)
        self.assertNotEqual(asset.key, "incoming/original")
        self.assertTrue(asset.key.startswith("private/challenges/evidence/participant/"))
        self.assertEqual(asset.uploaded_at, uploaded_at)
        self.assertEqual(asset.status, "ready")
        self.assertEqual(client.put_object.call_args.kwargs["Body"], data)

    @patch("apps.challenges.uploads.storage._client")
    def test_size_and_content_type_mismatch_rejected_before_copy(self, client_factory):
        asset = Mock(status="uploading", size_bytes=20, content_type="image/png", key="incoming/image")
        client_factory.return_value.head_object.return_value = {"ContentLength": 20, "ContentType": "text/html"}
        with self.assertRaises(ValidationError):
            complete_upload(asset)
        client_factory.return_value.put_object.assert_not_called()
