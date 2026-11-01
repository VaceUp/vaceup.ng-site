"""Media storage backends.

Two independent choices, each with a safe fallback so a half-configured
service can never take image uploads down:

* Public images (course covers, team photos, event covers) go to Cloudinary
  when its credentials are present, otherwise to the public object-storage
  bucket, otherwise to local disk under ``media/public``.
* Private media (lesson videos, live-class recordings, certificate PDFs,
  student submissions) stays on the S3-compatible bucket — Cloudflare R2 when
  ``AWS_S3_ENDPOINT_URL`` points at it, AWS S3 when it is blank — and is only
  ever served through a short-lived pre-signed URL.

``public_media_storage()`` is the callable model fields use; it reads the
settings at instantiation time, so switching providers is an environment
change, not a code change.
"""
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, Storage
from django.utils.deconstruct import deconstructible
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

    def __init__(self, **kwargs):
        # AWS_S3_CUSTOM_DOMAIN is for public delivery only. A pre-signed URL is
        # signed for the host it is opened against, so private links must stay
        # on the endpoint they were created for or every download 403s.
        kwargs["custom_domain"] = None
        super().__init__(**kwargs)


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
    """Filesystem fallback used when no public image store is configured."""

    def __init__(self):
        super().__init__(
            location=settings.MEDIA_ROOT / "public",
            base_url=settings.MEDIA_URL + "public/",
        )


@deconstructible
class CloudinaryStorage(Storage):
    """Public images on Cloudinary: CDN delivery, transforms, no bucket policy.

    ``upload_to`` paths become Cloudinary public_ids under
    ``CLOUDINARY_FOLDER``, so the same key layout the bucket used still reads
    naturally (``vaceup/course/thumbnails/cover.jpg``).
    """

    def __init__(self):
        # Imported lazily so the app boots before the package is installed.
        import cloudinary

        self.cloud_name = settings.CLOUDINARY_CLOUD_NAME
        self.api_key = settings.CLOUDINARY_API_KEY
        self.api_secret = settings.CLOUDINARY_API_SECRET
        self.folder = settings.CLOUDINARY_FOLDER.strip("/")
        self.secure_distribution = settings.CLOUDINARY_SECURE_DISTRIBUTION.strip()
        cloudinary.config(
            cloud_name=self.cloud_name,
            api_key=self.api_key,
            api_secret=self.api_secret,
            secure=True,
            private_cdn=bool(self.secure_distribution),
            secure_distribution=self.secure_distribution or None,
        )

    def public_id(self, name):
        return f"{self.folder}/{name}" if self.folder else name

    def exists(self, name):
        """Checked for real, so a repeated filename cannot overwrite another course."""
        from cloudinary import uploader
        from cloudinary.exceptions import Error

        try:
            uploader.explicit(self.public_id(name), type="upload")
        except Error as exc:
            if getattr(exc, "http_status", None) == 404 or "not found" in str(exc).lower():
                return False
            raise
        return True

    def _save(self, name, content):
        from cloudinary import uploader

        result = uploader.upload(
            content.read(),
            public_id=self.public_id(name),
            resource_type="image",
            overwrite=False,
            invalidate=True,
        )
        return name

    def _open(self, name, mode="rb"):
        import httpx

        response = httpx.get(self.url(name), timeout=30, follow_redirects=True)
        response.raise_for_status()
        return ContentFile(response.content, name=name)

    def url(self, name):
        from cloudinary import CloudinaryImage

        return CloudinaryImage(self.public_id(name), resource_type="image").url

    def delete(self, name):
        from cloudinary import uploader

        uploader.destroy(self.public_id(name), invalidate=True)


def public_media_storage():
    """Storage for assets that must be readable without signed URLs."""
    if settings.CLOUDINARY_CONFIGURED:
        return CloudinaryStorage()
    if settings.OBJECT_STORAGE_CONFIGURED:
        return PublicMediaStorage()
    return LocalPublicStorage()
