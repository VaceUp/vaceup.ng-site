"""End-to-end tests for the register -> verify -> login -> reset flow.

Run with the project's normal test runner:
    python manage.py test apps.accounts
"""
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.accounts.models import (
    EmailVerificationToken,
    PasswordResetToken,
    StudentProfile,
)

User = get_user_model()

REG = "/api/v1/auth/register/"
VERIFY = "/api/v1/auth/verify-email/"
RESEND = "/api/v1/auth/resend-verification/"
LOGIN = "/api/v1/auth/login/"
RESET = "/api/v1/auth/password-reset/"
RESET_CONFIRM = "/api/v1/auth/password-reset/confirm/"
ME = "/api/v1/auth/me/"

EMAIL = "learner@example.com"
PW1 = "Str0ng-Passw0rd!x"
PW2 = "An0ther-Passw0rd!y"


# SSL redirect is on in production settings; disable it for the HTTP test client.
@override_settings(SECURE_SSL_REDIRECT=False)
class AuthFlowTests(APITestCase):
    def setUp(self):
        # Throttle counters live in the cache; reset them between tests so the
        # scoped auth throttles don't bleed across methods.
        from django.core.cache import cache

        cache.clear()

    def _register(self, email=EMAIL, password=PW1, full_name="Ada Learner"):
        # Flush transaction.on_commit callbacks (verification email) inside the
        # test transaction, which otherwise never commits.
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                REG,
                {"email": email, "full_name": full_name, "password": password},
                format="json",
            )

    # --- registration -------------------------------------------------------
    def test_register_creates_inactive_user_with_profile_and_email(self):
        r = self._register()
        self.assertEqual(r.status_code, 201)
        user = User.objects.get(email=EMAIL)
        self.assertFalse(user.is_active)
        self.assertEqual(user.role, User.Role.STUDENT)
        self.assertTrue(StudentProfile.objects.filter(user=user).exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(EmailVerificationToken.objects.filter(user=user).count(), 1)

    def test_register_forces_student_role_even_if_client_sends_admin(self):
        r = self.client.post(
            REG,
            {"email": EMAIL, "full_name": "Sneaky", "password": PW1,
             "role": "admin", "is_staff": True, "is_superuser": True},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        user = User.objects.get(email=EMAIL)
        self.assertEqual(user.role, User.Role.STUDENT)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_duplicate_email_is_rejected(self):
        self._register()
        r = self._register(full_name="Dupe")
        self.assertIn(r.status_code, (400, 409))

    def test_weak_password_is_rejected(self):
        r = self._register(password="123")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(email=EMAIL).exists())

    # --- verification -------------------------------------------------------
    def test_login_blocked_until_verified_with_clear_message(self):
        self._register()
        r = self.client.post(LOGIN, {"email": EMAIL, "password": PW1},
                             format="json")
        self.assertEqual(r.status_code, 401)
        self.assertIn("not verified", str(r.data).lower())

    def test_verify_activates_and_consumes_token(self):
        self._register()
        tok = EmailVerificationToken.objects.get(user__email=EMAIL)
        r = self.client.post(VERIFY, {"token": str(tok.token)}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(User.objects.get(email=EMAIL).is_active)
        tok.refresh_from_db()
        self.assertTrue(tok.used)

    def test_verify_token_is_single_use(self):
        self._register()
        tok = EmailVerificationToken.objects.get(user__email=EMAIL)
        self.client.post(VERIFY, {"token": str(tok.token)}, format="json")
        again = self.client.post(VERIFY, {"token": str(tok.token)}, format="json")
        self.assertEqual(again.status_code, 400)

    def test_invalid_verify_token_rejected(self):
        r = self.client.post(
            VERIFY, {"token": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_resend_verification_issues_fresh_token(self):
        self._register()
        old = EmailVerificationToken.objects.get(user__email=EMAIL)
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client.post(RESEND, {"email": EMAIL}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        old.refresh_from_db()
        self.assertTrue(old.used)  # previous token invalidated
        self.assertEqual(
            EmailVerificationToken.objects.filter(
                user__email=EMAIL, used=False).count(), 1)

    # --- login + me ---------------------------------------------------------
    def _verified_user(self):
        self._register()
        tok = EmailVerificationToken.objects.get(user__email=EMAIL)
        self.client.post(VERIFY, {"token": str(tok.token)}, format="json")

    def test_login_returns_tokens_and_user_then_me_works(self):
        self._verified_user()
        r = self.client.post(LOGIN, {"email": EMAIL, "password": PW1},
                             format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)
        self.assertEqual(r.data["user"]["email"], EMAIL)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        me = self.client.get(ME)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], EMAIL)

    def test_me_requires_auth(self):
        self.assertEqual(self.client.get(ME).status_code, 401)

    # --- password reset -----------------------------------------------------
    def test_password_reset_end_to_end(self):
        self._verified_user()
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client.post(RESET, {"email": EMAIL}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        rtok = PasswordResetToken.objects.get(user__email=EMAIL)
        r = self.client.post(
            RESET_CONFIRM,
            {"token": str(rtok.token), "new_password": PW2}, format="json")
        self.assertEqual(r.status_code, 200)

        self.assertEqual(
            self.client.post(LOGIN, {"email": EMAIL, "password": PW1},
                             format="json").status_code, 401)
        self.assertEqual(
            self.client.post(LOGIN, {"email": EMAIL, "password": PW2},
                             format="json").status_code, 200)

    def test_password_reset_does_not_enumerate_accounts(self):
        r = self.client.post(RESET, {"email": "nobody@example.com"},
                             format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(PasswordResetToken.objects.count(), 0)

    def test_reset_token_is_single_use(self):
        self._verified_user()
        self.client.post(RESET, {"email": EMAIL}, format="json")
        rtok = PasswordResetToken.objects.get(user__email=EMAIL)
        self.client.post(RESET_CONFIRM,
                         {"token": str(rtok.token), "new_password": PW2},
                         format="json")
        again = self.client.post(
            RESET_CONFIRM,
            {"token": str(rtok.token), "new_password": "Third-Passw0rd!z"},
            format="json")
        self.assertEqual(again.status_code, 400)
