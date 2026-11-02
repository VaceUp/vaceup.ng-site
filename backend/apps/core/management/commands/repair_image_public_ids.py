"""Move public images onto the public_id their delivery URL actually asks for.

Cloudinary reads the trailing ".jpg" of a delivery URL as the format, not as
part of the name. Every image uploaded while the storage passed the extension
inside public_id is therefore stored as ".../cover.jpg" and can only be fetched
as ".../cover.jpg.jpg". The upload answered 200, the site asks for
".../cover.jpg", gets a 404, and shows a broken image with no error raised
anywhere to point at.

This renames each stored image to the extension-free name the storage now
builds, then loads the URL the site will use and reports the real HTTP status.
A rename moves the asset, nothing here deletes one, and a dry run writes
nothing at all.
"""
from __future__ import annotations

from posixpath import splitext
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

# Every ImageField that reads from public_media_storage().
FIELDS = (
    ("accounts.User", "avatar"),
    ("courses.Course", "thumbnail"),
    ("website.TeamMember", "photo"),
    ("website.Event", "cover_image"),
)

BROWSER_UA = "Mozilla/5.0 (compatible; VaceUpImageCheck/1.0)"


def _status(url):
    """The HTTP status a visitor's browser would get for this image."""
    try:
        request = Request(url, headers={"User-Agent": BROWSER_UA}, method="HEAD")
        with urlopen(request, timeout=30) as response:
            return response.status
    except HTTPError as exc:
        return exc.code
    except (URLError, OSError):
        return 0


class Command(BaseCommand):
    help = (
        "Rename Cloudinary public images onto their extension-free public_id "
        "and prove that each URL the site uses now loads."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Do the renames. Without it the command only reports what it would do.",
        )

    def handle(self, *args, **options):
        if not settings.CLOUDINARY_CONFIGURED:
            raise CommandError(
                "Cloudinary is not configured, so there is nothing to rename here. "
                "Public images are going to the bucket or to disk."
            )

        from cloudinary import CloudinaryImage
        from cloudinary import uploader
        from cloudinary.exceptions import Error

        from config.storages import CloudinaryStorage

        apply_changes = options["apply"]
        if not apply_changes:
            self.stdout.write(
                "Dry run. Nothing is renamed; add --apply to move the files.\n"
            )

        storage = CloudinaryStorage()
        counts = {"loads": 0, "renamed": 0, "pending": 0, "missing": 0, "failed": 0}

        for label, field in FIELDS:
            model = apps.get_model(label)
            rows = (
                model.objects.exclude(**{field: None})
                .exclude(**{field: ""})
                .order_by("pk")
            )
            for row in rows:
                name = getattr(row, field).name
                where = f"{label}.{field} #{row.pk}"
                live_url = storage.url(name)
                if _status(live_url) == 200:
                    counts["loads"] += 1
                    self.stdout.write(f"LOADS     {where}  {name}")
                    continue

                stored = storage.stored_key(name)
                wanted, extension = splitext(stored)
                if not extension:
                    counts["missing"] += 1
                    self.stdout.write(self.style.ERROR(
                        f"MISSING   {where}  {stored} - no image in Cloudinary. Re-upload it from the admin."
                    ))
                    continue

                # The name the old upload actually used, delivered with its
                # extension doubled: that is the only way Cloudinary serves it.
                legacy_url = CloudinaryImage(
                    stored, resource_type="image", format=extension
                ).url
                if _status(legacy_url) != 200:
                    counts["missing"] += 1
                    self.stdout.write(self.style.ERROR(
                        f"MISSING   {where}  {name} - no image at either name. "
                        f"Re-upload it from the admin."
                    ))
                    continue

                if not apply_changes:
                    counts["pending"] += 1
                    self.stdout.write(self.style.WARNING(
                        f"RENAME    {where}  {stored}  ->  {wanted}"
                    ))
                    continue

                try:
                    uploader.rename(
                        stored,
                        wanted,
                        resource_type="image",
                        to_type="upload",
                        overwrite=False,
                        invalidate=True,
                    )
                except Error as exc:
                    counts["failed"] += 1
                    self.stdout.write(self.style.ERROR(
                        f"FAILED    {where}  {stored}: {exc}"
                    ))
                    continue

                after = _status(live_url)
                if after == 200:
                    counts["renamed"] += 1
                    self.stdout.write(self.style.SUCCESS(
                        f"MOVED     {where}  {name} -> loads (200)"
                    ))
                else:
                    counts["failed"] += 1
                    self.stdout.write(self.style.ERROR(
                        f"STILL BAD {where}  {live_url} answers {after} after the rename"
                    ))

        self.stdout.write(
            "\n"
            f"loads already: {counts['loads']}   renamed: {counts['renamed']}   "
            f"waiting for --apply: {counts['pending']}   "
            f"absent from Cloudinary: {counts['missing']}   failed: {counts['failed']}"
        )
        if counts["missing"]:
            self.stdout.write(
                "An absent image was never written to Cloudinary, so no rename can "
                "bring it back; it needs uploading again from the admin panel."
            )
        if counts["pending"] and not apply_changes:
            self.stdout.write("Re-run with --apply to move them.")
