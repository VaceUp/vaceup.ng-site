from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.accounts.models import EmailVerificationToken
from apps.courses.models import Category, Course
from apps.accounts.models import User

from .models import KidsAdmission, KidsLearner, KidsParentProfile


@override_settings(SECURE_SSL_REDIRECT=False)
class KidsAcademyAuthAndAdmissionTests(APITestCase):
    def setUp(self):
        self.email = "parent@example.com"
        self.password = "Str0ng-Passw0rd!x"

    def register_and_login(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/kids/auth/register/",
                {
                    "email": self.email,
                    "full_name": "Ada Parent",
                    "password": self.password,
                    "phone": "+2348000000000",
                    "relationship": "Parent",
                },
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email=self.email)
        self.assertTrue(user.is_kids_only)
        self.assertTrue(KidsParentProfile.objects.filter(user=user).exists())
        token = EmailVerificationToken.objects.get(user=user)
        self.client.post("/api/v1/kids/auth/verify-email/", {"token": str(token.token)}, format="json")
        login = self.client.post(
            "/api/v1/kids/auth/login/",
            {"email": self.email, "password": self.password},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data["access"].startswith("kids_"))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        return user

    def test_parent_registration_uses_kids_email_and_scope(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/kids/auth/register/",
                {"email": self.email, "full_name": "Ada Parent", "password": self.password},
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get(email=self.email).academy_scope, User.AcademyScope.KIDS)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Kids Academy", mail.outbox[0].subject)

    def test_generic_resend_keeps_kids_link_inside_kids_site(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                "/api/v1/kids/auth/register/",
                {"email": self.email, "full_name": "Ada Parent", "password": self.password},
                format="json",
            )
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post("/api/v1/auth/resend-verification/", {"email": self.email}, format="json")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("kids.vaceup.ng/verify-email", mail.outbox[0].body)

    def test_kids_session_and_adult_login_are_separate(self):
        self.register_and_login()
        me = self.client.get("/api/v1/kids/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["parent"]["email"], self.email)
        adult_login = self.client.post(
            "/api/v1/auth/login/", {"email": self.email, "password": self.password}, format="json"
        )
        self.assertEqual(adult_login.status_code, 401)
        self.assertIn("Kids Academy", str(adult_login.data))

    def test_parent_creates_learner_and_submits_kids_admission(self):
        self.register_and_login()
        learner_response = self.client.post(
            "/api/v1/kids/learners/",
            {"full_name": "Sam Parent", "preferred_name": "Sam", "date_of_birth": "2014-05-12"},
            format="json",
        )
        self.assertEqual(learner_response.status_code, 201)
        category = Category.objects.create(name="Kids Tech Academy", slug="kids-tech-academy")
        tutor = User.objects.create_user(
            "kids-tutor@example.com", "Tutor-Passw0rd!x", full_name="Kids Tutor",
            role=User.Role.INSTRUCTOR, is_active=True,
        )
        course = Course.objects.create(
            title="Creative Coding", slug="creative-coding", category=category,
            instructor=tutor, description="Build a game.", price=0, is_published=True,
        )
        programs = self.client.get("/api/v1/kids/programs/")
        self.assertEqual(programs.status_code, 200)
        self.assertEqual(programs.data[0]["slug"], "creative-coding")
        admission = self.client.post(
            "/api/v1/kids/admissions/",
            {"learner": learner_response.data["id"], "course": course.id, "payment_preference": "pay_later"},
            format="json",
        )
        self.assertEqual(admission.status_code, 201)
        self.assertEqual(admission.data["status"], KidsAdmission.Status.SUBMITTED)
        self.assertEqual(KidsLearner.objects.count(), 1)
