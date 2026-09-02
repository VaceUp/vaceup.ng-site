"""Tests for catalog authoring: categories, courses, modules, lessons.

Focus on the bugs fixed in Phase 0 #3: lesson-create now works, module/category
endpoints exist, ownership is enforced, previews are reachable, slugs are unique.
"""
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollment.models import Enrollment

User = get_user_model()

CATEGORIES = "/api/v1/categories/"
COURSES = "/api/v1/courses/"
MODULES = "/api/v1/modules/"
LESSONS = "/api/v1/lessons/"


@override_settings(SECURE_SSL_REDIRECT=False)
class AuthoringTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()

        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_active=True, is_staff=True)
        self.instr1 = User.objects.create_user(
            email="i1@vaceup.ng", password="x", full_name="Ins One",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.instr2 = User.objects.create_user(
            email="i2@vaceup.ng", password="x", full_name="Ins Two",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s@vaceup.ng", password="x", full_name="Stud",
            role=User.Role.STUDENT, is_active=True)
        self.category = Category.objects.create(name="Programming")

    def _course(self, instructor, title="Py 101", published=False):
        return Course.objects.create(
            title=title, category=self.category, instructor=instructor,
            price=0, is_published=published)

    # --- categories ---------------------------------------------------------
    def test_category_read_is_public(self):
        self.assertEqual(self.client.get(CATEGORIES).status_code, 200)

    def test_only_admin_creates_category(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(
            CATEGORIES, {"name": "Design"}, format="json").status_code, 403)
        self.client.force_authenticate(self.instr1)
        self.assertEqual(self.client.post(
            CATEGORIES, {"name": "Design"}, format="json").status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.post(CATEGORIES, {"name": "Design"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["slug"])  # auto-generated

    # --- courses ------------------------------------------------------------
    def test_instructor_creates_course_bound_to_self(self):
        self.client.force_authenticate(self.instr1)
        r = self.client.post(COURSES, {
            "title": "Django Basics", "category": self.category.id,
            "level": "beginner", "price": "0.00"}, format="json")
        self.assertEqual(r.status_code, 201)
        course = Course.objects.get(id=r.data["id"])
        self.assertEqual(course.instructor_id, self.instr1.id)
        self.assertTrue(course.slug)

    def test_duplicate_titles_get_unique_slugs(self):
        c1 = self._course(self.instr1, title="Same Title")
        c2 = Course.objects.create(
            title="Same Title", category=self.category,
            instructor=self.instr1, price=0)
        self.assertNotEqual(c1.slug, c2.slug)

    # --- modules ------------------------------------------------------------
    def test_instructor_adds_module_to_own_course(self):
        course = self._course(self.instr1)
        self.client.force_authenticate(self.instr1)
        r = self.client.post(MODULES, {
            "course": course.id, "title": "Intro", "order": 1}, format="json")
        self.assertEqual(r.status_code, 201)

    def test_instructor_cannot_add_module_to_foreign_course(self):
        course = self._course(self.instr1)
        self.client.force_authenticate(self.instr2)
        r = self.client.post(MODULES, {
            "course": course.id, "title": "Sneak", "order": 1}, format="json")
        self.assertEqual(r.status_code, 403)

    # --- lessons (the previously-broken endpoint) ---------------------------
    def test_instructor_creates_lesson_under_own_module(self):
        course = self._course(self.instr1)
        module = Module.objects.create(course=course, title="M1", order=1)
        self.client.force_authenticate(self.instr1)
        r = self.client.post(LESSONS, {
            "module": module.id, "title": "L1", "order": 1,
            "content": "hello"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Lesson.objects.filter(id=r.data["id"]).exists())

    def test_instructor_cannot_create_lesson_under_foreign_module(self):
        course = self._course(self.instr1)
        module = Module.objects.create(course=course, title="M1", order=1)
        self.client.force_authenticate(self.instr2)
        r = self.client.post(LESSONS, {
            "module": module.id, "title": "Sneak", "order": 1}, format="json")
        self.assertEqual(r.status_code, 403)

    # --- preview gating -----------------------------------------------------
    def test_preview_lesson_reachable_by_non_enrolled_student(self):
        course = self._course(self.instr1, published=True)
        module = Module.objects.create(course=course, title="M1", order=1)
        preview = Lesson.objects.create(
            module=module, title="Free", order=1, is_preview=True)
        gated = Lesson.objects.create(
            module=module, title="Paid", order=2, is_preview=False)

        self.client.force_authenticate(self.student)
        self.assertEqual(
            self.client.get(f"{LESSONS}{preview.id}/").status_code, 200)
        # Non-preview lesson of a course they're not enrolled in -> hidden.
        self.assertEqual(
            self.client.get(f"{LESSONS}{gated.id}/").status_code, 404)

    # --- course-detail content gating (the paid-content leak fix) -----------
    def _published_course_with_lessons(self):
        course = self._course(self.instr1, published=True)
        module = Module.objects.create(course=course, title="M1", order=1)
        Lesson.objects.create(module=module, title="Free", order=1,
                              content="preview body", video_url="http://v/1",
                              is_preview=True)
        Lesson.objects.create(module=module, title="Paid", order=2,
                              content="secret body", video_url="http://v/2",
                              is_preview=False)
        return course

    def _lessons_by_title(self, response):
        out = {}
        for mod in response.data["modules"]:
            for lesson in mod["lessons"]:
                out[lesson["title"]] = lesson
        return out

    def test_course_detail_hides_gated_content_from_non_enrolled(self):
        course = self._published_course_with_lessons()
        # Anonymous viewer.
        r = self.client.get(f"{COURSES}{course.slug}/")
        self.assertEqual(r.status_code, 200)
        lessons = self._lessons_by_title(r)
        # Preview lesson: fully visible.
        self.assertEqual(lessons["Free"]["content"], "preview body")
        self.assertFalse(lessons["Free"]["locked"])
        # Gated lesson: body redacted, marked locked.
        self.assertEqual(lessons["Paid"]["content"], "")
        self.assertEqual(lessons["Paid"]["video_url"], "")
        self.assertTrue(lessons["Paid"]["locked"])

    def test_enrolled_student_sees_full_content(self):
        course = self._published_course_with_lessons()
        Enrollment.objects.create(student=self.student, course=course,
                                  status=Enrollment.Status.ACTIVE)
        self.client.force_authenticate(self.student)
        r = self.client.get(f"{COURSES}{course.slug}/")
        lessons = self._lessons_by_title(r)
        self.assertEqual(lessons["Paid"]["content"], "secret body")
        self.assertFalse(lessons["Paid"]["locked"])

    def test_owner_instructor_sees_full_content(self):
        course = self._published_course_with_lessons()
        self.client.force_authenticate(self.instr1)
        r = self.client.get(f"{COURSES}{course.slug}/")
        lessons = self._lessons_by_title(r)
        self.assertEqual(lessons["Paid"]["content"], "secret body")
        self.assertFalse(lessons["Paid"]["locked"])
