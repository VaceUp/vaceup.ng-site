"""Safe settings/SMTP checks: never print secrets, recipients or raw replies."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage, get_connection
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from apps.accounts.mail_delivery import classify_delivery_failure, dispatch_configuration_errors, email_configuration_errors, send_account_message


class Command(BaseCommand):
    help = "Validate email offline; --smtp connects without sending; --send-test prompts for one recipient and sends one test."

    def add_arguments(self, parser):
        parser.add_argument("--smtp", action="store_true")
        parser.add_argument("--send-test", action="store_true", help="Prompt for an address you control, then send one diagnostic email (does not process the queue).")

    def handle(self, *args, **options):
        self.stdout.write(f"Delivery mode: {settings.ACCOUNT_EMAIL_DELIVERY_MODE}")
        self.stdout.write(f"SMTP TLS: {settings.EMAIL_USE_TLS}; implicit SSL: {settings.EMAIL_USE_SSL}")
        errors = email_configuration_errors() + dispatch_configuration_errors()
        if errors:
            raise CommandError(" ".join(errors))
        self.stdout.write("Email configuration checks passed. Inbox delivery is not yet proven.")
        if settings.EMAIL_BACKEND == "apps.accounts.local_smtp.EmailBackend":
            self.stdout.write("Local relay selected: loopback port 25 only; no SMTP authentication or TLS.")
        if options["send_test"]:
            try:
                recipient = input("Send one test email to (an address you control): ").strip()
                validate_email(recipient)
            except (EOFError, KeyboardInterrupt):
                raise CommandError("Test cancelled. No email was sent.") from None
            except ValidationError:
                raise CommandError("Enter one valid email address. No email was sent.") from None
            message = EmailMessage(
                subject="VaceUp email delivery test",
                body=("This is the single delivery test you requested from the VaceUp server.\n\n"
                      "It contains no account link and does not change your account.\n"
                      "Receiving this message confirms this test reached your mailbox; "
                      "registration and reset emails still require the mail queue processor.\n"),
                from_email=settings.DEFAULT_FROM_EMAIL, to=[recipient],
            )
            try:
                send_account_message(message)
            except Exception as exc:
                failure = classify_delivery_failure(exc)
            else:
                self.stdout.write("SMTP/backend accepted one test email. Check the recipient inbox and spam folder. No queued account jobs were processed.")
                return
            raise CommandError(f"{failure.code}: {failure.action}") from None
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
