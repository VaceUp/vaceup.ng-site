"""Read-only deployment check for routes previously missing on the live server."""
from django.core.management.base import BaseCommand, CommandError
from django.urls import Resolver404, resolve


class Command(BaseCommand):
    help = "Verify critical installed routes without sending mail, making payments or deleting users."

    def handle(self, *args, **options):
        required = {
            "/api/v1/admin/dashboard/users/1/deletion/": "GET",
            "/api/v1/admin/dashboard/users/delete/": "POST",
            "/api/v1/auth/password-reset/": "POST",
            "/api/v1/auth/password-reset/confirm/": "POST",
            "/api/v1/courses/import-homepage/": "POST",
            "/api/v1/admin/dashboard/enrollments/grant/": "POST",
            "/api/v1/payments/checkout/": "POST",
            "/api/v1/payments/verify/": "POST",
            "/api/v1/messages/contacts/": "GET",
            "/api/v1/messages/read/": "POST",
            "/api/v1/notifications/1/read/": "POST",
        }
        missing = []
        for path, method in required.items():
            try:
                match = resolve(path)
                actions = getattr(match.func, "actions", None)
                view_class = getattr(match.func, "cls", None) or getattr(match.func, "view_class", None)
                valid = method.lower() in actions if actions is not None else hasattr(view_class, method.lower())
            except Resolver404:
                valid = False
            self.stdout.write(f"{'PASS' if valid else 'MISSING'} {method} {path}")
            if not valid:
                missing.append(path)
        if missing:
            raise CommandError("Installed backend is incomplete. Extract the full release into the Application Root and restart the Python app.")
        self.stdout.write("Routes exist in this process. Restart cPanel's web application, then test the public routes separately.")
