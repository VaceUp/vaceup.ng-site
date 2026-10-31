"""Create the curriculum courses that the catalogue is still missing."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from apps.courses.catalog import catalog_preview, restore_catalog


class Command(BaseCommand):
    help = "Preview the curriculum courses; --apply --instructor-email EMAIL creates the missing ones."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--instructor-email")
        parser.add_argument("--fill-missing-details", action="store_true")

    def handle(self, *args, **options):
        for item in catalog_preview():
            state = "KEEP" if item["existing_id"] else "DRAFT"
            self.stdout.write(
                f"{state} {item['title']} | {item['category']} | NGN {item['price']} | "
                f"{item['duration']} | {item['modules']} modules | {item['lessons']} lessons"
            )
        if not options["apply"]:
            self.stdout.write("Preview only; no database changes. Pass --apply with a real tutor to import.")
            return
        tutor = get_user_model().objects.filter(email__iexact=options["instructor_email"] or "", role="instructor", is_active=True).first()
        if not tutor:
            raise CommandError("Provide --instructor-email for an existing active tutor. No placeholder accounts are created.")
        result = restore_catalog(tutor, fill_missing_details=options["fill_missing_details"])
        self.stdout.write(
            f"Created {len(result['created'])} drafts with {result['modules']} modules and "
            f"{result['lessons']} lessons; kept {len(result['kept'])}; filled blank details on "
            f"{len(result['enriched'])}."
        )
        self.stdout.write("Review imported details and prices in Admin > Content before publishing.")
