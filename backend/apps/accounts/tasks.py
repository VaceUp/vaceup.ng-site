"""Celery tasks for account emails (verification, password reset).

Thin wrappers over ``apps.accounts.emails`` so the send happens off the request
thread. Enqueued from services via ``transaction.on_commit`` so a rolled-back
registration never sends. Auto-retry on transient SMTP errors.
"""
from celery import shared_task

from apps.accounts import emails

_RETRY = dict(autoretry_for=(Exception,), retry_backoff=True,
              retry_kwargs={"max_retries": 3})


@shared_task(name="accounts.send_verification_email", **_RETRY)
def send_verification_email(email, token):
    emails.send_verification_email(email=email, token=token)


@shared_task(name="accounts.send_password_reset_email", **_RETRY)
def send_password_reset_email(email, token):
    emails.send_password_reset_email(email=email, token=token)
