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
from urllib.error import HTTPError
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
    """The HTTP status a browser would get, or the reason the probe failed.

    A server that cannot reach the CDN answers nothing, so a transport failure
    must never be reported as a missing picture: on shared hosting the request
    can be refused, timed out or met with a certificate error, and every one of
    those looks identical to a 404 once the reason is thrown away.
    """
    try:
        request = Request(url, headers={"User-Agent": BROWSER_UA}, method="HEAD")
        with urlopen(request, timeout=30) as response:
            return response.status, ""
    except HTTPError as exc:
        return exc.code, ""
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def _stored_images():
    """Each database row that points at a public image, with its key."""
    for label, field in FIELDS:
        model = apps.get_model(label)
        rows = (
            model.objects.exclude(**{field: None})
            .exclude(**{field: ""})
            .order_by("pk")
        )
        for row in rows:
            yield label, field, row, getattr(row, field).name


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
        images = list(_stored_images())
        if not images:
            self.stdout.write(
                "No public image is recorded in the database, so there is nothing to check."
            )
            return

        # One probe before anything else. Without it a blocked server would
        # report every image as absent and the academy would re-upload files
        # that are already sitting in the account.
        probe_url = storage.url(images[0][3])
        probe_code, probe_error = _status(probe_url)
        if probe_error:
            raise CommandError(
                "This server could not reach Cloudinary, so it cannot tell a "
                "misplaced image from a missing one. Nothing was renamed.\n\n"
                f"Probe:  {probe_url}\n"
                f"Reason: {probe_error}\n\n"
                "Outbound HTTPS to res.cloudinary.com is blocked, sent through "
                "a proxy, or failing its certificate check. The images are "
                "checked from a browser regardless, so this does not stop the "
                "site showing them - it only stops this command answering."
            )
        self.stdout.write(
            f"This server can reach Cloudinary; the first probe answered {probe_code}.\n"
        )

        counts = {
            "loads": 0,
            "renamed": 0,
            "pending": 0,
            "missing": 0,
            "unreachable": 0,
            "failed": 0,
        }

        for label, field, row, name in images:
            where = f"{label}.{field} #{row.pk}"
            live_url = storage.url(name)
            live_code, live_error = _status(live_url)
            if live_code == 200:
                counts["loads"] += 1
                self.stdout.write(f"LOADS     {where}  {name}")
                continue

            stored = storage.stored_key(name)
            wanted, extension = splitext(stored)

            # The name the old upload actually used, delivered with its
            # extension doubled: that is the only way Cloudinary serves it.
            # splitext keeps the leading dot, and Cloudinary adds its own.
            file_format = extension.lstrip(".").lower()
            legacy_url = ""
            if file_format:
                legacy_url = CloudinaryImage(
                    stored, resource_type="image", format=file_format
                ).url
            legacy_code, legacy_error = (
                _status(legacy_url) if legacy_url else (None, "")
            )

            if live_error or legacy_error:
                counts["unreachable"] += 1
                self.stdout.write(self.style.WARNING(
                    f"CANNOT CHECK {where}  {name} - the probe failed: "
                    f"{live_error or legacy_error}"
                ))
                continue

            if legacy_code == 200:
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

                after, after_error = _status(live_url)
                if after == 200:
                    counts["renamed"] += 1
                    self.stdout.write(self.style.SUCCESS(
                        f"MOVED     {where}  {name} -> loads (200)"
                    ))
                else:
                    counts["failed"] += 1
                    self.stdout.write(self.style.ERROR(
                        f"STILL BAD {where}  {live_url} answers "
                        f"{after if after is not None else after_error} after the rename"
                    ))
                continue

            counts["missing"] += 1
            answers = f"{live_code}" if not legacy_code else f"{live_code} and {legacy_code}"
            self.stdout.write(self.style.ERROR(
                f"MISSING   {where}  {name} - Cloudinary answered {answers}. "
                f"No rename can bring back a file that is not in the account; "
                f"it needs uploading again from the admin panel."
            ))

        self.stdout.write(
            "\n"
            f"loads already: {counts['loads']}   renamed: {counts['renamed']}   "
            f"waiting for --apply: {counts['pending']}   "
            f"absent from Cloudinary: {counts['missing']}   "
            f"could not be checked: {counts['unreachable']}   failed: {counts['failed']}"
        )
        if counts["unreachable"]:
            self.stdout.write(
                "Those lines are unknown, not missing. Re-run once the server "
                "can reach Cloudinary, and do not re-upload on the strength of them."
            )
        if counts["pending"] and not apply_changes:
            self.stdout.write("Re-run with --apply to move them.")
