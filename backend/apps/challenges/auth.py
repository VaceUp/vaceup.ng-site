"""Hashed, expiring challenge credentials that never authenticate an LMS user."""
import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed

from .models import ParticipantToken


def token_digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def issue_token(registration, kind):
    value = secrets.token_urlsafe(32)
    hours = getattr(settings, "CHALLENGE_VERIFY_TTL_HOURS", 48) if kind == "verify" else getattr(settings, "CHALLENGE_SESSION_TTL_HOURS", 24)
    ParticipantToken.objects.create(
        registration=registration, token_hash=token_digest(value), kind=kind,
        access_version=registration.access_version, expires_at=timezone.now() + timedelta(hours=hours),
    )
    return value


def participant(request):
    value = request.headers.get("X-Challenge-Token", "")
    if not value or len(value) > 120:
        raise AuthenticationFailed("Open your personal challenge link or request a new access email.")
    token = ParticipantToken.objects.select_related("registration__round", "registration__category").filter(
        token_hash=token_digest(value), kind="session", expires_at__gt=timezone.now(),
    ).first()
    if token is None or token.access_version != token.registration.access_version or token.registration.email_verified_at is None:
        raise AuthenticationFailed("Your challenge session has expired. Request a new access email.")
    return token.registration


@transaction.atomic
def verify_token(value):
    if not isinstance(value, str) or not value or len(value) > 120:
        raise AuthenticationFailed("This verification link is invalid. Request a new access email.")
    token = ParticipantToken.objects.select_for_update().select_related("registration").filter(
        token_hash=token_digest(value), kind="verify", used_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if token is None or token.access_version != token.registration.access_version:
        raise AuthenticationFailed("This verification link has expired or was already used. Request a new access email.")
    token.used_at = timezone.now()
    token.save(update_fields=["used_at", "updated_at"])
    registration = token.registration
    if registration.email_verified_at is None:
        registration.email_verified_at = timezone.now()
        registration.save(update_fields=["email_verified_at", "updated_at"])
    return registration, issue_token(registration, "session")
