"""Show which storage settings this process loaded, printing no values.

Run on the server before uploading a video: the three settings an upload needs
are easy to half-fill, and a variable set in cPanel's Python app environment
overrides the same name in .env, so an empty row there wins over a filled line
in the file.
"""
from django.conf import settings
from django.core.management.base import BaseCommand

AWS_SETTINGS = (
    ("AWS_ACCESS_KEY_ID", "access key id"),
    ("AWS_SECRET_ACCESS_KEY", "secret access key"),
    ("AWS_STORAGE_BUCKET_NAME", "bucket name"),
)


class Command(BaseCommand):
    help = "Report which object-storage settings are loaded, without their values."

    def handle(self, *args, **options):
        missing = []
        for setting, label in AWS_SETTINGS:
            present = bool(getattr(settings, setting))
            if not present:
                missing.append(setting)
            self.stdout.write(f"{setting:<28}{'set' if present else 'EMPTY'}  ({label})")

        endpoint = settings.AWS_S3_ENDPOINT_URL or ""
        endpoint_state = "not set"
        if endpoint:
            endpoint_state = (
                "set (Cloudflare R2)" if endpoint.endswith("r2.cloudflarestorage.com")
                else "set (not an R2 host)"
            )
        self.stdout.write(f"{'AWS_S3_ENDPOINT_URL':<28}{endpoint_state}")
        self.stdout.write(f"{'AWS_S3_REGION_NAME':<28}{settings.AWS_S3_REGION_NAME}")

        private = "bucket" if settings.OBJECT_STORAGE_CONFIGURED else "local disk"
        if settings.CLOUDINARY_CONFIGURED:
            public = "Cloudinary"
        elif settings.OBJECT_STORAGE_CONFIGURED:
            public = "bucket"
        else:
            public = "local disk"
        self.stdout.write("")
        self.stdout.write(f"{'Private media':<28}{private}")
        self.stdout.write(f"{'Public images':<28}{public}")

        if missing:
            self.stdout.write("")
            self.stdout.write(
                f"ACTION: {', '.join(missing)} "
                f"{'is' if len(missing) == 1 else 'are'} empty in this process, so "
                "lesson videos cannot be uploaded."
            )
            self.stdout.write(
                "Set the missing names in .env, then restart the Python app. A "
                "variable set in cPanel's Python app environment overrides .env, "
                "so an empty row there wins over a filled line in the file."
            )
