"""Regression cover for the two configuration failures that broke live workflows.

Image uploads died because a bucket name alone selected the S3 backend, and
emailed links died because the frontend base could point somewhere that
serves no pages. Both are decided at settings import, so the tests pin the
decision functions rather than a machine's .env.
"""
from __future__ import annotations

from base64 import b64decode
from pathlib import Path
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from apps.accounts.emails import _frontend
from config.settings import _endpoint_url, _frontend_link_base
from config.storages import LocalPublicStorage, PublicMediaStorage, public_media_storage

PNG_PIXEL = b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4"
    "2mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


class FrontendLinkBaseTests(TestCase):
    def test_api_host_is_replaced_by_the_site_origin(self):
        self.assertEqual(
            _frontend_link_base("https://api.vaceup.ng", "https://api.vaceup.ng", "https://vaceup.ng"),
            "https://vaceup.ng",
        )

    def test_missing_base_is_replaced_by_the_site_origin(self):
        self.assertEqual(
            _frontend_link_base("", "https://api.vaceup.ng", "https://vaceup.ng"),
            "https://vaceup.ng",
        )

    def test_a_usable_base_is_kept_including_its_path(self):
        self.assertEqual(
            _frontend_link_base("https://school.example.org/academy/", "", "https://vaceup.ng"),
            "https://school.example.org/academy",
        )


class EmailedLinkTests(TestCase):
    @override_settings(FRONTEND_LINK_BASE="https://vaceup.ng")
    def test_reset_link_uses_the_trailing_slash_route_the_export_serves(self):
        link = _frontend("/reset-password?token=11111111-2222-3333-4444-555555555555")
        self.assertEqual(
            link,
            "https://vaceup.ng/reset-password/?token=11111111-2222-3333-4444-555555555555",
        )

    @override_settings(FRONTEND_LINK_BASE="https://vaceup.ng")
    def test_bare_path_links_stay_absolute(self):
        self.assertEqual(_frontend("/courses"), "https://vaceup.ng/courses/")


class PublicMediaStorageSelectionTests(TestCase):
    @override_settings(OBJECT_STORAGE_CONFIGURED=False)
    def test_partial_object_storage_configuration_keeps_media_on_disk(self):
        self.assertIsInstance(public_media_storage(), LocalPublicStorage)

    @override_settings(OBJECT_STORAGE_CONFIGURED=True)
    def test_complete_object_storage_configuration_uses_the_bucket(self):
        self.assertIsInstance(public_media_storage(), PublicMediaStorage)


class LocalImageUploadTests(TestCase):
    """Writes a cover image through the same storage class the live server uses."""

    def setUp(self):
        self.media_root = Path(tempfile.mkdtemp(prefix="vaceup-media-"))
        self.addCleanup(shutil.rmtree, self.media_root, True)

    def test_cover_image_lands_under_media_public(self):
        from config.storages import LocalPublicStorage

        with override_settings(MEDIA_ROOT=self.media_root):
            storage = LocalPublicStorage()
            name = storage.save(
                "course/thumbnails/cover.png",
                SimpleUploadedFile("cover.png", PNG_PIXEL, content_type="image/png"),
            )
            self.assertTrue((self.media_root / "public" / name).is_file(),
                            f"expected {name} under {self.media_root}/public")
            self.assertTrue(storage.url(name).startswith("/media/public/"))


class EndpointGuardTests(TestCase):
    """A .env line copied from .env.example carries its comment as the value."""

    def setUp(self):
        self.media_root = Path(tempfile.mkdtemp(prefix="vaceup-media-"))
        self.addCleanup(shutil.rmtree, self.media_root, True)

    def test_a_comment_is_not_treated_as_an_endpoint(self):
        self.assertIsNone(_endpoint_url("   # e.g. https://<accountid>.r2.cloudflarestorage.com") or None)
        self.assertEqual(
            _endpoint_url("https://123.r2.cloudflarestorage.com"),
            "https://123.r2.cloudflarestorage.com",
        )

    def test_check_names_the_dropped_endpoint(self):
        from apps.core.checks import media_storage_check

        with override_settings(AWS_S3_ENDPOINT_REJECTED=True, AWS_STORAGE_BUCKET_NAME="",
                               OBJECT_STORAGE_CONFIGURED=False, MEDIA_ROOT=self.media_root):
            ids = [issue.id for issue in media_storage_check(None)]
        self.assertIn("core.W005", ids)
