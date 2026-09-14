"""Offline configuration checks and allowlisted, secret-free delivery errors."""
from dataclasses import dataclass
from email.utils import parseaddr
import math
import logging
import smtplib
import ssl
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.mail import get_connection
from django.core.mail.backends.smtp import EmailBackend as SMTPBackend
from django.core.validators import validate_email

from apps.accounts.local_smtp import EmailBackend as LocalRelayEmailBackend, LocalRelayConfigurationError


logger = logging.getLogger("accounts.mail")
MAX_DELIVERY_RETRIES = 3
RETRY_DELAY_SECONDS = 5


class MailDeliveryError(Exception):
    """A safe error that can be recorded by Celery without SMTP response text."""


@dataclass(frozen=True)
class DeliveryFailure:
    code: str
    action: str
    retryable: bool = False

    def as_error(self):
        return MailDeliveryError(f"{self.code}: {self.action}")


def classify_delivery_failure(exc):
    """Never include str(exc), server replies, recipients or connection URLs."""
    if isinstance(exc, ssl.SSLCertVerificationError):
        return DeliveryFailure(
            "tls_certificate", "Check the SMTP hostname, server certificate chain, "
            "system clock and trusted CA bundle; keep certificate verification enabled.",
        )
    if isinstance(exc, ssl.SSLError):
        return DeliveryFailure(
            "tls_protocol", "Check the provider's STARTTLS/implicit TLS port and TLS support.",
        )
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return DeliveryFailure(
            "smtp_authentication", "Check SMTP credentials, app-password requirements "
            "and the provider's SMTP access policy.", 400 <= exc.smtp_code < 500,
        )
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        temporary = bool(exc.recipients) and all(
            400 <= response[0] < 500 for response in exc.recipients.values()
        )
        return DeliveryFailure(
            "smtp_recipient", "Check the recipient and provider rejection/delivery logs.", temporary,
        )
    if isinstance(exc, smtplib.SMTPResponseException):
        return DeliveryFailure(
            "smtp_temporary" if 400 <= exc.smtp_code < 500 else "smtp_rejected",
            "Check provider logs, sender authorization, quotas and sending policy.",
            400 <= exc.smtp_code < 500,
        )
    if isinstance(exc, smtplib.SMTPNotSupportedError):
        return DeliveryFailure(
            "smtp_capability", "Check that the SMTP endpoint supports the configured TLS and authentication mode.",
        )
    if isinstance(exc, (FileNotFoundError, PermissionError, ImproperlyConfigured, ValueError)):
        return DeliveryFailure(
            "configuration", "Run diagnose_email_delivery in the web and worker environments; fix reported settings.",
        )
    if isinstance(exc, (smtplib.SMTPServerDisconnected, ConnectionError, TimeoutError, OSError)):
        # SMTPException inherits OSError, but a generic SMTP failure isn't
        # necessarily transient. Known response/capability errors are above.
        if not isinstance(exc, smtplib.SMTPException) or isinstance(exc, smtplib.SMTPServerDisconnected):
            return DeliveryFailure(
                "smtp_connection", "Check DNS, outbound SMTP firewall rules, provider availability and timeout.", True,
            )
    if isinstance(exc, MailDeliveryError):
        return DeliveryFailure("backend_no_delivery", "Check the configured email backend and its delivery logs.")
    return DeliveryFailure(
        "delivery_error", "Check the deployed email backend and dependencies; run diagnose_email_delivery.",
    )


