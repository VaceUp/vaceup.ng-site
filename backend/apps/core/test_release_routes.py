"""Ensure deployment checks reject old routers that swallow action names."""
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import SimpleTestCase
from django.urls import resolve


class ReleaseRouteTests(SimpleTestCase):
    def test_current_routes_pass_without_database_access(self):
        output = StringIO()
        call_command("check_release_routes", stdout=output)
        self.assertEqual(output.getvalue().count("PASS "), 14)

    def test_get_detail_route_is_not_a_settings_action(self):
        for path in (
            "/api/v1/admin/settings/definitions/",
            "/api/v1/admin/settings/public/",
        ):
            with self.subTest(path=path):
                def legacy_resolve(url):
                    if url == path:
                        return SimpleNamespace(func=SimpleNamespace(actions={"get": "retrieve"}))
                    return resolve(url)

                with patch("apps.core.management.commands.check_release_routes.resolve", side_effect=legacy_resolve):
                    with self.assertRaises(CommandError):
                        call_command("check_release_routes", stdout=StringIO())

    def test_post_method_alone_does_not_prove_import_action(self):
        def wrong_resolve(url):
            if url == "/api/v1/courses/import-homepage/":
                return SimpleNamespace(func=SimpleNamespace(actions={"post": "create"}))
            return resolve(url)

        with patch("apps.core.management.commands.check_release_routes.resolve", side_effect=wrong_resolve):
            with self.assertRaises(CommandError):
                call_command("check_release_routes", stdout=StringIO())
