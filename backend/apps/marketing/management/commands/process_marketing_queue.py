from django.core.management.base import BaseCommand, CommandError
from apps.marketing.services import process_queue


class Command(BaseCommand):
    help = "Process due marketing email from the database. Run once per minute through cPanel cron."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=25)
        parser.add_argument("--max-seconds", type=int, default=45)

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 100 or not 1 <= options["max_seconds"] <= 55:
            raise CommandError("Use limit 1..100 and max-seconds 1..55.")
        self.stdout.write(f"Marketing outcomes: {process_queue(options['limit'], options['max_seconds'])}")
