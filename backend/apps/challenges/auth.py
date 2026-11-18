"""Hashed, expiring challenge credentials that never authenticate an LMS user."""
import hashlib
import hmac
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
    now = timezone.now()
    if kind == "verify":
        expires = now + timedelta(hours=getattr(settings, "CHALLENGE_VERIFY_TTL_HOURS", 48))
    else:
        # Sessions live for the round, not for a day: access ends when the
        # results have been out for two weeks, so a monthly challenge never
        # leaves a permanent portal behind.
        anchored = registration.round.results_publish_at + timedelta(days=14)
        expires = max(now + timedelta(hours=24), min(now + timedelta(days=90), anchored))
    ParticipantToken.objects.create(
        registration=registration, token_hash=token_digest(value), kind=kind,
        access_version=registration.access_version, expires_at=expires,
    )
    return value


def issue_access_code(registration):
    """Six-digit portal code; only its hash is stored, the plain code is
    returned once (confirmation screen or access email) and never logged."""
    code = "".join(str(secrets.randbelow(10)) for _ in range(6))
    registration.access_code_hash = token_digest(f"{registration.pk}:{code}")
    registration.save(update_fields=["access_code_hash", "updated_at"])
    return code


def verify_access_code(registration, code):
    """Email plus code becomes a session - no email round-trip required."""
    if not registration.access_code_hash or len(code) != 6 or not code.isdigit():
        raise AuthenticationFailed("That code does not match this registration. Request a fresh access email.")
    candidate = token_digest(f"{registration.pk}:{code.strip()}")
    if not hmac.compare_digest(candidate, registration.access_code_hash):
        raise AuthenticationFailed("That code does not match this registration. Request a fresh access email.")
    return issue_token(registration, "session")


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
