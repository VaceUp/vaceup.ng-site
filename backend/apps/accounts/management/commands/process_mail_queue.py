"""One bounded cron invocation; no persistent process or Redis required."""
from collections import Counter
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.mail_delivery import email_configuration_errors
from apps.accounts.outbox import enqueue_reminders, process_one
from apps.core.models import RateLimitBucket


class Command(BaseCommand):
    help = "Queue due class reminders and process durable mail jobs without Redis."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=50)
        parser.add_argument("--max-seconds", type=int, default=45)

    def handle(self, *args, **options):
        if settings.ACCOUNT_EMAIL_DELIVERY_MODE != "database":
            raise CommandError("Set ACCOUNT_EMAIL_DELIVERY_MODE=database before running the mail cron.")
        if not 1 <= options["limit"] <= 1000 or not 1 <= options["max_seconds"] <= 300:
            raise CommandError("limit must be 1..1000; max-seconds must be 1..300.")
        errors = email_configuration_errors()
        if errors:
            raise CommandError(" ".join(errors))
        started = time.monotonic()
        queued = enqueue_reminders()
        results = Counter()
        for _ in range(options["limit"]):
            if time.monotonic() - started >= options["max_seconds"]:
                break
            result = process_one()
            if result is None:
                break
            results[str(result)] += 1
        # Bound maintenance: delete only expired counters, not account data.
        keys = list(RateLimitBucket.objects.filter(expires_at__lt=timezone.now()).values_list("pk", flat=True)[:1000])
        RateLimitBucket.objects.filter(pk__in=keys, expires_at__lt=timezone.now()).delete()
        self.stdout.write(f"Reminders queued: {queued}; outcomes: {dict(results)}")
        if results["failed"]:
            raise CommandError("Some jobs failed. Run mail_queue_status for safe diagnostic codes.")
