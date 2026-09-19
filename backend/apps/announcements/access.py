"""Shared publication and audience policy for every announcement read path."""
from django.db.models import Q
from django.utils import timezone
from apps.announcements.models import Announcement
from apps.enrollment.models import Enrollment


def visible_announcements(user):
    qs = Announcement.objects.select_related("author").prefetch_related("target_courses")
    if not user or not user.is_authenticated or not user.is_active:
        return qs.none()
    if user.is_admin:
        return qs
    now = timezone.now()
    qs = qs.filter(status=Announcement.Status.PUBLISHED, publish_at__lte=now).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    )
    audience = Q(target=Announcement.Target.ALL)
    if user.is_instructor:
        audience |= Q(target=Announcement.Target.INSTRUCTORS)
        audience |= Q(target__in=(Announcement.Target.COURSE_INSTRUCTORS, Announcement.Target.ENROLLED_USERS), target_courses__instructor=user)
    elif user.is_student:
        enrolled = Enrollment.objects.filter(student=user, status__in=("active", "completed")).values("course_id")
        audience |= Q(target=Announcement.Target.STUDENTS)
        audience |= Q(target__in=(Announcement.Target.COURSE_STUDENTS, Announcement.Target.ENROLLED_USERS), target_courses__in=enrolled)
    return qs.filter(audience).distinct()
