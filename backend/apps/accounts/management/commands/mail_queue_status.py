from django.core.management.base import BaseCommand
from django.db.models import Count, Min
from apps.accounts.models import MailJob


class Command(BaseCommand):
    help = "Show mail queue counts and safe failure codes, never recipients or tokens."

    def handle(self, *args, **options):
        rows = MailJob.objects.values("status", "error_code").annotate(count=Count("id"), oldest=Min("created_at")).order_by("status", "error_code")
        if not rows:
            self.stdout.write("Mail queue is empty in this database. Request a fresh verification link for an inactive account or a password reset for an active account, then check again.")
            return
        for row in rows:
            self.stdout.write(f"{row['status']} code={row['error_code'] or '-'} count={row['count']} oldest={row['oldest']}")