def email_configuration_errors():
    """Inspect settings and construct the backend without opening a connection."""
    errors = []
    backend = settings.EMAIL_BACKEND
    if backend in {
        "django.core.mail.backends.console.EmailBackend",
        "django.core.mail.backends.filebased.EmailBackend",
        "django.core.mail.backends.dummy.EmailBackend",
    }:
        errors.append("EMAIL_BACKEND does not deliver mail. Configure SMTP or a delivery provider; do not log account links.")
    try:
        connection = get_connection(fail_silently=False)
    except LocalRelayConfigurationError as exc:
        connection = None
        errors.append(str(exc))  # this exception contains static guidance only
    except Exception:
        connection = None
        errors.append("Email backend could not be initialized. Check EMAIL_BACKEND and mutually exclusive TLS/SSL flags.")

    is_smtp = isinstance(connection, SMTPBackend) or backend == "django.core.mail.backends.smtp.EmailBackend"
    if is_smtp:
        if not settings.EMAIL_HOST:
            errors.append("EMAIL_HOST is missing.")
        if settings.EMAIL_USE_TLS and settings.EMAIL_USE_SSL:
            errors.append("EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be True.")
        if (not settings.EMAIL_USE_TLS and not settings.EMAIL_USE_SSL
                and not isinstance(connection, LocalRelayEmailBackend)):
            errors.append("Account emails require STARTTLS or implicit TLS; configure the provider's secure SMTP mode.")
        if settings.EMAIL_PORT == 465 and not settings.EMAIL_USE_SSL:
            errors.append("Port 465 normally requires EMAIL_USE_SSL=True and EMAIL_USE_TLS=False.")
        if settings.EMAIL_PORT == 587 and settings.EMAIL_USE_SSL:
            errors.append("Port 587 normally requires EMAIL_USE_TLS=True and EMAIL_USE_SSL=False.")
        timeout = settings.EMAIL_TIMEOUT
        if not isinstance(timeout, (int, float)) or not math.isfinite(timeout) or not 0 < timeout <= 60:
            errors.append("EMAIL_TIMEOUT must be greater than zero and at most 60 seconds.")
        if not isinstance(settings.EMAIL_PORT, int) or not 1 <= settings.EMAIL_PORT <= 65535:
            errors.append("EMAIL_PORT must be between 1 and 65535.")
        if bool(settings.EMAIL_HOST_USER) != bool(settings.EMAIL_HOST_PASSWORD):
            errors.append("Set both EMAIL_HOST_USER and EMAIL_HOST_PASSWORD, or neither for an authorized relay.")

    try:
        sender = settings.DEFAULT_FROM_EMAIL
        if "\r" in sender or "\n" in sender:
            raise ValidationError("Invalid sender")
        validate_email(parseaddr(sender)[1])
    except (ValidationError, TypeError, ValueError):
        errors.append("DEFAULT_FROM_EMAIL must contain a valid sender address authorized by the provider.")
    try:
        frontend = urlsplit(settings.FRONTEND_BASE_URL)
        local_http = settings.DEBUG and frontend.scheme == "http" and frontend.hostname in {"localhost", "127.0.0.1", "::1"}
        if (not frontend.hostname or (frontend.scheme != "https" and not local_http)
                or frontend.username or frontend.password or frontend.query or frontend.fragment):
            raise ValueError
        frontend.port  # Validate a supplied port without echoing the URL.
    except (AttributeError, TypeError, ValueError):
        errors.append("FRONTEND_BASE_URL must be an HTTPS base URL without credentials, query or fragment (local HTTP only with DEBUG).")
    return errors


def dispatch_configuration_errors():
    """No broker connection: validate the chosen execution path separately."""
    mode = settings.ACCOUNT_EMAIL_DELIVERY_MODE
    if mode not in {"async", "sync", "database"}:
        return ["ACCOUNT_EMAIL_DELIVERY_MODE must be async, sync or database."]
    if mode == "async" and not settings.CELERY_TASK_ALWAYS_EAGER:
        broker = settings.CELERY_BROKER_URL
        if not broker:
            return ["Async account mail requires CELERY_BROKER_URL (or REDIS_URL) and a worker consuming emails."]
        if isinstance(broker, str) and broker.startswith("memory://"):
            return ["memory:// is process-local and cannot deliver to a separate worker. Configure a shared broker, or explicitly select sync on cPanel."]
    return []


def send_account_message(message):
    errors = email_configuration_errors()
    if errors:
        raise ImproperlyConfigured(" ".join(errors))
    if message.send(fail_silently=False) != 1:
        raise MailDeliveryError("Email backend did not accept the message.")


def run_delivery(kind, deliver, *, task=None):
    """One attempt; only a worker schedules bounded, transient retries.

    Construct safe exceptions outside the except block: raw SMTP responses must
    never become exception chains in worker logs or retry/result metadata.
    """
    attempt = (task.request.retries if task is not None else 0) + 1
    try:
        accepted = deliver()
    except Exception as exc:
        failure = classify_delivery_failure(exc)
    else:
        logger.info("account_email kind=%s stage=delivery status=%s attempt=%s",
                    kind, "accepted" if accepted is not False else "skipped", attempt)
        return

    retry = task is not None and failure.retryable and attempt <= MAX_DELIVERY_RETRIES
    logger.error("account_email kind=%s stage=delivery code=%s attempt=%s retry=%s action=%s",
                 kind, failure.code, attempt, retry, failure.action)
    safe_error = failure.as_error()
    if retry:
        # Task.retry can itself fail to publish. Never let a raw broker exception
        # (possibly containing credentials) escape that second boundary either.
        from celery.exceptions import Retry
        try:
            raise task.retry(
                exc=safe_error, countdown=RETRY_DELAY_SECONDS * (2 ** (attempt - 1)),
                max_retries=MAX_DELIVERY_RETRIES, argsrepr="()", kwargsrepr="<account mail reference>",
            )
        except Retry:
            raise
        except Exception:
            safe_error = MailDeliveryError("retry_publish_failed: Restore the broker and request a fresh link.")
            logger.error("account_email kind=%s stage=publish code=retry_publish_failed", kind)
    raise safe_error from None
