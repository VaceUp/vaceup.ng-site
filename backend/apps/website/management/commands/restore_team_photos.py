"""Store the bundled team portraits again and prove each one loads.

A photo URL is built when it is read, but the file itself was written once,
through whichever storage was active at that moment. Switching from local disk
to Cloudinary (or the reverse) leaves the database pointing at a URL that was
never populated: the page asks for a picture and the store answers 404.

This command writes each bundled portrait through the storage that is active
now, then loads the resulting URL and reports the real HTTP status. It only
touches photos it has a bundled copy of, never deletes anything, and leaves a
profile's name, role and bio exactly as the academy last edited them.
"""
from __future__ import annotations

from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.website.management.commands.seed_team_members import PHOTOS, PROFILES
from apps.website.models import TeamMember

BROWSER_UA = "Mozilla/5.0 (compatible; VaceUpPhotoCheck/1.0)"


class Command(BaseCommand):
    help = "Re-store the bundled team portraits and check that each URL loads."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the photos. Without it the command only reports what it would do.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        if not apply_changes:
            self.stdout.write(
                "Dry run. Nothing is written; add --apply to store the photos.\n"
            )

        stored = failed = 0
        for profile in PROFILES:
            bundled = PHOTOS / profile["photo"]
            member = TeamMember.objects.filter(name=profile["name"]).first()
            if member is None:
                self.stdout.write(self.style.WARNING(
                    f"SKIP     {profile['name']} - no profile yet. Run seed_team_members --apply first."
                ))
                continue
            if not bundled.is_file():
                self.stdout.write(self.style.ERROR(
                    f"BUNDLE   {member.name} - {bundled} is missing from the release."
                ))
                failed += 1
                continue

            if apply_changes:
                # A new name each time keeps the previous object untouched, so a
                # failed verification can always be retried without data loss.
                member.photo.save(profile["photo"], ContentFile(bundled.read_bytes()), save=False)
                member.save(update_fields=["photo"])

            url = self._url(member)
            self.stdout.write(f"{'STORED ' if apply_changes else 'WOULD  '} {member.name}")
            if not url:
                self.stdout.write(self.style.ERROR("         no URL was produced for the photo"))
                failed += 1
                continue
            self.stdout.write(f"         {url}")
            if not apply_changes:
                continue

            status = self._status(url)
            if status == 200:
                stored += 1
                self.stdout.write(self.style.SUCCESS("         OK    the picture loads"))
            else:
                failed += 1
                self.stdout.write(self.style.ERROR(f"         FAIL  the store answered {status}"))

        self._report_missing()
        if not apply_changes:
            return
        if failed:
            self.stdout.write(self.style.ERROR(
                f"\nFAIL  {stored} photo(s) load, {failed} need attention."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"\nPASS  All {stored} bundled team photos were stored and load."
            ))

    @staticmethod
    def _url(member: TeamMember) -> str:
        try:
            return member.photo.url if member.photo else ""
        except ValueError:
            return ""

    @staticmethod
    def _status(url: str) -> int | str:
        request = Request(url, method="GET", headers={"User-Agent": BROWSER_UA, "Range": "bytes=0-0"})
        try:
            with urlopen(request, timeout=30) as response:
                return response.status
        except HTTPError as exc:
            return exc.code
        except URLError as exc:
            return f"unreachable ({exc.reason})"

    def _report_missing(self) -> None:
        """Profiles with no picture at all still need one uploaded by hand."""
        missing = [
            member for member in TeamMember.objects.filter(is_published=True)
            if not member.photo and not member.image_url
        ]
        if not missing:
            return
        self.stdout.write(
            "\nThese published profiles have no picture, and no bundled copy exists:"
        )
        for member in missing:
            self.stdout.write(f"  {member.name} (id {member.pk})")
        self.stdout.write(
            "  Upload one in the admin under Website > Team members; the team page "
            "shows the person's initials until then."
        )
