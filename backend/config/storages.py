"""Custom django-storages backends for LMS media on Amazon S3."""
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
    """Public, CDN-cacheable assets such as course thumbnails."""

    default_acl = None
    file_overwrite = False
    querystring_auth = False  # stable, cacheable public URLs
