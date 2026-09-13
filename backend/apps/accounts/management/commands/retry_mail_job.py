from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from apps.accounts.models import MailJob


class Command(BaseCommand):
    help = "Requeue one failed mail job after fixing its cause. Stale account links/classes are still skipped."

    def add_arguments(self, parser):
        parser.add_argument("job_id", type=int)

    def handle(self, *args, **options):
        changed = MailJob.objects.filter(pk=options["job_id"], status=MailJob.Status.FAILED).update(
            status=MailJob.Status.PENDING, attempts=0, available_at=timezone.now(),
            error_code="", finished_at=None, claimed_at=None, claim_id=None,
        )
        if not changed:
            raise CommandError("No failed job has that ID. Sent/processing jobs cannot be requeued here.")
        self.stdout.write("Failed job requeued. The cron will attempt it; delivery is not guaranteed.")
