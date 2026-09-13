"""Account lifecycle business logic (the write layer).

Every operation that touches more than one row is atomic; every side effect
(email) is queued with ``transaction.on_commit`` so it only fires after a
successful commit. Views call these and never orchestrate directly.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.accounts import tasks
from apps.accounts.mail_delivery import dispatch_configuration_errors, run_delivery
from apps.accounts.models import (
    EmailVerificationToken,
    PasswordResetToken,
    StudentProfile,
    TutorProfile,
)
from apps.core.exceptions import AlreadyExists, InvalidToken

User = get_user_model()
logger = logging.getLogger("accounts.mail")


def _dispatch_token_email(kind, token_id):
    """Return whether the broker/backend accepted the request, never inbox status."""
    errors = dispatch_configuration_errors()
    if errors:
        logger.error("account_email kind=%s stage=dispatch code=configuration action=%s", kind, " ".join(errors))
        return False
    if settings.ACCOUNT_EMAIL_DELIVERY_MODE == "sync":
        try:
            run_delivery(kind, lambda: tasks.deliver_token_email(kind, token_id=token_id))
        except Exception:
            # run_delivery already logs an allowlisted explanation. Keep reset
            # and resend responses identical for existing and unknown accounts.
            return False
        return True

    task = tasks.send_verification_email if kind == "verification" else tasks.send_password_reset_email
    try:
        task.apply_async(kwargs={"token_id": token_id}, argsrepr="()", kwargsrepr="<account mail reference>")
    except Exception:
        logger.error(
            "account_email kind=%s stage=publish code=queue_unavailable "
            "action=Check broker access and the emails worker; request a fresh link after recovery.", kind,
        )
        return False
    logger.info("account_email kind=%s stage=publish status=queued queue=emails", kind)
    return True


def _create_profile_for(user) -> None:
    """Create the role-appropriate profile row (idempotent)."""
    if user.role == User.Role.INSTRUCTOR:
        TutorProfile.objects.get_or_create(user=user)
    else:
        StudentProfile.objects.get_or_create(user=user)


def _schedule_token_email(kind, record, user=None):
    if settings.ACCOUNT_EMAIL_DELIVERY_MODE == "database":
        from apps.accounts.outbox import enqueue_token
        enqueue_token(kind, record)  # same transaction as account/token creation
        return

    def dispatch():
        accepted = _dispatch_token_email(kind, record.pk)
        if user is not None:
            user.verification_email_queued = accepted
    transaction.on_commit(dispatch)


@transaction.atomic
def register_user(*, email, full_name, password, role=None, **profile):
    """Create an inactive user, their profile, and a verification token.

    Preconditions: email not already registered (case-insensitive).
    Side effects: on commit, send the verification email.
    Raises: ``AlreadyExists`` if the email is taken.
    """
    role = role or User.Role.STUDENT
    email = User.objects.normalize_email(email)

    # Uniqueness is also enforced by the DB; this gives a clean 409.
    if User.objects.filter(email__iexact=email).exists():
        raise AlreadyExists("An account with this email already exists.")

    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        role=role,
        is_active=False,  # activated only after email verification
    )
    _create_profile_for(user)

    token = EmailVerificationToken.objects.create(user=user)
    user.verification_email_queued = True

    _schedule_token_email("verification", token, user)
    return user


@transaction.atomic
def verify_email(*, token):
    """Consume a verification token and activate the user.

    Raises ``InvalidToken`` if the token is missing, used, or expired.
    """
    try:
        vt = (
            EmailVerificationToken.objects.select_for_update()
            .select_related("user")
            .get(token=token)
        )
    except (EmailVerificationToken.DoesNotExist, ValueError, TypeError):
        raise InvalidToken()

    if not vt.is_valid:
        raise InvalidToken()

    vt.consume()
    user = vt.user
    if not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])
    return user


@transaction.atomic
def resend_verification(*, email):
    """Re-issue a verification token. Always succeeds (no enumeration).

    Silently no-ops for unknown emails and already-active accounts.
    """
    email = User.objects.normalize_email(email)
    user = User.objects.select_for_update().filter(email__iexact=email, is_active=False).first()
    if user is None:
        return  # don't reveal whether the email exists / is already active

    # Invalidate any outstanding verification tokens, then issue a fresh one.
    EmailVerificationToken.objects.filter(user=user, used=False).update(
        used=True
    )
    token = EmailVerificationToken.objects.create(user=user)
    _schedule_token_email("verification", token)


@transaction.atomic
def request_password_reset(*, email):
    """Issue a reset token. Always succeeds (no account enumeration)."""
    email = User.objects.normalize_email(email)
    user = User.objects.select_for_update().filter(email__iexact=email, is_active=True).first()
    if user is None:
        return

    PasswordResetToken.objects.filter(user=user, used=False).update(used=True)
    token = PasswordResetToken.objects.create(user=user)
    _schedule_token_email("password_reset", token)


@transaction.atomic
def reset_password(*, token, new_password):
    """Consume a reset token, set the password, and revoke all refresh tokens.

    Revoking outstanding JWTs means a stolen session can't outlive a reset.
    Raises ``InvalidToken`` on a bad/used/expired token.
    """
    try:
        rt = (
            PasswordResetToken.objects.select_for_update()
            .select_related("user")
            .get(token=token)
        )
    except (PasswordResetToken.DoesNotExist, ValueError, TypeError):
        raise InvalidToken()

    if not rt.is_valid:
        raise InvalidToken()

    rt.consume()
    user = rt.user
    user.set_password(new_password)
    user.save(update_fields=["password"])
    _revoke_all_refresh_tokens(user)
    return user


def _revoke_all_refresh_tokens(user) -> None:
    """Blacklist every outstanding refresh token for the user."""
    # Local import: the blacklist app owns these tables.
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)
