"""Admin Panel models for audit logs and admin actions."""
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class AdminActionLog(TimeStampedModel):
    """Audit log for admin actions."""

    class ActionType(models.TextChoices):
        USER_CREATE = "user_create", _("User Created")
        USER_UPDATE = "user_update", _("User Updated")
        USER_DEACTIVATE = "user_deactivate", _("User Deactivated")
        USER_ACTIVATE = "user_activate", _("User Activated")
        USER_PROMOTE = "user_promote", _("User Promoted")
        USER_DEMOTE = "user_demote", _("User Demoted")
        COURSE_CREATE = "course_create", _("Course Created")
        COURSE_UPDATE = "course_update", _("Course Updated")
        COURSE_PUBLISH = "course_publish", _("Course Published")
        COURSE_UNPUBLISH = "course_unpublish", _("Course Unpublished")
        COURSE_DELETE = "course_delete", _("Course Deleted")
        COURSE_BULK_PRICE = "course_bulk_price", _("Bulk Price Update")
        TUTOR_INVITE = "tutor_invite", _("Tutor Invited")
        TUTOR_CREATE = "tutor_create", _("Tutor Created")
        TUTOR_UPDATE = "tutor_update", _("Tutor Updated")
        STAFF_DEACTIVATE = "staff_deactivate", _("Staff Deactivated")
        STAFF_ACTIVATE = "staff_activate", _("Staff Activated")
        STAFF_PROMOTE = "staff_promote", _("Staff Promoted")
        APPLICATION_REVIEW = "application_review", _("Application Reviewed")
        ANNOUNCEMENT_CREATE = "announcement_create", _("Announcement Created")
        SETTINGS_UPDATE = "settings_update", _("Settings Updated")

    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="admin_actions",
        limit_choices_to={"role__in": ["admin", "instructor"]},
    )
    action_type = models.CharField(
        max_length=30, choices=ActionType.choices, db_index=True
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_actions_on_me",
    )
    target_course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_actions",
    )
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["admin", "-created_at"]),
            models.Index(fields=["action_type", "-created_at"]),
            models.Index(fields=["target_user", "-created_at"]),
            models.Index(fields=["target_course", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.admin} - {self.action_type} at {self.created_at}"


class AdminSettings(TimeStampedModel):
    """Global admin settings (singleton)."""

    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)  # Whether frontend can read

    class Meta:
        ordering = ("key",)

    def __str__(self):
        return self.key


class SystemAnnouncement(TimeStampedModel):
    """System-wide announcements."""

    class Priority(models.TextChoices):
        LOW = "low", _("Low")
        NORMAL = "normal", _("Normal")
        HIGH = "high", _("High")
        CRITICAL = "critical", _("Critical")

    class Target(models.TextChoices):
        ALL = "all", _("All Users")
        STUDENTS = "students", _("Students Only")
        INSTRUCTORS = "instructors", _("Instructors Only")
        ADMINS = "admins", _("Admins Only")

    title = models.CharField(max_length=200)
    body = models.TextField()
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.NORMAL
    )
    target = models.CharField(
        max_length=20, choices=Target.choices, default=Target.ALL
    )
    is_published = models.BooleanField(default=False)
    publish_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="system_announcements",
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["is_published", "publish_at"]),
            models.Index(fields=["target", "is_published"]),
        ]

    def __str__(self):
        return self.title