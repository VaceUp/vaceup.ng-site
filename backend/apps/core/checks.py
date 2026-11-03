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


def _setting(name, default=""):
    """Read a setting this module may be newer than.

    Checks run before every management command, so a partial overlay that
    updates this file without updating ``config/settings.py`` must skip its
    warning — an AttributeError here would take down ``manage.py`` itself.
    """
    return getattr(settings, name, default)


@register("vaceup_config")
def media_storage_check(app_configs, **kwargs):
    issues = []
    if _setting("AWS_S3_ENDPOINT_REJECTED", False):
        issues.append(Warning(
            "AWS_S3_ENDPOINT_URL is set to something that is not a URL, so it was "
            "ignored and requests go to AWS S3 rather than an R2/B2 endpoint.",
            hint="Set it to https://<accountid>.r2.cloudflarestorage.com, or leave "
                 "the line out entirely: an inline comment is read as the value.",
            id="core.W005",
        ))
    if (_setting("AWS_STORAGE_BUCKET_NAME") or _setting("AWS_ACCESS_KEY_ID")
            or _setting("AWS_SECRET_ACCESS_KEY")) and not _setting("OBJECT_STORAGE_CONFIGURED", False):
        issues.append(Warning(
            "Object storage is only partly configured, so media is kept on local "
            "disk and uploaded videos cannot be stored.",
            hint="Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and "
                 "AWS_STORAGE_BUCKET_NAME together, or clear all three.",
            id="core.W001",
        ))
    if _setting("CLOUDINARY_URL_REJECTED", False) and not _setting("CLOUDINARY_CONFIGURED", False):
        issues.append(Warning(
            "CLOUDINARY_URL is set but is not a "
            "cloudinary://<api_key>:<api_secret>@<cloud_name> URL, so public "
            "images are not going to Cloudinary.",
            hint="Paste the value from the Cloudinary dashboard on one line with "
                 "no trailing comment, or set CLOUDINARY_CLOUD_NAME, "
                 "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET instead.",
            id="core.W006",
        ))
    partial_cloudinary = (
        bool(_setting("CLOUDINARY_CLOUD_NAME") or _setting("CLOUDINARY_API_KEY")
             or _setting("CLOUDINARY_API_SECRET"))
        and not _setting("CLOUDINARY_CONFIGURED", False)
    )
    if partial_cloudinary:
        issues.append(Warning(
            "Cloudinary is partly configured, so public images stay on the "
            "bucket or on local disk instead of Cloudinary.",
            hint="Set all three of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and "
                 "CLOUDINARY_API_SECRET (or a complete CLOUDINARY_URL), or clear "
                 "them.",
            id="core.W007",
        ))
    if _setting("CLOUDINARY_CONFIGURED", False):
        try:
            import cloudinary  # noqa: F401
        except ImportError:
            issues.append(Warning(
                "Cloudinary is configured but the cloudinary package is not "
                "installed in this environment, so public image uploads fail.",
                hint="In the same virtualenv as the app run: "
                     "pip install -r requirements.txt, then restart the Python app.",
                id="core.W008",
            ))
    if (_setting("OBJECT_STORAGE_CONFIGURED", False)
            and not _setting("CLOUDINARY_CONFIGURED", False)
            and not _setting("AWS_S3_CUSTOM_DOMAIN", None)):
        issues.append(Warning(
            "Public images are going to the bucket, whose URL points at the S3 "
            "API endpoint. That endpoint refuses anonymous reads unless the "
            "bucket is explicitly public, so covers can upload fine and still "
            "show as broken images.",
            hint="Configure Cloudinary for public images, or attach a custom "
                 "domain to the bucket and set it as AWS_S3_CUSTOM_DOMAIN.",
            id="core.W009",
        ))
    if not _setting("OBJECT_STORAGE_CONFIGURED", False) and not os.access(
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


@register("vaceup_config")
def live_room_config_check(app_configs, **kwargs):
    """The LiveKit lines, read the way the browser will read them.

    A booked call and an event's VaceUp Live Room both die quietly when the
    address line is wrong, and the public Events page asks the same question for
    every row it lists. Saying it here, at ``manage.py check``, is the difference
    between a one-line fix and a red band nobody can read.
    """
    try:
        from apps.liveclasses.livekit import livekit_ws_url
    except Exception:
        # A check must never be the reason manage.py will not start.
        return []

    issues = []
    raw = str(_setting("LIVEKIT_WS_URL") or "").strip()
    dialable = bool(livekit_ws_url())
    keys = bool(_setting("LIVEKIT_API_KEY") and _setting("LIVEKIT_API_SECRET"))
    if raw and not dialable:
        issues.append(Warning(
            "LIVEKIT_WS_URL is set, but not to an address a browser can dial, so "
            "no VaceUp Live Room will open.",
            hint="Write it on one line as wss://<your-project>.livekit.cloud, "
                 "with no angle brackets, quotes or trailing comment. An "
                 "https:// address is accepted and converted.",
            id="core.W010",
        ))
    elif keys and not dialable:
        issues.append(Warning(
            "The LiveKit keys are set but LIVEKIT_WS_URL is not, so every live "
            "room and staff meeting is refused until it is.",
            hint="Add LIVEKIT_WS_URL=wss://<your-project>.livekit.cloud to the "
                 "server's .env file and restart the app.",
            id="core.W011",
        ))
    if dialable and not str(livekit_ws_url()).startswith("wss://"):
        issues.append(Warning(
            f"The live room address is {livekit_ws_url()}, an unencrypted socket. "
            "A page served over https is refused it, so the room never connects.",
            hint="Change the line to wss:// — LiveKit projects are always wss.",
            id="core.W012",
        ))
    return issues


def _writable_media_dir():
    """The closest existing ancestor of MEDIA_ROOT — creating paths is not a check's job."""
    path = str(_setting("MEDIA_ROOT", ""))
    while path and not os.path.isdir(path):
        parent = os.path.dirname(path)
        if parent == path:
            break
        path = parent
    return path or os.getcwd()


@register("vaceup_config")
def emailed_link_base_check(app_configs, **kwargs):
    issues = []
    configured = urlsplit(str(_setting("FRONTEND_BASE_URL", "")).strip())
    api_host = (urlsplit(str(_setting("MARKETING_PUBLIC_API_URL", "")).strip()).hostname or "").lower()
    fallback = _setting("FRONTEND_LINK_BASE", "")
    if not configured.netloc:
        issues.append(Warning(
            "FRONTEND_BASE_URL is empty; emailed links fall back to "
            f"{fallback}.",
            hint="Set FRONTEND_BASE_URL to the public site origin.",
            id="core.W003",
        ))
    elif (configured.hostname or "").lower() == api_host:
        issues.append(Warning(
            "FRONTEND_BASE_URL points at the API host, which serves no pages, so "
            f"emailed links fall back to {fallback}.",
            hint="Set FRONTEND_BASE_URL to the website origin (https://vaceup.ng), "
                 "not the API origin.",
            id="core.W004",
        ))
    return issues
