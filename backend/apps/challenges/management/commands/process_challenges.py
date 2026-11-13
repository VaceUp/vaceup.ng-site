"""Cron entry point; uses durable DB jobs and never needs Redis."""
import json
from django.core.management.base import BaseCommand, CommandError
from apps.challenges.jobs import enqueue_due, process_queue


class Command(BaseCommand):
    help = "Process a bounded challenge job batch and enqueue daily public observation attempts."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=20)
        parser.add_argument("--max-seconds", type=int, default=45)
        parser.add_argument("--no-enqueue", action="store_true")

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 200 or not 1 <= options["max_seconds"] <= 300:
            raise CommandError("Use limit1..200 and max-seconds1..300.")
        queued = 0 if options["no_enqueue"] else enqueue_due()
        result = process_queue(options["limit"], options["max_seconds"])
        self.stdout.write(json.dumps({"observations_enqueued": queued, "outcomes": result}))
