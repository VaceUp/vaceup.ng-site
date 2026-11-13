"""Intakes advertise the next start without changing admissions or payments."""
from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.courses.models import Category, Course
from apps.website.intakes import upcoming_intakes
from apps.website.models import AcademyIntake, AcademyProfile


class IntakeTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.admin = users.objects.create_user(email="intakes-admin@example.com", password="x", role="admin", is_active=True)
        self.teacher = users.objects.create_user(email="intakes-tutor@example.com", password="x", role="instructor", is_active=True)
        category = Category.objects.create(name="Digital skills")
        self.course = Course.objects.create(title="Data Analysis", slug="data-analysis-intake", category=category, instructor=self.teacher, is_published=True)
        self.other = Course.objects.create(title="UI/UX", slug="ui-ux-intake", category=category, instructor=self.teacher, is_published=True)
        self.client = APIClient()

    def intake(self, month=4, **kwargs):
        values = dict(title="Next intake", starts_on=date(2027, month, 9), ends_on=date(2027, month + 2, 25), is_active=True, all_courses=True)
        values.update(kwargs)
        return AcademyIntake.objects.create(**values)

    def test_february_advertises_april_not_ongoing_january(self):
        self.intake(month=1)
        april = self.intake(month=4)
        self.assertEqual(upcoming_intakes(today=date(2027, 2, 1)).first(), april)

    def test_start_day_is_still_eligible_then_excluded_the_next_day(self):
        april = self.intake()
        self.assertEqual(upcoming_intakes(today=april.starts_on).first(), april)
        self.assertIsNone(upcoming_intakes(today=date(2027, 4, 10)).first())

    @patch("apps.website.intakes.timezone.localdate", return_value=date(2027, 2, 1))
    def test_public_next_excludes_draft_archived_and_unavailable_course(self, _today):
        self.intake(month=3, is_active=False)
        self.intake(month=3, is_archived=True)
        selected = self.intake(all_courses=False)
        selected.courses.add(self.course)
        self.assertEqual(self.client.get(f"/api/v1/website/intakes/next/?course={self.course.slug}").data["intake"]["id"], selected.pk)
        self.assertIsNone(self.client.get(f"/api/v1/website/intakes/next/?course={self.other.slug}").data["intake"])

    @patch("apps.website.intakes.timezone.localdate", return_value=date(2027, 2, 1))
    def test_public_data_does_not_expose_unpublished_courses(self, _today):
        self.other.is_published = False
        self.other.save(update_fields=["is_published"])
        row = self.intake(all_courses=False)
        row.courses.add(self.course, self.other)
        data = self.client.get("/api/v1/website/intakes/next/").data["intake"]
        self.assertEqual([course["id"] for course in data["available_courses"]], [self.course.pk])
        self.assertNotIn("courses", data)

    def test_only_admin_can_change_dates_or_availability(self):
        row = self.intake()
        url = f"/api/v1/website/intakes/{row.pk}/"
        self.assertIn(self.client.patch(url, {"title": "Changed"}).status_code, (401, 403))
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.client.patch(url, {"title": "Changed"}).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(url, {"title": "Confirmed intake"}).status_code, 200)

    def test_admin_validation_rejects_invalid_dates_or_active_empty_courses(self):
        self.client.force_authenticate(self.admin)
        base = {"title": "New intake", "starts_on": "2027-04-09", "ends_on": "2027-03-01"}
        response = self.client.post("/api/v1/website/intakes/", base, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("ends_on", response.data)
        response = self.client.post("/api/v1/website/intakes/", {**base, "ends_on": "2027-06-26", "is_active": True}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("courses", response.data)

    @patch("apps.website.intakes.timezone.localdate", return_value=date(2027, 2, 1))
    def test_profile_reports_same_next_intake_without_overwriting_manual_fallback(self, _today):
        profile = AcademyProfile.objects.create(next_cohort_start=date(2026, 11, 1))
        row = self.intake()
        data = self.client.get("/api/v1/website/profile/").data
        self.assertTrue(data["intakes_managed"])
        self.assertEqual(data["next_intake"]["id"], row.pk)
        profile.refresh_from_db()
        self.assertEqual(profile.next_cohort_start, date(2026, 11, 1))

    def test_seed_preserves_dates_and_keeps_all_four_drafts(self):
        call_command("seed_intakes_2027", verbosity=0)
        call_command("seed_intakes_2027", verbosity=0)
        self.assertEqual(AcademyIntake.objects.count(), 4)
        self.assertFalse(AcademyIntake.objects.filter(is_active=True).exists())
        self.assertEqual(list(AcademyIntake.objects.values_list("starts_on", flat=True)), [date(2027, 1, 8), date(2027, 4, 9), date(2027, 7, 9), date(2027, 10, 8)])
