"""Database-scale checks do not claim any live AI service throughput."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.challenges.models import AssessmentRun, ChallengeJob, ChallengeRegistration, ChallengeRound, ChallengeSubmission, RoundCategory


class ScorebookCapacityTests(TestCase):
    def test_two_thousand_entries_rank_without_per_entry_database_queries(self):
        now = timezone.now()
        round = ChallengeRound.objects.create(
            title="Capacity fixture", slug="capacity-fixture", status="closed", mode="quality_only",
            registration_opens_at=now - timedelta(days=10), registration_closes_at=now - timedelta(days=3),
            submission_closes_at=now - timedelta(days=2), final_collection_starts_at=now - timedelta(days=1),
            final_collection_ends_at=now - timedelta(hours=1), results_publish_at=now + timedelta(days=1),
        )
        category = RoundCategory.objects.create(round=round, slug="data", name="Data Analysis", rubric_version=1)
        participants = [ChallengeRegistration(round=round, category=category, full_name=f"Participant {index}",
            email=f"entry{index}@example.invalid", phone="08000000000", accept_rules=True, email_verified_at=now) for index in range(2000)]
        ChallengeRegistration.objects.bulk_create(participants, batch_size=100)
        submissions = [ChallengeSubmission(registration=entry, revision=1, platform="instagram", post_url=f"https://www.instagram.com/p/Example{index}/",
            canonical_post_id=f"instagram:Example{index}", explanation="Evidence is held in the test fixture.") for index, entry in enumerate(participants)]
        ChallengeSubmission.objects.bulk_create(submissions, batch_size=100)
        AssessmentRun.objects.bulk_create([AssessmentRun(submission=submission, status="ready", input_hash=f"capacity-{index}",
            quality_points=Decimal("60") + Decimal(index) / 10000, rubric_version=1, completed_at=now) for index, submission in enumerate(submissions)], batch_size=100)
        ChallengeJob.objects.bulk_create([ChallengeJob(round=round, registration=entry, submission=submission, kind="quality_assessment", dedupe_key=f"capacity:{index}", status="completed", completed_at=now)
            for index, (entry, submission) in enumerate(zip(participants, submissions))], batch_size=100)
        admin = get_user_model().objects.create_user(email="capacity-admin@example.invalid", password="x", role="admin", is_active=True)
        client = APIClient()
        client.force_authenticate(admin)
        with CaptureQueriesContext(connection) as captured:
            result = client.get(f"/api/v1/challenges/admin/rounds/{round.slug}/scorebook/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(result.data["rows"]), 2000)
        winner = next(row for row in result.data["rows"] if row["winner"])
        self.assertEqual(winner["registration_id"], str(participants[-1].pk))
        self.assertEqual(winner["rank"], 1)
        self.assertLess(len(captured), 40, f"Scorebook used {len(captured)} queries for 2,000 entries")
        self.assertEqual(ChallengeJob.objects.filter(status="completed").count(), 2000)
