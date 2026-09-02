"""Account lifecycle business logic (the write layer).

Every operation that touches more than one row is atomic; every side effect
(email) is queued with ``transaction.on_commit`` so it only fires after a
successful commit. Views call these and never orchestrate directly.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.accounts import tasks
from apps.accounts.models import (
    EmailVerificationToken,
    PasswordResetToken,
    StudentProfile,
    TutorProfile,
)
from apps.core.exceptions import AlreadyExists, InvalidToken

User = get_user_model()


def _create_profile_for(user) -> None:
    """Create the role-appropriate profile row (idempotent)."""
    if user.role == User.Role.INSTRUCTOR:
        TutorProfile.objects.get_or_create(user=user)
    else:
        StudentProfile.objects.get_or_create(user=user)


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
    transaction.on_commit(
        lambda: tasks.send_verification_email.delay(user.email, str(token.token))
    )
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
    user = User.objects.filter(email__iexact=email, is_active=False).first()
    if user is None:
        return  # don't reveal whether the email exists / is already active

    # Invalidate any outstanding verification tokens, then issue a fresh one.
    EmailVerificationToken.objects.filter(user=user, used=False).update(
        used=True
    )
    token = EmailVerificationToken.objects.create(user=user)
    transaction.on_commit(
        lambda: tasks.send_verification_email.delay(user.email, str(token.token))
    )


@transaction.atomic
def request_password_reset(*, email):
    """Issue a reset token. Always succeeds (no account enumeration)."""
    email = User.objects.normalize_email(email)
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        return

    PasswordResetToken.objects.filter(user=user, used=False).update(used=True)
    token = PasswordResetToken.objects.create(user=user)
    transaction.on_commit(
        lambda: tasks.send_password_reset_email.delay(user.email, str(token.token))
    )


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
