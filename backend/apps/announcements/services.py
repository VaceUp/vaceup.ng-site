"""Audience-scoped announcement email using the existing durable database outbox."""
from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q, Exists, OuterRef
from django.utils import timezone
from apps.accounts.models import User, MailJob
from apps.announcements.models import Announcement
from apps.enrollment.models import Enrollment


def recipients(announcement):
    users = User.objects.filter(is_active=True)
    target = announcement.target
    roles = {Announcement.Target.STUDENTS: 'student', Announcement.Target.INSTRUCTORS: 'instructor', Announcement.Target.ADMINS: 'admin'}
    if target == Announcement.Target.ALL:
        return users
    if target in roles:
        return users.filter(role=roles[target])
    courses = announcement.target_courses.values('pk')
    students = Enrollment.objects.filter(course_id__in=courses, status__in=('active', 'completed')).values('student_id')
    audience = Q(pk__in=[])
    if target in (Announcement.Target.COURSE_STUDENTS, Announcement.Target.ENROLLED_USERS):
        audience |= Q(role='student', pk__in=students)
    if target in (Announcement.Target.COURSE_INSTRUCTORS, Announcement.Target.ENROLLED_USERS):
        audience |= Q(role='instructor', courses_taught__in=courses)
    return users.filter(audience).distinct()


def get_recipient_count(announcement):
    return recipients(announcement).count()


def enqueue_due_announcements(limit=200):
    """Bound each cron enqueue batch; unique keys prevent duplicate recipient jobs."""
    now = timezone.now()
    Announcement.objects.filter(status='scheduled', publish_at__lte=now).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    ).update(status='published', updated_at=now)
    queued = 0
    due = Announcement.objects.filter(status='published', send_email=True, email_sent=False, publish_at__lte=now).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    ).order_by('publish_at', 'pk')
    for announcement in due.iterator():
        existing = MailJob.objects.filter(kind='announcement', object_id=announcement.pk, user_id=OuterRef('pk'))
        pending = recipients(announcement).annotate(already_queued=Exists(existing)).filter(already_queued=False).order_by('pk')
        for user_id in pending.values_list('pk', flat=True)[:limit - queued]:
            _, created = MailJob.objects.get_or_create(dedupe_key=f'announcement:{announcement.pk}:{user_id}',
                defaults={'kind': 'announcement', 'object_id': announcement.pk, 'user_id': user_id})
            queued += int(created)
        if queued >= limit:
            break
    return queued


def deliver_announcement(job):
    announcement = Announcement.objects.filter(pk=job.object_id, send_email=True).first()
    if not announcement or not announcement.is_published or not recipients(announcement).filter(pk=job.user_id).exists():
        return False
    # Plain text avoids rendering untrusted rich-text HTML in mail clients.
    count = send_mail(announcement.title.replace('\r', ' ').replace('\n', ' '),
                     announcement.body, settings.DEFAULT_FROM_EMAIL, [job.user.email], fail_silently=False)
    if count != 1:
        raise RuntimeError('SMTP did not accept the announcement message')
    return True


def update_delivery_status(announcement_id):
    announcement = Announcement.objects.filter(pk=announcement_id).first()
    if not announcement:
        return
    jobs = MailJob.objects.filter(kind='announcement', object_id=announcement_id)
    complete = (jobs.filter(status='sent').exists()
                and not jobs.exclude(status__in=('sent', 'skipped')).exists()
                and not recipients(announcement).exclude(pk__in=jobs.values('user_id')).exists())
    Announcement.objects.filter(pk=announcement_id).update(email_sent=complete, email_sent_at=timezone.now() if complete else None)
