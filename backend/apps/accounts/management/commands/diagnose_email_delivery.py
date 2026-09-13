"""Safe settings/SMTP checks: never print secrets, recipients or raw replies."""
from django.conf import settings
from django.core.mail import get_connection
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.mail_delivery import classify_delivery_failure, dispatch_configuration_errors, email_configuration_errors


class Command(BaseCommand):
    help = "Validate email configuration offline; --smtp also tests a TLS/auth connection without sending email."

    def add_arguments(self, parser):
        parser.add_argument("--smtp", action="store_true")

    def handle(self, *args, **options):
        self.stdout.write(f"Delivery mode: {settings.ACCOUNT_EMAIL_DELIVERY_MODE}")
        self.stdout.write(f"SMTP TLS: {settings.EMAIL_USE_TLS}; implicit SSL: {settings.EMAIL_USE_SSL}")
        errors = email_configuration_errors() + dispatch_configuration_errors()
        if errors:
            raise CommandError(" ".join(errors))
        self.stdout.write("Email configuration checks passed. Inbox delivery is not yet proven.")
        if options["smtp"]:
            try:
                with get_connection(fail_silently=False):
                    pass
            except Exception as exc:
                failure = classify_delivery_failure(exc)
            else:
                self.stdout.write("SMTP connection accepted. No email was sent.")
                return
            raise CommandError(f"{failure.code}: {failure.action}") from None
