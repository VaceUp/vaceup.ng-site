"""Refresh cached Blogger posts from the command line."""

from django.core.management.base import BaseCommand, CommandError

from apps.website.models import BloggerSource
from apps.website.services import BloggerSyncError, sync_blogger


class Command(BaseCommand):
    help = "Fetch published posts from the configured Blogger blog."

    def handle(self, *args, **options):
        try:
            result = sync_blogger(BloggerSource.load())
        except BloggerSyncError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            self.style.SUCCESS(
                f"Blogger sync: {result['created']} created, "
                f"{result['updated']} updated, {result['skipped']} skipped."
            )
        )
