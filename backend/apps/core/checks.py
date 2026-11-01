"""Configuration warnings surfaced by ``manage.py check``.

These settings have each silently broken a whole production workflow: a
bucket name without credentials (or an endpoint that is really a leftover
comment) sends every image upload to object storage and fails, and a frontend
base pointing at the API host makes every emailed link 404. All of them fall
back safely, so the fix is a warning the operator can read and act on.
"""
from __future__ import annotations

import os
from urllib.parse import urlsplit

from django.conf import settings
from django.core.checks import Warning, register


@register("vaceup_config")
def media_storage_check(app_configs, **kwargs):
    issues = []
    if settings.AWS_S3_ENDPOINT_REJECTED:
        issues.append(Warning(
            "AWS_S3_ENDPOINT_URL is set to something that is not a URL, so it was "
            "ignored and requests go to AWS S3 rather than an R2/B2 endpoint.",
            hint="Set it to https://<accountid>.r2.cloudflarestorage.com, or leave "
                 "the line out entirely: an inline comment is read as the value.",
            id="core.W005",
        ))
    if settings.AWS_STORAGE_BUCKET_NAME and not settings.OBJECT_STORAGE_CONFIGURED:
        issues.append(Warning(
            "AWS_STORAGE_BUCKET_NAME is set but the access keys are not, so "
            "object storage is disabled and media is kept on local disk.",
            hint="Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to use the "
                 "bucket, or clear AWS_STORAGE_BUCKET_NAME to silence this.",
            id="core.W001",
        ))
    if not settings.OBJECT_STORAGE_CONFIGURED and not os.access(
        _writable_media_dir(), os.W_OK
    ):
        issues.append(Warning(
            f"The media directory {_writable_media_dir()} is not writable by the "
            "app process, so image uploads will fail.",
            hint="On cPanel run: chmod -R u+rwX on the media path, and check the "
                 "files were not extracted as another user.",
            id="core.W002",
        ))
    return issues


def _writable_media_dir():
    """The closest existing ancestor of MEDIA_ROOT — creating paths is not a check's job."""
    path = str(settings.MEDIA_ROOT)
    while path and not os.path.isdir(path):
        parent = os.path.dirname(path)
        if parent == path:
            break
        path = parent
    return path or os.getcwd()


@register("vaceup_config")
def emailed_link_base_check(app_configs, **kwargs):
    issues = []
    configured = urlsplit(str(settings.FRONTEND_BASE_URL).strip())
    api_host = (urlsplit(str(settings.MARKETING_PUBLIC_API_URL).strip()).hostname or "").lower()
    if not configured.netloc:
        issues.append(Warning(
            "FRONTEND_BASE_URL is empty; emailed links fall back to "
            f"{settings.FRONTEND_LINK_BASE}.",
            hint="Set FRONTEND_BASE_URL to the public site origin.",
            id="core.W003",
        ))
    elif (configured.hostname or "").lower() == api_host:
        issues.append(Warning(
            "FRONTEND_BASE_URL points at the API host, which serves no pages, so "
            f"emailed links fall back to {settings.FRONTEND_LINK_BASE}.",
            hint="Set FRONTEND_BASE_URL to the website origin (https://vaceup.ng), "
                 "not the API origin.",
            id="core.W004",
        ))
    return issues
