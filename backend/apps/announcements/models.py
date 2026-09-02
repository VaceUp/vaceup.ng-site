"""Announcements system for course-wide and academy-wide communications."""
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.courses.models import Course


class Announcement(TimeStampedModel):
    """System-wide or course-specific announcements."""

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
        COURSE_STUDENTS = "course_students", _("Students in Specific Course")
        COURSE_INSTRUCTORS = "course_instructors", _("Instructors of Specific Course")
        ENROLLED_USERS = "enrolled_users", _("Enrolled Users (Students + Instructors)")

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        SCHEDULED = "scheduled", _("Scheduled")
        PUBLISHED = "published", _("Published")
        ARCHIVED = "archived", _("Archived")

    title = models.CharField(max_length=200)
    body = models.TextField(help_text="Rich text/Markdown content")

    # Targeting
    target = models.CharField(
        max_length=30,
        choices=Target.choices,
        default=Target.ALL,
        db_index=True,
    )
    target_courses = models.ManyToManyField(
        Course,
        blank=True,
        related_name="targeted_announcements",
        help_text="Courses to target when target is course_students, course_instructors, or enrolled_users",
    )

    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.NORMAL,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    # Scheduling
    publish_at = models.DateTimeField(null=True, blank=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # Author
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="authored_announcements",
        limit_choices_to={"role__in": ["admin", "instructor"]},
    )

    # Delivery tracking
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    push_sent = models.BooleanField(default=False)
    push_sent_at = models.DateTimeField(null=True, blank=True)

    # Display options
    pin_to_top = models.BooleanField(default=False)
    allow_comments = models.BooleanField(default=True)
    send_email = models.BooleanField(default=True)
    send_push = models.BooleanField(default=True)

    class Meta:
        ordering = ("-pin_to_top", "-publish_at", "-created_at")
        indexes = [
            models.Index(fields=["status", "publish_at"]),
            models.Index(fields=["target", "status"]),
            models.Index(fields=["author", "status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"

    @property
    def is_published(self):
        if self.status != self.Status.PUBLISHED:
            return False
        if self.publish_at and self.publish_at > timezone.now():
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True


class AnnouncementReadReceipt(TimeStampedModel):
    """Track which users have read an announcement."""

    announcement = models.ForeignKey(
        "Announcement",
        on_delete=models.CASCADE,
        related_name="read_receipts",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="announcement_reads",
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-read_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["announcement", "user"],
                name="unique_announcement_read",
            )
        ]
        indexes = [
            models.Index(fields=["announcement", "user"]),
        ]

    def __str__(self):
        return f"{self.user} read {self.announcement}"


class AnnouncementComment(TimeStampedModel):
    """Comments on announcements (if enabled)."""

    announcement = models.ForeignKey(
        "Announcement",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="announcement_comments",
    )
    body = models.TextField()
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["announcement", "-created_at"]),
        ]

    def __str__(self):
        return f"Comment by {self.author} on {self.announcement}"