"""Media storage backends.

Private media (lesson videos, submissions, certificate PDFs) is signed and
never served publicly. Public media (course covers, team photos, event
covers) is stored separately so it can be cached and embedded on the website.

Object storage is used only when a bucket is configured. Without one, both
backends fall back to local disk so image uploads keep working on a
single-server deployment; only ``media/public`` is exposed over HTTP.
"""
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from storages.backends.s3boto3 import S3Boto3Storage


class PrivateMediaStorage(S3Boto3Storage):
    """Private storage for lesson videos, PDFs and student submissions.

    Access is controlled by the bucket policy + S3 Block Public Access
    (modern buckets have ACLs disabled), and every download is served
    through a short-lived pre-signed URL, so raw object links can't leak.
    """

    default_acl = None        # do not send an ACL; rely on bucket policy
    file_overwrite = False    # never clobber an existing key
    querystring_auth = True   # serve via signed URLs
    querystring_expire = 3600  # links valid for one hour


class PublicMediaStorage(S3Boto3Storage):
    """Public, CDN-cacheable assets such as course thumbnails.

    Uses ``AWS_PUBLIC_STORAGE_BUCKET_NAME`` when set, otherwise the main
    bucket. That bucket (or the used prefix) must allow public reads; set
    ``AWS_S3_CUSTOM_DOMAIN`` to serve through a CDN.
    """

    default_acl = None
    file_overwrite = False
    querystring_auth = False  # stable, cacheable public URLs

    def __init__(self, **kwargs):
        kwargs.setdefault(
            "bucket_name",
            settings.AWS_PUBLIC_STORAGE_BUCKET_NAME or settings.AWS_STORAGE_BUCKET_NAME,
        )
        super().__init__(**kwargs)


class LocalPublicStorage(FileSystemStorage):
    """Filesystem fallback used when no object-storage bucket is configured."""

    def __init__(self):
        super().__init__(
            location=settings.MEDIA_ROOT / "public",
            base_url=settings.MEDIA_URL + "public/",
        )


def public_media_storage():
    """Storage for assets that must be readable without signed URLs."""
    if settings.AWS_STORAGE_BUCKET_NAME:
        return PublicMediaStorage()
    return LocalPublicStorage()
