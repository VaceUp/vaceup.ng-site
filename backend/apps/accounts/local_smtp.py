"""Explicit opt-in for an authorized, unauthenticated loopback SMTP relay.

Select with EMAIL_BACKEND=apps.accounts.local_smtp.EmailBackend. This backend
never downgrades or falls back from remote SMTP. It does not install a relay.
"""
import math

from django.core.exceptions import ImproperlyConfigured
from django.core.mail.backends.smtp import EmailBackend as SMTPBackend


class LocalRelayConfigurationError(ImproperlyConfigured):
    """Only static, secret-free messages may be raised with this type."""


class EmailBackend(SMTPBackend):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._validate_and_pin()

    def _validate_and_pin(self):
        host = self.host.lower() if isinstance(self.host, str) else ""
        if host not in {"localhost", "127.0.0.1", "::1"}:
            raise LocalRelayConfigurationError(
                "The local relay backend requires EMAIL_HOST=localhost, 127.0.0.1 or ::1. "
                "Use Django's SMTP backend with TLS for a remote mail server."
            )
        if self.port != 25:
            raise LocalRelayConfigurationError("The local relay backend requires EMAIL_PORT=25.")
        if self.use_tls or self.use_ssl:
            raise LocalRelayConfigurationError(
                "The local relay backend requires EMAIL_USE_TLS=False and EMAIL_USE_SSL=False. "
                "Use Django's SMTP backend for encrypted SMTP."
            )
        if self.username or self.password:
            raise LocalRelayConfigurationError(
                "Clear both EMAIL_HOST_USER and EMAIL_HOST_PASSWORD for the local relay backend. "
                "Credentials must not be sent over an unencrypted connection."
            )
        if (not isinstance(self.timeout, (int, float)) or isinstance(self.timeout, bool)
                or not math.isfinite(self.timeout) or not 0 < self.timeout <= 60):
            raise LocalRelayConfigurationError("Set EMAIL_TIMEOUT to a number greater than zero and at most 60 seconds.")
        # Do not resolve even 'localhost' through DNS or a misconfigured hosts
        # file. Numeric loopback addresses are the only actual destinations.
        self.host = "127.0.0.1" if host == "localhost" else host

    def open(self):
        # Re-check before opening, including for callers that reuse/mutate a
        # connection object. fail_silently must not hide configuration errors.
        self._validate_and_pin()
        return super().open()
