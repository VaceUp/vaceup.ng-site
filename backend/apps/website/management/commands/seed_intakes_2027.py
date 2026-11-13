"""Prepare the approved 2027 dates without publishing unconfigured courses."""
from datetime import date

from django.core.management.base import BaseCommand

from apps.website.models import AcademyIntake


class Command(BaseCommand):
    help = "Create the four 2027 intake drafts; existing records are preserved."

    def handle(self, *args, **options):
        for number, start, end in (
            (1, date(2027, 1, 8), date(2027, 3, 27)),
            (2, date(2027, 4, 9), date(2027, 6, 26)),
            (3, date(2027, 7, 9), date(2027, 9, 25)),
            (4, date(2027, 10, 8), date(2027, 12, 25)),
        ):
            row, created = AcademyIntake.objects.get_or_create(
                title=f"2027 intake {number}", starts_on=start,
                defaults={"ends_on": end, "is_active": False},
            )
            self.stdout.write(f"{'Created draft' if created else 'Preserved'}: {row.title}")
