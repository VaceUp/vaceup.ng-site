"""The sync command brings a live course in line with the curriculum brief."""

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollment.models import Enrollment, LessonProgress

User = get_user_model()

# The shape the catalogue carried before the brief: eight modules, three
# lessons each, and module titles that carry their own numbering.
LIVE_MODULES = [
    ("Module 1: Introduction to Virtual Assistance", "What Is Virtual Assistance?"),
    ("Module 2: Professional Communication", "Professional Email Structure"),
    ("Module 3: Administrative and Calendar Management", "Email and Inbox Organisation"),
    ("Module 4: Digital Productivity Tools", "Documents and Spreadsheets"),
    ("Module 5: Online Research and Information Management", "Planning Online Research"),
    ("Module 6: Customer Service and Client Support", "Understanding Customer Needs"),
    ("Module 7: Task and Project Management", "Prioritization and Time Management"),
    ("Module 8: Professional Practice and Portfolio Development", "Client Briefs"),
]


class CurriculumSyncTests(TestCase):
    def setUp(self):
        self.tutor = User.objects.create_user(
            email="tutor@vaceup.ng", password="x", full_name="Tutor",
            role=User.Role.INSTRUCTOR, is_active=True,
        )
        self.student = User.objects.create_user(
            email="student@vaceup.ng", password="x", full_name="Student",
            role=User.Role.STUDENT, is_active=True,
        )
        category = Category.objects.create(name="Professional Skills", slug="professional-skills")
        self.course = Course.objects.create(
            slug="virtual-assistant", title="Virtual Assistant", category=category,
            instructor=self.tutor, price=50000, duration="3 Months",
            is_published=True,
        )
        for index, (title, lesson_title) in enumerate(LIVE_MODULES):
            module = Module.objects.create(
                course=self.course, title=title, order=index, week=1,
            )
            Lesson.objects.create(
                module=module, title=lesson_title,
                content="A written lesson from the old catalogue.", order=0,
            )

    def _sync(self, *args):
        call_command("sync_curriculum", *args, verbosity=0)

    def test_report_alone_writes_nothing(self):
        self._sync()
        self.course.refresh_from_db()
        self.assertEqual(self.course.price, 50000)
        self.assertEqual(self.course.duration, "3 Months")
        self.assertEqual(self.course.modules.count(), 8)

    def test_apply_replaces_the_old_modules_with_the_brief(self):
        self._sync("--apply", "--replace-modules")
        self.course.refresh_from_db()
        titles = list(self.course.modules.order_by("order").values_list("title", flat=True))
        self.assertEqual(
            titles,
            [
                "Introduction to Virtual Assistance", "Professional Communication",
                "Administrative Support", "Digital Productivity Tools",
                "Research & Information Management", "Customer & Client Support",
                "Project & Task Management", "Becoming a Professional VA",
            ],
        )
        self.assertEqual(self.course.duration, "8 Weeks")
        self.assertIn("Week 1 - Introduction to Virtual Assistance", self.course.outline)
        self.assertIn("- What is Virtual Assistance?", self.course.outline)

    def test_apply_gives_every_topic_its_lesson(self):
        self._sync("--apply", "--replace-modules")
        module = self.course.modules.get(title="Introduction to Virtual Assistance")
        titles = list(module.lessons.order_by("order").values_list("title", flat=True))
        self.assertEqual(len(titles), 8)
        # The old lesson differs from the brief only in casing, so it is kept
        # in place rather than duplicated.
        self.assertEqual(titles[0].lower(), "what is virtual assistance?")
        self.assertEqual(titles[-1], "Skills required for VA success")

    def test_apply_leaves_the_price_alone_unless_asked(self):
        self._sync("--apply", "--replace-modules")
        self.course.refresh_from_db()
        self.assertEqual(self.course.price, 50000)

    def test_set_prices_uses_the_brief_price(self):
        self._sync("--apply", "--replace-modules", "--set-prices")
        self.course.refresh_from_db()
        self.assertEqual(str(self.course.price), "70000.00")

    def test_a_module_with_student_progress_is_kept(self):
        module = self.course.modules.get(title="Module 8: Professional Practice and Portfolio Development")
        enrollment = Enrollment.objects.create(student=self.student, course=self.course)
        LessonProgress.objects.create(enrollment=enrollment, lesson=module.lessons.first())
        self._sync("--apply", "--replace-modules")
        self.assertTrue(
            Module.objects.filter(title="Module 8: Professional Practice and Portfolio Development").exists()
        )

    def test_a_second_run_adds_nothing(self):
        self._sync("--apply", "--replace-modules")
        before = (
            self.course.modules.count(),
            Lesson.objects.filter(module__course=self.course).count(),
        )
        self._sync("--apply", "--replace-modules")
        self.course.refresh_from_db()
        after = (
            self.course.modules.count(),
            Lesson.objects.filter(module__course=self.course).count(),
        )
        self.assertEqual(before, after)

    def test_courses_missing_from_the_catalogue_are_reported(self):
        self._sync("--apply")
        self.assertEqual(Course.objects.count(), 1)
