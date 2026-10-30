"""The curriculum seeder creates reviewable drafts exactly once."""

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.courses.models import Course, Lesson, Module

User = get_user_model()


class CurriculumSeedTests(TestCase):
    def setUp(self):
        self.tutor = User.objects.create_user(
            email="tutor@vaceup.ng", password="x", full_name="Tutor",
            role=User.Role.INSTRUCTOR, is_active=True,
        )

    def _seed(self):
        call_command(
            "seed_curriculum", "--apply",
            "--instructor-email", self.tutor.email, verbosity=0,
        )

    def test_seeds_every_course_as_a_draft(self):
        self._seed()
        self.assertEqual(Course.objects.count(), 12)
        self.assertFalse(Course.objects.filter(is_published=True).exists())
        self.assertEqual(Module.objects.count(), 100)
        self.assertEqual(Lesson.objects.count(), 56)
        coding = Course.objects.get(slug="coding")
        self.assertEqual(str(coding.price), "80000.00")
        self.assertEqual(coding.instructor, self.tutor)
        kids = Course.objects.get(slug="kids-coding")
        self.assertEqual(str(kids.price), "50000.00")
        self.assertTrue(kids.category.name == "Kids Tech Academy")

    def test_modules_are_numbered_by_week(self):
        self._seed()
        course = Course.objects.get(slug="coding")
        weeks = list(course.modules.order_by("order").values_list("week", flat=True))
        self.assertEqual(weeks, list(range(1, 11)))
        self.assertFalse(course.modules.exclude(meeting_url="").exists())

    def test_repeat_runs_do_not_duplicate_content(self):
        self._seed()
        self._seed()
        self.assertEqual(Course.objects.count(), 12)
        self.assertEqual(Module.objects.count(), 100)
        self.assertEqual(Lesson.objects.count(), 56)

    def test_missing_tutor_is_rejected(self):
        with self.assertRaisesMessage(Exception, "No active tutor"):
            call_command(
                "seed_curriculum", "--apply",
                "--instructor-email", "nobody@vaceup.ng", verbosity=0,
            )

    def test_preview_writes_nothing(self):
        call_command("seed_curriculum", verbosity=0)
        self.assertEqual(Course.objects.count(), 0)
