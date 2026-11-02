"""Prove the private bucket works from the server, one step at a time.

When a browser upload fails, two very different things look identical from the
admin screen: the bucket credentials are wrong, or the bucket refuses the
browser's request for lack of a CORS rule. This command removes the guesswork —
it signs a URL, writes a tiny object, reads it back, and deletes it, printing a
PASS or FAIL for each step.

It never prints a credential or a signed URL: a signature is a temporary
password.
"""
from __future__ import annotations

import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.management.base import BaseCommand

PROBE_PREFIX = "_probe"


class Command(BaseCommand):
    help = "Write, read and delete a tiny object in the private bucket to prove it works."

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("Private bucket probe"))
        if not getattr(settings, "OBJECT_STORAGE_CONFIGURED", False):
            self.stdout.write(self.style.ERROR(
                "FAIL  Object storage is not configured. Set AWS_ACCESS_KEY_ID, "
                "AWS_SECRET_ACCESS_KEY and AWS_STORAGE_BUCKET_NAME in the cPanel "
                "environment, then restart the application."
            ))
            return
        endpoint = settings.AWS_S3_ENDPOINT_URL or "https://s3.amazonaws.com (AWS default)"
        self.stdout.write(f"  bucket    {settings.AWS_STORAGE_BUCKET_NAME}")
        self.stdout.write(f"  endpoint  {endpoint}")
        self.stdout.write(f"  region    {settings.AWS_S3_REGION_NAME}")

        from apps.core.storage import _client

        key = f"{PROBE_PREFIX}/{uuid.uuid4().hex}.txt"
        body = b"vaceup storage probe"
        client = _client()
        probed = False
        passed = True
        try:
            passed &= self._step("sign an upload URL", lambda: self._show_upload_shape(client, key))
            passed &= self._step("write a test object", lambda: client.put_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=key,
                Body=body,
                ContentType="text/plain",
            ))
            probed = True
            passed &= self._step("read it back", lambda: self._check_head(client, key, len(body)))
            passed &= self._step("download it through a signed link", lambda: self._download(key, body))
        finally:
            if probed:
                passed &= self._step("delete the test object", lambda: client.delete_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key,
                ))

        if passed:
            self.stdout.write(self.style.SUCCESS(
                "\nPASS  The bucket accepts writes, reads and signed downloads. "
                "If the browser still fails, the cause is the bucket's CORS rule."
            ))
            self._cors_hint()
        else:
            self.stdout.write(self.style.ERROR(
                "\nFAIL  The server itself cannot use this bucket. Fix the step that "
                "failed above before retrying a browser upload."
            ))

    def _step(self, label: str, action) -> bool:
        self.stdout.write(f"  {label:<36}", ending="")
        try:
            action()
        except Exception as exc:  # noqa: BLE001 - every failure must be reported, not raised
            self.stdout.write(self.style.ERROR(f"FAIL  {type(exc).__name__}: {self._clean(exc)}"))
            return False
        self.stdout.write(self.style.SUCCESS("OK"))
        return True

    def _show_upload_shape(self, client, key: str) -> None:
        url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                "Key": key,
                "ContentType": "text/plain",
            },
            ExpiresIn=60,
        )
        parts = urlsplit(url)
        # Host and path only: the query string carries the signature.
        self.stdout.write(f"[{parts.scheme}://{parts.netloc}{parts.path}] ", ending="")
        if not parts.path.startswith(f"/{settings.AWS_STORAGE_BUCKET_NAME}/"):
            self.stdout.write(self.style.WARNING(
                "(the bucket is not the first path segment; "
                "R2 needs path-style addressing) "
            ), ending="")

    def _check_head(self, client, key: str, size: int) -> None:
        head = client.head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
        if head.get("ContentLength") != size:
            raise ValueError(f"stored {head.get('ContentLength')} bytes, expected {size}")

    def _download(self, key: str, expected: bytes) -> None:
        from apps.core.storage import presigned_download_url

        url = presigned_download_url(key, expires=60)
        try:
            with urlopen(Request(url, method="GET"), timeout=30) as response:
                received = response.read()
        except HTTPError as exc:
            raise RuntimeError(f"HTTP {exc.code} from the signed download") from exc
        except URLError as exc:
            raise RuntimeError(f"could not reach the bucket: {exc.reason}") from exc
        if received != expected:
            raise ValueError("the downloaded bytes do not match what was written")

    def _cors_hint(self) -> None:
        frontend = getattr(settings, "FRONTEND_BASE_URL", "")
        origins = [frontend.rstrip("/")] if frontend else []
        origins += [origin.rstrip("/") for origin in getattr(settings, "CORS_ALLOWED_ORIGINS", [])]
        self.stdout.write("\n  Browser uploads also need a CORS rule on the bucket allowing:")
        for origin in dict.fromkeys(filter(None, origins)):
            self.stdout.write(f"    {origin}")
        self.stdout.write("  Methods GET, PUT, HEAD; headers *; expose ETag.")

    @staticmethod
    def _clean(exc: Exception) -> str:
        # Boto messages are safe; a signed URL in an error would not be.
        text = str(exc).split("\n")[0]
        return text.replace("&X-Amz-Signature=", "&signature=")[:400]
