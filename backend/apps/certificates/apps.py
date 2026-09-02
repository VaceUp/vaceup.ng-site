"""Certificates app config."""

from django.apps import AppConfig


class CertificatesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.certificates"
    verbose_name = "Certificates"

    def ready(self):
        # Import signals to connect auto-issue on completion
        import apps.certificates.signals  # noqa