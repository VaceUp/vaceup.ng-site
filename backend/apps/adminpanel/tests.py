"""Regression coverage for admin failures reported by the live server."""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase


@override_settings(SECURE_SSL_REDIRECT=False)
class AdminReadTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = get_user_model().objects.create_superuser("operator@example.com", "local-test-password")
        self.client.force_authenticate(self.admin)

    def test_course_create_list_update_match_database_schema(self):
        from apps.courses.models import Category
        category = Category.objects.create(name="Design")
        tutor = get_user_model().objects.create_user("tutor@example.com", "test-password", role="instructor", is_active=True)
        response = self.client.post("/api/v1/admin/dashboard/courses/create/", {
            "title": "Real course", "category_id": category.pk, "instructor_id": tutor.pk,
            "price": "120000.00", "duration": "8 weeks", "is_published": False,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.client.get("/api/v1/admin/dashboard/courses/").status_code, 200)
        course_id = response.data["id"]
        self.assertEqual(self.client.post("/api/v1/admin/dashboard/courses/update/", {"course_id": course_id, "price": "-1"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/admin/dashboard/courses/update/", {"course_id": course_id, "is_published": True}, format="json").status_code, 200)
        self.client.force_authenticate(None)
        listing = self.client.get("/api/v1/courses/").data["results"]
        self.assertEqual(len(listing), 1)
        self.assertEqual(listing[0]["category"], "Design")
        self.assertEqual(listing[0]["price"], "120000.00")
        self.assertEqual(listing[0]["duration"], "8 weeks")

    def test_category_rename_preserves_course_and_draft_stays_private(self):
        from apps.courses.models import Course, Category
        category = Category.objects.create(name="Design")
        tutor = get_user_model().objects.create_user("tutor@example.com", "test-password", role="instructor", is_active=True)
        course = Course.objects.create(title="Draft course", category=category, instructor=tutor)
        response = self.client.patch(f"/api/v1/categories/{category.slug}/", {"name": "Creative Design"}, format="json")
        self.assertEqual(response.status_code, 200)
        course.refresh_from_db()
        self.assertEqual(course.category.name, "Creative Design")
        invalid_tutor = self.client.post("/api/v1/admin/dashboard/courses/update/", {"course_id": course.pk, "instructor": self.admin.pk}, format="json")
        self.assertEqual(invalid_tutor.status_code, 400)
        updated = self.client.post("/api/v1/admin/dashboard/courses/update/", {"course_id": course.pk, "instructor": tutor.pk, "duration": "8 weeks"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/v1/courses/").data["results"], [])
        self.assertEqual(self.client.get(f"/api/v1/courses/{course.slug}/").status_code, 404)

    def test_homepage_import_preview_idempotency_and_no_overwrites(self):
        from django.core.management import call_command, CommandError
        from apps.courses.models import Course, Category, Lesson
        from io import StringIO
        out = StringIO()
        call_command("import_homepage_catalog", stdout=out)
        self.assertEqual(Course.objects.count(), 0)
        with self.assertRaises(CommandError):
            call_command("import_homepage_catalog", apply=True, stdout=out)
        tutor = get_user_model().objects.create_user("tutor@example.com", "test-password", role="instructor", is_active=True)
        call_command("import_homepage_catalog", apply=True, instructor_email=tutor.email, stdout=out)
        self.assertEqual(Course.objects.count(), 12)
        self.assertEqual(Category.objects.count(), 6)
        # The import writes the brief's structure, not a condensed outline.
        self.assertEqual(
            Lesson.objects.filter(module__course__slug="virtual-assistant").count(), 62
        )
        Course.objects.filter(slug="virtual-assistant").update(price="999", is_published=True)
        call_command("import_homepage_catalog", apply=True, instructor_email=tutor.email, stdout=out)
        self.assertEqual(Course.objects.count(), 12)
        self.assertEqual(Course.objects.filter(is_published=False).count(), 11)
        self.assertEqual(str(Course.objects.get(slug="virtual-assistant").price), "999.00")

    def test_payments_list_has_model_import(self):
        response = self.client.get("/api/v1/admin/dashboard/payments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_users_list_orders_on_existing_date_field(self):
        response = self.client.get("/api/v1/admin/dashboard/users/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["email"], self.admin.email)

    def test_admin_tables_are_available_after_migration(self):
        for path in ("/api/v1/admin/settings/", "/api/v1/admin/announcements/", "/api/v1/admin/actions/"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 200)

    def test_admin_reads_reject_student(self):
        student = get_user_model().objects.create_user("student@example.com", "local-test-password", is_active=True)
        self.client.force_authenticate(student)
        for path in ("/api/v1/admin/settings/", "/api/v1/admin/announcements/", "/api/v1/admin/dashboard/payments/"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 403)

    def test_kids_admission_review_creates_kids_enrollment(self):
        from apps.courses.models import Category, Course
        from apps.kidsacademy.models import KidsAdmission, KidsEnrollment, KidsLearner, KidsParentProfile

        parent = get_user_model().objects.create_user(
            "kids-parent@example.com", "parent-password", full_name="Kids Parent",
            role="student", academy_scope="kids", is_active=True,
        )
        parent_profile = KidsParentProfile.objects.create(user=parent, relationship="Parent")
        learner = KidsLearner.objects.create(parent=parent_profile, full_name="Young Learner")
        tutor = get_user_model().objects.create_user(
            "kids-tutor@example.com", "tutor-password", role="instructor", is_active=True,
        )
        course = Course.objects.create(
            title="Creative Coding", slug="creative-coding", category=Category.objects.create(
                name="Kids Tech Academy", slug="kids-tech-academy",
            ), instructor=tutor, is_published=True,
        )
        admission = KidsAdmission.objects.create(
            parent=parent_profile, learner=learner, course=course,
        )

        listing = self.client.get("/api/v1/admin/dashboard/kids/admissions/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data[0]["learner_name"], "Young Learner")
        reviewed = self.client.post(
            "/api/v1/admin/dashboard/kids/admissions/review/",
            {"admission_id": admission.pk, "action": "approve"}, format="json",
        )
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.assertEqual(reviewed.data["status"], KidsAdmission.Status.APPROVED)
        self.assertTrue(KidsEnrollment.objects.filter(admission=admission).exists())
        self.assertEqual(self.client.get("/api/v1/admin/dashboard/").data["kids"]["active_enrollments"], 1)
