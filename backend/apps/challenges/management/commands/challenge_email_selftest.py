"""Diagnose challenge brief-email delivery without touching participants.

Run on the server with the deployed environment, e.g.:
    python manage.py challenge_email_selftest --to you@example.com

It reports exactly two things, in order: whether the email configuration
passes every delivery check, and whether SMTP accepts a challenge-shaped
test message. It never prints credentials or raw SMTP transcripts.
"""
import json

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.mail_delivery import (
    classify_delivery_failure,
    dispatch_configuration_errors,
    email_configuration_errors,
    send_account_message,
)
from apps.core.email_layout import render_email


class Command(BaseCommand):
    help = "Validate the email configuration and send one challenge-shaped test email."

    def add_arguments(self, parser):
        parser.add_argument("--to", required=True, help="Destination address for the test email.")

    def handle(self, *args, **options):
        report = {"configuration": {}, "delivery": {}}
        mode_errors = dispatch_configuration_errors()
        config_errors = email_configuration_errors()
        report["configuration"]["errors"] = mode_errors + config_errors
        report["configuration"]["ok"] = not (mode_errors or config_errors)
        if report["configuration"]["ok"]:
            self.stdout.write("Configuration: ok. All delivery checks passed.")
        else:
            for error in report["configuration"]["errors"]:
                self.stdout.write(f"Configuration problem: {error}")

        from django.conf import settings
        from django.core.mail import EmailMultiAlternatives
        text = (
            "Hi there,\n\nThis is a test of the VaceUp challenge email delivery. "
            "If you can read this, SMTP accepts challenge emails and the configuration is healthy.\n\n"
            "The VaceUp challenge team"
        )
        message = EmailMultiAlternatives(
            subject="VaceUp challenge email self-test", body=text, to=[options["to"]],
        )
        message.attach_alternative(render_email(
            title="Challenge email self-test", text=text, category="Monthly skills challenge",
            footer="You are receiving this because a challenge self-test named this address.",
        ), "text/html")
        try:
            send_account_message(message)
            report["delivery"] = {"ok": True, "detail": f"SMTP accepted the test email for {options['to']}."}
            self.stdout.write(report["delivery"]["detail"])
        except Exception as exc:
            failure = classify_delivery_failure(exc)
            report["delivery"] = {"ok": False, "code": failure.code, "action": failure.action}
            self.stdout.write(f"Delivery failed: {failure.code}. {failure.action}")
        self.stdout.write(json.dumps(report, indent=2))
        if not (report["configuration"]["ok"] and report["delivery"]["ok"]):
            raise CommandError("Email delivery is not healthy; fix the items above and rerun.")
