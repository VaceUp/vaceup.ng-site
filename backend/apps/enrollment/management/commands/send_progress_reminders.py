"""Weekly nudge for learners who stalled mid-course; cron-friendly and bounded.

Schedule with cPanel cron, e.g. every day at 09:00 - the command itself
throttles repeats (default: one reminder per learner per 14 days) and claims
rows before sending, so overlapping runs never double-send.
"""
import json
import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef, Subquery
from django.utils import timezone

from apps.enrollment.emails import send_progress_reminder
from apps.enrollment.models import Enrollment, LessonProgress
from apps.marketing.models import EmailUnsubscribe

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Send one gentle progress reminder per stalled learner."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=200)
        parser.add_argument("--idle-days", type=int, default=7)
        parser.add_argument("--repeat-days", type=int, default=14)

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 2000 or not 1 <= options["idle_days"] or not 1 <= options["repeat_days"]:
            self.stderr.write("Use limit 1..2000 and positive day windows.")
            return
        now = timezone.now()
        idle_cutoff = now - timedelta(days=options["idle_days"])
        repeat_cutoff = now - timedelta(days=options["repeat_days"])
        # completed_at is the real learning timestamp; updated_at is an
        # auto_now field that would always read as "just now".
        latest_activity = LessonProgress.objects.filter(
            enrollment=OuterRef("pk"), completed=True).order_by("-completed_at").values("completed_at")[:1]
        stalled = (Enrollment.objects
                   .filter(status=Enrollment.Status.ACTIVE, course__is_published=True)
                   .annotate(last_activity=Subquery(latest_activity))
                   .filter(progress_percent__gt=0, progress_percent__lt=100,
                           last_activity__lte=idle_cutoff)
                   .exclude(last_progress_reminder_at__gte=repeat_cutoff)
                   .exclude(student__email="")
                   .exclude(student__is_active=False)
                   .exclude(Exists(EmailUnsubscribe.objects.filter(user=OuterRef("student"), unsubscribe_all=True)))
                   .select_related("student", "course")
                   .order_by("last_activity")[:options["limit"]])
        sent = skipped = 0
        for enrollment in stalled:
            # Claim the row by its exact previous stamp: overlapping cron runs
            # or parallel workers can never both send to the same learner.
            claimed = Enrollment.objects.filter(
                pk=enrollment.pk, last_progress_reminder_at=enrollment.last_progress_reminder_at,
            ).update(last_progress_reminder_at=now)
            if not claimed:
                skipped += 1
                continue
            try:
                sent += int(bool(send_progress_reminder(enrollment)))
            except Exception:
                logger.exception("progress_reminder enrollment=%s raised", enrollment.pk)
                skipped += 1
        self.stdout.write(json.dumps({"reminders_sent": sent, "skipped": skipped}))
