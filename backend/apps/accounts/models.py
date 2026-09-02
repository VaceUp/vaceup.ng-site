"""Custom, email-based User model with role-based identity.

Also holds the account-lifecycle support tables: per-role profiles and the
single-use, expiring tokens that back email verification and password reset.
"""
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel

# Token lifetimes (overridable in settings without a migration).
EMAIL_VERIFICATION_TTL = getattr(
    settings, "EMAIL_VERIFICATION_TTL", timedelta(hours=24)
)
PASSWORD_RESET_TTL = getattr(
    settings, "PASSWORD_RESET_TTL", timedelta(hours=1)
)


class UserManager(BaseUserManager):
    """Manager for the email-as-username custom User model."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError(_("Users must have an email address."))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # hashes via the configured password hasher
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.STUDENT)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.update(
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """One user table; ``role`` distinguishes Admin / Instructor / Student."""

    class Role(models.TextChoices):
        ADMIN = "admin", _("Admin")
        INSTRUCTOR = "instructor", _("Instructor")
        STUDENT = "student", _("Student")

    email = models.EmailField(_("email address"), unique=True)  # unique => indexed
    full_name = models.CharField(_("full name"), max_length=150, blank=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        db_index=True,
    )
    # is_active flips to True only after email verification.
    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)  # Django admin access
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]  # prompted by createsuperuser

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        indexes = [models.Index(fields=["role", "is_active"])]

    def __str__(self):
        return f"{self.full_name or self.email} ({self.role})"

    # Role predicates keep permission checks elsewhere terse and readable.
    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_instructor(self) -> bool:
        return self.role == self.Role.INSTRUCTOR

    @property
    def is_student(self) -> bool:
        return self.role == self.Role.STUDENT


class StudentProfile(TimeStampedModel):
    """Student-specific attributes (ERD: STUDENT_PROFILE)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )
    country = models.CharField(max_length=80, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    guardian_name = models.CharField(max_length=150, blank=True)

    def __str__(self):
        return f"StudentProfile<{self.user_id}>"


class TutorProfile(TimeStampedModel):
    """Tutor-specific attributes (ERD: TUTOR_PROFILE)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tutor_profile",
    )
    expertise = models.CharField(max_length=200, blank=True)
    years_experience = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"TutorProfile<{self.user_id}>"


class _BaseAccountToken(TimeStampedModel):
    """Shared base for single-use, expiring account tokens.

    The ``token`` is a random UUID4 (122 bits of entropy) that travels in the
    emailed link and is looked up directly. It is single-use (``used``) and
    time-boxed (``expires_at``). For defense-in-depth you may later store only
    a hash of the token instead of the value; the flow does not change.
    """

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        abstract = True
        ordering = ("-created_at",)

    # Subclasses set this to the relevant TTL.
    TTL = timedelta(hours=1)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + self.TTL
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        return (not self.used) and timezone.now() < self.expires_at

    def consume(self):
        """Mark the token used exactly once."""
        self.used = True
        self.save(update_fields=["used", "updated_at"])


class EmailVerificationToken(_BaseAccountToken):
    """One-time token that flips ``User.is_active`` to True."""

    TTL = EMAIL_VERIFICATION_TTL

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification_tokens",
    )

    class Meta(_BaseAccountToken.Meta):
        indexes = [models.Index(fields=["user", "used"])]

    def __str__(self):
        return f"verify<{self.user_id}> used={self.used}"


class PasswordResetToken(_BaseAccountToken):
    """One-time token that authorizes a password change."""

    TTL = PASSWORD_RESET_TTL

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )

    class Meta(_BaseAccountToken.Meta):
        indexes = [models.Index(fields=["user", "used"])]

    def __str__(self):
        return f"reset<{self.user_id}> used={self.used}"
