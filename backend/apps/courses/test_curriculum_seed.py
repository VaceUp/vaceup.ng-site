"""The curriculum seeder creates reviewable drafts with the brief's lessons."""

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.courses.curriculum import CURRICULUM, expected_lessons
from apps.courses.models import Category, Course, Lesson, Module

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
        self.assertEqual(Lesson.objects.count(), 388)
        coding = Course.objects.get(slug="coding")
        self.assertEqual(str(coding.price), "80000.00")
        self.assertEqual(coding.instructor, self.tutor)
        kids = Course.objects.get(slug="kids-coding")
        self.assertEqual(str(kids.price), "50000.00")
        self.assertTrue(kids.category.name == "Kids Tech Academy")

    def test_lesson_count_matches_the_brief(self):
        self._seed()
        expected = sum(expected_lessons(item) for item in CURRICULUM)
        self.assertEqual(Lesson.objects.count(), expected)

    def test_modules_are_numbered_by_week(self):
        self._seed()
        course = Course.objects.get(slug="coding")
        weeks = list(course.modules.order_by("order").values_list("week", flat=True))
        self.assertEqual(weeks, list(range(1, 11)))
        self.assertFalse(course.modules.exclude(meeting_url="").exists())

    def test_every_topic_becomes_a_lesson(self):
        self._seed()
        course = Course.objects.get(slug="virtual-assistant")
        module = course.modules.get(title="Introduction to Virtual Assistance")
        titles = list(module.lessons.order_by("order").values_list("title", flat=True))
        self.assertEqual(
            titles,
            [
                "What is Virtual Assistance?", "The role of a Virtual Assistant",
                "Types of Virtual Assistants", "VA services", "Remote work fundamentals",
                "Understanding clients", "Professional expectations",
                "Skills required for VA success",
            ],
        )

    def test_module_practical_closes_the_last_lesson(self):
        self._seed()
        course = Course.objects.get(slug="coding")
        module = course.modules.get(title="Programming Fundamentals")
        last = module.lessons.order_by("order").last()
        self.assertIn("Practical:", last.content)
        self.assertIn("simple interactive program", last.content)
        self.assertEqual(module.lessons.count(), 12)

    def test_a_module_without_topics_holds_its_note_only(self):
        self._seed()
        course = Course.objects.get(slug="kids-artificial-intelligence")
        module = course.modules.get(title="Prompting AI")
        self.assertEqual(module.lessons.count(), 1)
        self.assertIn("clear instructions to AI", module.lessons.first().content)

    def test_the_outline_lists_every_module_and_topic(self):
        self._seed()
        course = Course.objects.get(slug="data-analysis")
        self.assertIn("Week 1 - Introduction to Data Analysis", course.outline)
        self.assertIn("- What is data?", course.outline)
        self.assertIn("Week 8 - Data Portfolio", course.outline)

    def test_repeat_runs_do_not_duplicate_content(self):
        self._seed()
        self._seed()
        self.assertEqual(Course.objects.count(), 12)
        self.assertEqual(Module.objects.count(), 100)
        self.assertEqual(Lesson.objects.count(), 388)

    def test_published_courses_are_left_for_the_sync_command(self):
        category = Category.objects.create(name="Professional Skills", slug="professional-skills")
        course = Course.objects.create(
            slug="virtual-assistant", title="Virtual Assistant",
            category=category, instructor=self.tutor, price=50000,
            duration="3 Months", is_published=True,
        )
        self._seed()
        course.refresh_from_db()
        self.assertEqual(course.price, 50000)
        self.assertEqual(course.duration, "3 Months")
        self.assertEqual(course.modules.count(), 0)

    def test_missing_tutor_is_rejected(self):
        with self.assertRaisesMessage(Exception, "No active tutor"):
            call_command(
                "seed_curriculum", "--apply",
                "--instructor-email", "nobody@vaceup.ng", verbosity=0,
            )

    def test_preview_writes_nothing(self):
        call_command("seed_curriculum", verbosity=0)
        self.assertEqual(Course.objects.count(), 0)
