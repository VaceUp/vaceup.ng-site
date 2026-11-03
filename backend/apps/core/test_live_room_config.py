"""A wrong LiveKit line is a room that will not open, never a broken site.

The public Events page asks the room address for every row it lists, so a value
that cannot be parsed can turn the whole page into "The service is temporarily
unavailable" with nothing to act on. The address is repaired or dropped before
it leaves the server, the check names the line before the deploy, and the
diagnostic command reads the live server — including whether the tables the
Events page queries have been migrated at all, which is the other way that
sentence gets here.
"""
from __future__ import annotations

from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.core.checks import live_room_config_check
from apps.website.models import Event

GOOD = {
    "LIVEKIT_API_KEY": "devkey",
    "LIVEKIT_API_SECRET": "devsecret-devsecret-devsecret-9f",
    "LIVEKIT_WS_URL": "wss://proj.livekit.cloud",
}


def _ids(**overrides) -> list:
    with override_settings(**{**GOOD, **overrides}):
        return [issue.id for issue in live_room_config_check(None)]


class LiveRoomConfigCheckTests(TestCase):
    def test_a_complete_configuration_is_silent(self):
        self.assertEqual(_ids(), [])

    def test_an_address_a_browser_cannot_dial_is_named_as_the_line_that_is_wrong(self):
        self.assertIn("core.W010", _ids(LIVEKIT_WS_URL="wss://<your-project>.livekit.cloud"))
        self.assertIn("core.W010", _ids(LIVEKIT_WS_URL="paste the URL from the dashboard here"))

    def test_keys_without_an_address_are_named_as_the_missing_line(self):
        self.assertIn("core.W011", _ids(LIVEKIT_WS_URL=""))
        self.assertNotIn("core.W010", _ids(LIVEKIT_WS_URL=""))

    def test_a_plain_http_address_is_accepted_but_a_bare_socket_is_warned_about(self):
        self.assertEqual(_ids(LIVEKIT_WS_URL="https://proj.livekit.cloud"), [])
        self.assertIn("core.W012", _ids(LIVEKIT_WS_URL="ws://proj.livekit.cloud"))

    def test_nothing_is_claimed_when_the_keys_are_absent_too(self):
        ids = _ids(LIVEKIT_WS_URL="", LIVEKIT_API_KEY="", LIVEKIT_API_SECRET="")
        self.assertEqual(ids, [])


class DiagnoseLiveRoomsTests(TestCase):
    """The operator reads the state, never a value."""

    def _run(self, **overrides) -> str:
        out = StringIO()
        with override_settings(**{**GOOD, **overrides}):
            call_command("diagnose_live_rooms", stdout=out)
        return out.getvalue()

    def test_it_reports_the_address_the_browser_gets_and_that_the_events_page_builds(self):
        report = self._run()
        self.assertIn("The browser dials: wss://proj.livekit.cloud", report)
        self.assertIn("Token mints and verifies", report)
        self.assertIn("/api/v1/website/events/ -> HTTP 200", report)
        self.assertIn("Staff meetings: ready", report)

    def test_a_malformed_address_is_reported_instead_of_bringing_the_page_down(self):
        Event.objects.create(
            title="Live workshop", starts_at=timezone.now() + timedelta(days=1),
            is_online=True, is_published=True,
            live_platform=Event.LivePlatform.VACEUP_ROOM,
        )
        report = self._run(LIVEKIT_WS_URL="wss://[oops")
        self.assertIn("LIVEKIT_WS_URL: set (11 characters)", report)
        self.assertIn("The browser is given no address", report)
        self.assertIn("not to an address a browser can dial", report)
        self.assertIn("/api/v1/website/events/ -> HTTP 200", report)

    def test_a_missing_address_says_which_line_to_add(self):
        report = self._run(LIVEKIT_WS_URL="", LIVEKIT_API_KEY="", LIVEKIT_API_SECRET="")
        self.assertIn("LIVEKIT_WS_URL: NOT SET", report)
        self.assertIn("Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL", report)

    def test_it_never_prints_a_credential(self):
        report = self._run(
            LIVEKIT_API_KEY="api-key-should-not-appear",
            LIVEKIT_API_SECRET="api-secret-should-not-appear-000000",
        )
        for value in ("api-key-should-not-appear", "api-secret-should-not-appear-000000"):
            self.assertNotIn(value, report)
        self.assertIn("LIVEKIT_API_SECRET: set (", report)

    def test_it_names_the_tables_the_events_page_needs(self):
        report = self._run()
        self.assertRegex(report, r"website: all \d+ migrations applied\.")
        self.assertRegex(report, r"meetings: all \d+ migrations applied\.")

    def test_a_migration_that_has_not_been_applied_is_named_by_name(self):
        from django.db import connections

        with connections["default"].cursor() as cursor:
            cursor.execute(
                "DELETE FROM django_migrations WHERE app = 'website' AND name = '0009_eventregistrant_broadcast_marker'"
            )
        report = self._run()
        self.assertIn("are not applied (0009_eventregistrant_broadcast_marker)", report)
        self.assertIn("python manage.py migrate website", report)

    def test_a_candidate_value_can_be_checked_without_writing_it_anywhere(self):
        out = StringIO()
        call_command(
            "diagnose_live_rooms", check_url="https://proj.livekit.cloud", stdout=out
        )
        report = out.getvalue()
        self.assertIn("You wrote:   https://proj.livekit.cloud", report)
        self.assertIn("The browser would dial: wss://proj.livekit.cloud", report)
