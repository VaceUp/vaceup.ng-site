"""Pre-signed upload/playback URLs for private media on R2 / S3.

Direct-to-storage: the browser PUTs the file straight to R2/S3 with a
short-lived signed URL, and plays it back through a short-lived signed GET URL —
Django never proxies the bytes. Works with Cloudflare R2 (set
``AWS_S3_ENDPOINT_URL``) or plain AWS S3.
"""
from __future__ import annotations

from django.conf import settings

from apps.core.exceptions import DomainError
from apps.core.storage_config import endpoint_url, is_r2_endpoint


class StorageNotConfigured(DomainError):
    status_code = 503
    default_detail = "Media storage is not configured on the server."
    default_code = "storage_not_configured"


def connection_options():
    """Validate endpoint configuration without using a credential or network."""
    raw = getattr(settings, "AWS_S3_ENDPOINT_URL", None) or ""
    endpoint = endpoint_url(raw)
    if (not raw and getattr(settings, "AWS_S3_ENDPOINT_REJECTED", False)) or (raw and not endpoint):
        raise StorageNotConfigured(
            "AWS_S3_ENDPOINT_URL is invalid. Set the HTTPS S3 API endpoint without "
            "a bucket path, credentials, query, placeholder or trailing comment. "
            "Leave it blank only when using AWS S3, then restart the Python app."
        )
    r2 = is_r2_endpoint(endpoint)
    return {"endpoint_url": endpoint or None,
            "region_name": "auto" if r2 else getattr(settings, "AWS_S3_REGION_NAME", "eu-west-1"),
            "addressing_style": "path" if r2 else "auto"}


def _client():
    missing = [
        name
        for name, value in (
            ("AWS_ACCESS_KEY_ID", settings.AWS_ACCESS_KEY_ID),
            ("AWS_SECRET_ACCESS_KEY", settings.AWS_SECRET_ACCESS_KEY),
            ("AWS_STORAGE_BUCKET_NAME", settings.AWS_STORAGE_BUCKET_NAME),
        )
        if not value
    ]
    if missing:
        # Naming the empty settings turns a support ticket into a one-line fix;
        # the names are configuration, never the values.
        raise StorageNotConfigured(
            f"Media storage is not configured on the server: {', '.join(missing)} "
            f"{'is' if len(missing) == 1 else 'are'} empty."
        )
    options = connection_options()
    # Imported lazily so the app boots even if boto3 isn't installed.
    try:
        import boto3
        from botocore.client import Config
        return boto3.client(
            "s3", endpoint_url=options["endpoint_url"],
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=options["region_name"],
            config=Config(signature_version="s3v4", s3={"addressing_style": options["addressing_style"]}),
        )
    except ImportError:
        raise StorageNotConfigured("The storage SDK is missing. Install backend requirements in the Python app's environment and restart it.") from None
    except ValueError:
        raise StorageNotConfigured("The storage client configuration is invalid. Check the S3 endpoint and region settings, then restart the Python app.") from None


def presigned_upload_url(key: str, content_type: str, expires: int = 3600) -> str:
    """Signed PUT URL. The client uploads with header Content-Type = content_type."""
    return _client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )


def presigned_download_url(key: str, expires: int = 3600) -> str:
    """Signed GET URL for playback/download."""
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
        ExpiresIn=expires,
    )
