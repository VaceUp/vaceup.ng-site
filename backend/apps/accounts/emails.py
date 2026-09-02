"""Transactional email senders for the accounts lifecycle.

Kept dependency-light (Django ``send_mail``) and called from services via
``transaction.on_commit`` so a rolled-back registration never emails a link.
When Celery lands (Phase 1), swap the direct sends here for ``.delay()`` calls
— the call sites in services do not change.
"""
from __future__ import annotations

from django.conf import settings
from django.core.mail import send_mail


def _frontend(path: str) -> str:
    base = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
    return f"{base}{path}"


def send_verification_email(*, email: str, token: str) -> None:
    link = _frontend(f"/verify-email?token={token}")
    send_mail(
        subject="Verify your VaceUp account",
        message=(
            "Welcome to VaceUp!\n\n"
            "Please confirm your email address to activate your account:\n"
            f"{link}\n\n"
            "This link expires in 24 hours. If you didn't sign up, ignore "
            "this email."
        ),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[email],
        fail_silently=False,
    )


def send_password_reset_email(*, email: str, token: str) -> None:
    link = _frontend(f"/reset-password?token={token}")
    send_mail(
        subject="Reset your VaceUp password",
        message=(
            "We received a request to reset your VaceUp password.\n\n"
            f"Reset it here (valid for 1 hour):\n{link}\n\n"
            "If you didn't request this, you can safely ignore this email — "
            "your password will not change."
        ),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[email],
        fail_silently=False,
    )
