"""Pre-signed upload/playback URLs for private media on R2 / S3.

Direct-to-storage: the browser PUTs the file straight to R2/S3 with a
short-lived signed URL, and plays it back through a short-lived signed GET URL —
Django never proxies the bytes. Works with Cloudflare R2 (set
``AWS_S3_ENDPOINT_URL``) or plain AWS S3.
"""
from __future__ import annotations

from django.conf import settings

from apps.core.exceptions import DomainError


class StorageNotConfigured(DomainError):
    status_code = 503
    default_detail = "Media storage is not configured on the server."
    default_code = "storage_not_configured"


def _client():
    if not (
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.AWS_STORAGE_BUCKET_NAME
    ):
        raise StorageNotConfigured()
    # Imported lazily so the app boots even if boto3 isn't installed.
    import boto3
    from botocore.client import Config

    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
        config=Config(signature_version="s3v4"),
    )


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
