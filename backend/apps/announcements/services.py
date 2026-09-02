"""Announcement services: recipient calculation, notifications."""
from django.db import models
from django.utils import timezone

from apps.announcements.models import Announcement
from apps.enrollment.models import Enrollment
from apps.accounts.models import User


def get_recipient_count(announcement: Announcement) -> int:
    """Calculate total recipients for an announcement based on target."""
    from django.db.models import Q, Exists, OuterRef

    user_qs = User.objects.filter(is_active=True)

    target = announcement.target

    if announcement.target == Announcement.Target.ALL:
        return User.objects.filter(is_active=True).count()

    elif announcement.target == Announcement.Target.STUDENTS:
        return User.objects.filter(
            is_active=True,
            role=User.Role.STUDENT
        ).count()

    elif announcement.target == Announcement.Target.INSTRUCTORS:
        return User.objects.filter(
            is_active=True,
            role=User.Role.INSTRUCTOR
        ).count()

    elif announcement.target == Announcement.Target.ADMINS:
        return User.objects.filter(
            is_active=True,
            role=User.Role.ADMIN
        ).count()

    elif announcement.target == Announcement.Target.COURSE_STUDENTS:
        if announcement.target_courses.exists():
            return Enrollment.objects.filter(
                course__in=announcement.target_courses.all(),
                status__in=[Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED]
            ).values("student").distinct().count()
        return 0

    elif announcement.target == Announcement.Target.COURSE_INSTRUCTORS:
        if announcement.target_courses.exists():
            return User.objects.filter(
                is_active=True,
                courses_taught__in=announcement.target_courses.all()
            ).distinct().count()
        return 0

    elif announcement.target == Announcement.Target.ENROLLED_USERS:
        if announcement.target_courses.exists():
            return Enrollment.objects.filter(
                course__in=announcement.target_courses.all(),
                status__in=[Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED]
            ).values("student").distinct().count()
        return 0

    return 0


def send_announcement_email(announcement_id: int):
    """Send email notification for announcement (async task)."""
    # TODO: Implement email sending via Celery
    pass


def send_announcement_push(announcement_id: int):
    """Send push notification for announcement (async task)."""
    # TODO: Implement push notification via Celery
    pass


def send_announcement_notifications(announcement_id: int):
    """Send all notifications for an announcement."""
    # TODO: Implement with Celery
    pass