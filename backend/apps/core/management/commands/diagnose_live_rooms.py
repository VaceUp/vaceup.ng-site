"""Ask the live server, out loud, why a room will not open.

The screens can only show one sentence at a time, and a server-side fault reaches
the browser as "The service is temporarily unavailable" with nothing behind it.
This runs the same code paths those screens run — the address handed to the
browser, the token minted from it, the migrations the tables depend on, and the
actual Events request the website makes — and prints what each one did,
including the traceback when one raises.

It never prints a key, a secret, a room code or an attendee's token.
"""
from __future__ import annotations

import traceback

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.liveclasses.livekit import (
    generate_livekit_token, livekit_configured, livekit_ws_url,
    missing_livekit_settings,
)

PROBE_ROOM = "vaceup-diagnostic-room"


class Command(BaseCommand):
    help = (
        "Report the LiveKit settings, the address the browser is given, whether a "
        "token mints, which migrations are still unapplied, and whether the public "
        "Events request still builds. Read-only; prints no secret."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--check-url",
            help="Report how a candidate LIVEKIT_WS_URL value would reach the browser, "
                 "without changing anything.",
        )

    def handle(self, *args, **options):
        if options["check_url"]:
            self._check_url(options["check_url"])
            return

        self._settings_state()
        self._address_state()
        self._token_state()
        self._migrations_state()
        self._events_request()
        self._meetings_state()

    def _settings_state(self) -> None:
        missing = missing_livekit_settings()
        for name in ("LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_WS_URL"):
            value = str(getattr(settings, name, "") or "").strip()
            state = f"set ({len(value)} characters)" if value else "NOT SET"
            self.stdout.write(f"{name}: {state}")
        if missing:
            self.stdout.write(self.style.WARNING(
                "Add " + ", ".join(missing) + " to the server's .env file, then restart the app."
            ))

    def _address_state(self) -> None:
        address = livekit_ws_url()
        if not address:
            self.stdout.write(self.style.ERROR(
                "The browser is given no address, so no room can open. "
                "This is what the meeting and event screens refuse with."
            ))
            if str(getattr(settings, "LIVEKIT_WS_URL", "") or "").strip():
                self.stdout.write(self.style.ERROR(
                    "LIVEKIT_WS_URL is set but not to an address a browser can dial. "
                    "Write it on one line as wss://<your-project>.livekit.cloud with no "
                    "angle brackets, quotes or trailing comment, then restart the app."
                ))
            return
        self.stdout.write(f"The browser dials: {address}")
        if address.startswith("ws://"):
            self.stdout.write(self.style.WARNING(
                "That is an unencrypted socket. Browsers over https refuse it; write "
                "the .env value as wss:// instead."
            ))

    def _check_url(self, value: str) -> None:
        """Show the repair for a value the academy is thinking of pasting."""
        from django.test import override_settings

        with override_settings(LIVEKIT_WS_URL=value):
            dialled = livekit_ws_url()
        self.stdout.write(f"You wrote:   {value}")
        self.stdout.write(f"The browser would dial: {dialled or '(nothing — treated as missing)'}")

    def _token_state(self) -> None:
        if not livekit_configured():
            self.stdout.write("Token check skipped: the settings above are not complete.")
            return
        try:
            token = generate_livekit_token(
                identity="diagnostic-probe", name="Server diagnostic", room=PROBE_ROOM,
                ttl_seconds=300, can_publish=False,
            )
        except Exception:
            self.stdout.write(self.style.ERROR("Minting a token raised:\n" + traceback.format_exc()))
            return
        if not token:
            self.stdout.write(self.style.ERROR(
                "Minting a token returned nothing. That is a server fault, not a "
                "settings problem — read the traceback printed by the Events check below."
            ))
            return
        import jwt

        try:
            claims = jwt.decode(
                token, settings.LIVEKIT_API_SECRET, algorithms=["HS256"]
            )
        except Exception as exc:
            self.stdout.write(self.style.ERROR(
                f"A token was minted but does not verify against this secret: {type(exc).__name__}: {exc}. "
                "LIVEKIT_API_KEY and LIVEKIT_API_SECRET are probably not the pair from one LiveKit project."
            ))
            return
        video = claims.get("video") or {}
        ttl = int(claims.get("exp", 0)) - int(claims.get("nbf", 0) or claims.get("iat", 0))
        self.stdout.write(
            f"Token mints and verifies against this secret (room {video.get('room', '?')}, valid {ttl} seconds)."
        )

    def _migrations_state(self) -> None:
        """Say whether the tables the events and meeting screens read exist yet.

        A zip unpacked without the matching ``migrate`` leaves the screens asking
        MySQL for columns that were never added, and the browser only ever sees
        "the service is temporarily unavailable".
        """
        from django.db import connections
        from django.db.migrations.loader import MigrationLoader

        with connections["default"].cursor() as cursor:
            try:
                cursor.execute("SELECT app, name FROM django_migrations")
            except Exception:
                self.stdout.write(self.style.WARNING(
                    "Migrations: the migrations table cannot be read, so nothing can "
                    "be reported here. Run python manage.py showmigrations instead."
                ))
                return
            applied = {tuple(row) for row in cursor.fetchall()}

        loader = MigrationLoader(connections["default"], ignore_no_migrations=True)
        for label in ("website", "meetings"):
            on_disk = sorted(name for app, name in loader.disk_migrations if app == label)
            unapplied = [name for name in on_disk if (label, name) not in applied]
            if unapplied:
                self.stdout.write(self.style.ERROR(
                    f"{label}: {len(unapplied)} of {len(on_disk)} migrations are not "
                    f"applied ({', '.join(unapplied)}). "
                    f"Run: python manage.py migrate {label}"
                ))
            else:
                self.stdout.write(f"{label}: all {len(on_disk)} migrations applied.")

    def _events_request(self) -> None:
        """Build the page the website actually asks for, and show what it did."""
        from django.test import Client, override_settings

        # The command runs on the box, so it may name any host it likes; the
        # point is to reach the view, not to test which domain it answers.
        # Ask over https, because the deployment redirects http to it and a
        # 301 would otherwise be reported instead of the answer the site gets.
        with override_settings(ALLOWED_HOSTS=["*"]):
            client = Client(SERVER_NAME="api.vaceup.ng")
            for path in ("/api/v1/website/events/", "/api/v1/meetings/readiness/"):
                try:
                    response = client.get(path, HTTP_ACCEPT="application/json", secure=True)
                except Exception:
                    self.stdout.write(self.style.ERROR(f"{path} raised:\n{traceback.format_exc()}"))
                    response_failed = True
                else:
                    body = response.content[:180].decode("utf-8", "replace").strip()
                    line = f"{path} -> HTTP {response.status_code}"
                    response_failed = response.status_code >= 500
                    if response_failed:
                        self.stdout.write(self.style.ERROR(line + f"\n  body: {body}"))
                    elif 300 <= response.status_code < 400:
                        self.stdout.write(line + " (redirected; the request did reach the app)")
                    else:
                        self.stdout.write(
                            line + (" (sign-in required, as expected)" if response.status_code == 401 else "")
                        )
                if response_failed and path.endswith("events/"):
                    self.stdout.write(self.style.ERROR(
                        "Events is the screen that answers \"The service is temporarily "
                        "unavailable\". Read the migrations line above first — an "
                        "unapplied website migration is what usually does this."
                    ))
                    return

    def _meetings_state(self) -> None:
        from apps.meetings.services import room_is_ready, room_off_notice

        if room_is_ready():
            self.stdout.write("Staff meetings: ready.")
        else:
            self.stdout.write(self.style.WARNING(f"Staff meetings: {room_off_notice()}"))
