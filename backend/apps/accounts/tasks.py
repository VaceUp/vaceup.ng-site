"""Account email workers. New jobs contain row references, never link tokens.

Legacy email/token arguments are accepted during a rolling deployment, but must
still match a live database token. Producers use token_id exclusively.
"""
from celery import shared_task

from apps.accounts import emails
from apps.accounts.mail_delivery import MailDeliveryError, MAX_DELIVERY_RETRIES, run_delivery
from apps.accounts.models import EmailVerificationToken, PasswordResetToken


def deliver_token_email(kind, *, token_id=None, email=None, token=None):
    model, sender, active = {
        "verification": (EmailVerificationToken, emails.send_verification_email, False),
        "password_reset": (PasswordResetToken, emails.send_password_reset_email, True),
    }[kind]
    lookup = {"pk": token_id} if token_id is not None else {"token": token, "user__email__iexact": email}
    record = model.objects.select_related("user").filter(**lookup).first()
    if record is None or not record.is_valid or record.user.is_active != active:
        return False  # stale/rescinded links must not be sent on a delayed retry
    sender(email=record.user.email, token=str(record.token))
    return True


_TASK_OPTIONS = dict(
    bind=True, max_retries=MAX_DELIVERY_RETRIES, ignore_result=True,
    store_errors_even_if_ignored=False, throws=(MailDeliveryError,),
)


@shared_task(name="accounts.send_verification_email", **_TASK_OPTIONS)
def send_verification_email(self, email=None, token=None, *, token_id=None):
    run_delivery("verification", lambda: deliver_token_email(
        "verification", token_id=token_id, email=email, token=token,
    ), task=self)


@shared_task(name="accounts.send_password_reset_email", **_TASK_OPTIONS)
def send_password_reset_email(self, email=None, token=None, *, token_id=None):
    run_delivery("password_reset", lambda: deliver_token_email(
        "password_reset", token_id=token_id, email=email, token=token,
    ), task=self)


@shared_task(name="accounts.send_welcome_email", **_TASK_OPTIONS)
def send_welcome_email(self, email, full_name=""):
    run_delivery("welcome", lambda: emails.send_welcome_email(email=email, full_name=full_name), task=self)
