"""Settle payments Paystack captured but this server never recorded.

The webhook and the return page confirm a payment within seconds of it
happening. This command is the backstop for when neither reaches us: the buyer
closed the tab, the webhook is not registered on the Paystack dashboard, or
Paystack's own retries ran out while the endpoint was unreachable. Every row it
settles goes through the same idempotent verification as the live paths, so
running it repeatedly never double-enrols or double-counts.

Safe on a schedule; it only asks the provider a question and writes the answer.
"""
from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.exceptions import PaymentProviderUnavailable
from apps.payments.models import Payment
from apps.payments.services import RECHECKABLE_STATUSES, reconcile_payments


class Command(BaseCommand):
    help = (
        "Ask Paystack about payments that are not marked successful and enrol "
        "anyone whose money was captured. Idempotent; safe to run on a schedule."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days", type=int, default=30,
            help="Only payments created in the last N days (default 30).",
        )
        parser.add_argument(
            "--limit", type=int, default=200,
            help="Maximum payments checked in one run (default 200).",
        )
        parser.add_argument(
            "--min-age", type=int, default=60,
            help="Skip payments checked in the last N minutes (default 60).",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="List what would be checked without calling Paystack.",
        )

    def handle(self, *args, **options):
        since = timezone.now() - timedelta(days=options["days"])
        payments = list(
            Payment.objects.filter(
                created_at__gte=since,
                status__in=RECHECKABLE_STATUSES,
                updated_at__lt=timezone.now() - timedelta(minutes=options["min_age"]),
            )
            .select_related("student")
            .order_by("-created_at")[:options["limit"]]
        )
        if not payments:
            self.stdout.write("No unsettled payments in the window.")
            return

        if options["dry_run"]:
            for payment in payments:
                self.stdout.write(
                    f"{payment.reference} {payment.status} {payment.amount} "
                    f"{payment.currency} {payment.student.email}"
                )
            self.stdout.write(
                f"{len(payments)} unsettled payment(s) would be checked."
            )
            return

        try:
            repaired = reconcile_payments(payments)
        except PaymentProviderUnavailable:
            self.stderr.write(
                "Paystack is unreachable; nothing was changed. Run again shortly."
            )
            return

        unsettled = list(
            Payment.objects.filter(pk__in=[payment.pk for payment in payments])
            .exclude(status=Payment.Status.SUCCESS)
            .select_related("student")
        )
        self.stdout.write(self.style.SUCCESS(
            f"Checked {len(payments)} payment(s): {repaired} confirmed and "
            f"enrolled, {len(unsettled)} still unsettled."
        ))
        for payment in unsettled[:20]:
            self.stdout.write(
                f"  {payment.reference} {payment.status} {payment.amount} "
                f"{payment.currency} {payment.student.email}"
            )
