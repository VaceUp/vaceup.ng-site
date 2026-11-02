"""Regression cover for the configuration failures that broke live workflows.

Image uploads died because a bucket name alone selected the S3 backend, and
emailed links died because the frontend base could point somewhere that
serves no pages. Public-image destination is now Cloudinary, then the bucket,
then disk, so the same kind of half-configuration is pinned here too. All of
it is decided at settings import, so the tests pin the decision functions
rather than a machine's .env.
"""
from __future__ import annotations

from base64 import b64decode
from pathlib import Path
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from apps.accounts.emails import _frontend
from config.settings import _cloudinary_from_url, _endpoint_url, _frontend_link_base
from config.storages import (
    CloudinaryStorage,
    LocalPublicStorage,
    PrivateMediaStorage,
    PublicMediaStorage,
    public_media_storage,
)

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
    @override_settings(CLOUDINARY_CONFIGURED=False, OBJECT_STORAGE_CONFIGURED=False)
    def test_partial_object_storage_configuration_keeps_media_on_disk(self):
        self.assertIsInstance(public_media_storage(), LocalPublicStorage)

    @override_settings(CLOUDINARY_CONFIGURED=False, OBJECT_STORAGE_CONFIGURED=True)
    def test_complete_object_storage_configuration_uses_the_bucket(self):
        self.assertIsInstance(public_media_storage(), PublicMediaStorage)

    @override_settings(
        CLOUDINARY_CONFIGURED=True, OBJECT_STORAGE_CONFIGURED=True,
        CLOUDINARY_CLOUD_NAME="vaceup", CLOUDINARY_FOLDER="vaceup",
    )
    def test_cloudinary_takes_public_images_when_it_is_configured(self):
        self.assertIsInstance(public_media_storage(), CloudinaryStorage)


class CloudinaryUrlParsingTests(TestCase):
    def test_the_dashboard_url_splits_into_credentials_and_cloud(self):
        self.assertEqual(
            _cloudinary_from_url("cloudinary://1234567890123:secretphrase@vaceup"),
            ("1234567890123", "secretphrase", "vaceup", False),
        )

    def test_percent_encoding_in_a_secret_is_decoded(self):
        key, secret, cloud, rejected = _cloudinary_from_url(
            "cloudinary://key:a%2Fb@vaceup"
        )
        self.assertEqual((key, secret, cloud, rejected), ("key", "a/b", "vaceup", False))

    def test_a_leftover_comment_is_reported_instead_of_used(self):
        self.assertEqual(
            _cloudinary_from_url("cloudinary://key:secret@vaceup  # from the dashboard"),
            ("", "", "", True),
        )
        self.assertEqual(_cloudinary_from_url("https://example.org"), ("", "", "", True))
        self.assertEqual(_cloudinary_from_url(""), ("", "", "", False))

    def test_an_incomplete_url_is_reported(self):
        self.assertEqual(_cloudinary_from_url("cloudinary://vaceup"), ("", "", "", True))


class CloudinaryStorageLayoutTests(TestCase):
    @override_settings(
        CLOUDINARY_CONFIGURED=True, CLOUDINARY_CLOUD_NAME="vaceup",
        CLOUDINARY_API_KEY="key", CLOUDINARY_API_SECRET="secret",
        CLOUDINARY_FOLDER="vaceup", CLOUDINARY_SECURE_DISTRIBUTION="",
    )
    def test_upload_to_paths_become_foldered_public_ids(self):
        storage = CloudinaryStorage()
        self.assertEqual(storage.public_id("course/thumbnails/cover.png"),
                         "vaceup/course/thumbnails/cover.png")
        url = storage.url("course/thumbnails/cover.png")
        self.assertTrue(url.startswith("https://res.cloudinary.com/vaceup/image/upload/"), url)
        self.assertIn("vaceup/course/thumbnails/cover.png", url)

    @override_settings(
        CLOUDINARY_CONFIGURED=True, CLOUDINARY_CLOUD_NAME="vaceup",
        CLOUDINARY_API_KEY="key", CLOUDINARY_API_SECRET="secret",
        CLOUDINARY_FOLDER="", CLOUDINARY_SECURE_DISTRIBUTION="cdn.vaceup.ng",
    )
    def test_a_custom_distribution_and_no_folder_keep_the_key_untouched(self):
        storage = CloudinaryStorage()
        self.assertEqual(storage.public_id("website/team/ada.jpg"), "website/team/ada.jpg")
        self.assertTrue(storage.url("website/team/ada.jpg").startswith("https://cdn.vaceup.ng/"))


class PublicDeliveryDomainTests(TestCase):
    """AWS_S3_CUSTOM_DOMAIN is documented in .env.example, so it must do something.

    It belongs to public objects only: a pre-signed URL is signed for the host
    it is opened against, so applying it to private media breaks every download.
    """

    BUCKET = {
        "AWS_ACCESS_KEY_ID": "key", "AWS_SECRET_ACCESS_KEY": "secret",
        "AWS_STORAGE_BUCKET_NAME": "vaceup-media", "AWS_S3_REGION_NAME": "auto",
        "AWS_S3_ENDPOINT_URL": "https://123.r2.cloudflarestorage.com",
        "AWS_S3_CUSTOM_DOMAIN": "media.vaceup.ng",
    }

    @override_settings(**BUCKET)
    def test_public_images_are_served_from_the_custom_domain_unsigned(self):
        url = PublicMediaStorage().url("course/thumbnails/cover.png")
        self.assertEqual(url, "https://media.vaceup.ng/course/thumbnails/cover.png")

    @override_settings(**BUCKET)
    def test_the_domain_never_reaches_a_pre_signed_private_link(self):
        self.assertIsNone(PrivateMediaStorage().custom_domain)


class CloudinaryConfigCheckTests(TestCase):
    def setUp(self):
        self.media_root = Path(tempfile.mkdtemp(prefix="vaceup-media-"))
        self.addCleanup(shutil.rmtree, self.media_root, True)

    def _ids(self, **overrides):
        from apps.core.checks import media_storage_check

        base = {
            "AWS_STORAGE_BUCKET_NAME": "", "OBJECT_STORAGE_CONFIGURED": False,
            "AWS_S3_ENDPOINT_REJECTED": False, "MEDIA_ROOT": self.media_root,
            "AWS_S3_CUSTOM_DOMAIN": None,
            "CLOUDINARY_URL_REJECTED": False, "CLOUDINARY_CONFIGURED": True,
            "CLOUDINARY_CLOUD_NAME": "vaceup", "CLOUDINARY_API_KEY": "key",
            "CLOUDINARY_API_SECRET": "secret",
        }
        with override_settings(**{**base, **overrides}):
            return [issue.id for issue in media_storage_check(None)]

    def test_a_malformed_url_without_working_credentials_warns(self):
        self.assertIn("core.W006", self._ids(CLOUDINARY_URL_REJECTED=True,
                                             CLOUDINARY_CONFIGURED=False))

    def test_partial_credentials_warn(self):
        self.assertIn("core.W007", self._ids(
            CLOUDINARY_CONFIGURED=False, CLOUDINARY_API_SECRET="",
        ))

    def test_a_complete_configuration_is_silent(self):
        self.assertNotIn("core.W006", self._ids())
        self.assertNotIn("core.W007", self._ids())

    def test_a_missing_package_is_reported_before_the_first_upload(self):
        import sys
        from unittest import mock

        with mock.patch.dict(sys.modules, {"cloudinary": None}):
            self.assertIn("core.W008", self._ids())

    def test_public_images_on_a_private_bucket_endpoint_are_reported(self):
        on_bucket = {
            "CLOUDINARY_CONFIGURED": False, "OBJECT_STORAGE_CONFIGURED": True,
            "AWS_STORAGE_BUCKET_NAME": "vaceup-media",
        }
        self.assertIn("core.W009", self._ids(**on_bucket))
        # A delivery hostname of its own, or Cloudinary, both fix it.
        self.assertNotIn("core.W009", self._ids(**{**on_bucket,
                                                  "AWS_S3_CUSTOM_DOMAIN": "media.vaceup.ng"}))
        self.assertNotIn("core.W009", self._ids())


class StorageConfigurationMessageTests(TestCase):
    """The 503 names the setting to fix, so an operator is not left guessing."""

    @override_settings(AWS_ACCESS_KEY_ID="", AWS_SECRET_ACCESS_KEY="", AWS_STORAGE_BUCKET_NAME="")
    def test_every_empty_setting_is_named(self):
        from apps.core.storage import StorageNotConfigured, presigned_upload_url

        with self.assertRaises(StorageNotConfigured) as caught:
            presigned_upload_url("lessons/1/clip.mp4", "video/mp4")
        for name in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_STORAGE_BUCKET_NAME"):
            self.assertIn(name, str(caught.exception))
        self.assertEqual(caught.exception.status_code, 503)

    @override_settings(AWS_ACCESS_KEY_ID="key", AWS_SECRET_ACCESS_KEY="secret", AWS_STORAGE_BUCKET_NAME="")
    def test_only_the_setting_that_is_empty_is_named(self):
        from apps.core.storage import StorageNotConfigured, presigned_upload_url

        with self.assertRaises(StorageNotConfigured) as caught:
            presigned_upload_url("lessons/1/clip.mp4", "video/mp4")
        self.assertIn("AWS_STORAGE_BUCKET_NAME is empty", str(caught.exception))
        self.assertNotIn("AWS_ACCESS_KEY_ID", str(caught.exception))


class StorageReportTests(TestCase):
    """The operator sees which setting is empty, and never a value."""

    def _report(self, **overrides):
        from io import StringIO
        from django.core.management import call_command

        out = StringIO()
        with override_settings(**{
            "AWS_ACCESS_KEY_ID": "", "AWS_SECRET_ACCESS_KEY": "",
            "AWS_STORAGE_BUCKET_NAME": "", "OBJECT_STORAGE_CONFIGURED": False,
            "AWS_S3_ENDPOINT_URL": None, "CLOUDINARY_CONFIGURED": True,
            **overrides,
        }):
            call_command("storage_report", stdout=out)
        return out.getvalue()

    def test_it_names_the_empty_setting_and_calls_for_action(self):
        report = self._report(AWS_STORAGE_BUCKET_NAME="")
        self.assertIn("AWS_STORAGE_BUCKET_NAME", report)
        self.assertIn("EMPTY", report)
        self.assertIn("ACTION:", report)
        self.assertIn("local disk", report)

    def test_it_never_prints_a_credential(self):
        report = self._report(
            AWS_ACCESS_KEY_ID="key-should-not-appear",
            AWS_SECRET_ACCESS_KEY="secret-should-not-appear",
            AWS_STORAGE_BUCKET_NAME="bucket-should-not-appear",
        )
        for value in ("key-should-not-appear", "secret-should-not-appear",
                      "bucket-should-not-appear"):
            self.assertNotIn(value, report)

    def test_a_complete_configuration_needs_no_action(self):
        report = self._report(
            AWS_ACCESS_KEY_ID="key", AWS_SECRET_ACCESS_KEY="secret",
            AWS_STORAGE_BUCKET_NAME="vaceup-media", OBJECT_STORAGE_CONFIGURED=True,
        )
        self.assertNotIn("ACTION:", report)
        self.assertIn("bucket", report)


class StorageProbeTests(TestCase):
    """Without credentials the probe stops before touching the network."""

    def test_an_unconfigured_bucket_is_reported_and_named(self):
        from io import StringIO
        from django.core.management import call_command

        out = StringIO()
        with override_settings(OBJECT_STORAGE_CONFIGURED=False):
            call_command("storage_probe", stdout=out)
        output = out.getvalue()
        self.assertIn("FAIL", output)
        self.assertIn("AWS_STORAGE_BUCKET_NAME", output)
        self.assertIn("AWS_ACCESS_KEY_ID", output)


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

    def _ids(self, **overrides):
        from apps.core.checks import media_storage_check

        base = {
            "AWS_ACCESS_KEY_ID": "", "AWS_SECRET_ACCESS_KEY": "",
            "AWS_STORAGE_BUCKET_NAME": "", "OBJECT_STORAGE_CONFIGURED": False,
            "AWS_S3_ENDPOINT_REJECTED": False, "MEDIA_ROOT": self.media_root,
            "CLOUDINARY_CONFIGURED": True,
        }
        with override_settings(**{**base, **overrides}):
            return [issue.id for issue in media_storage_check(None)]

    def test_a_bucket_name_without_keys_is_reported(self):
        self.assertIn("core.W001", self._ids(AWS_STORAGE_BUCKET_NAME="vaceup-media"))

    def test_keys_without_a_bucket_name_are_reported(self):
        self.assertIn("core.W001", self._ids(
            AWS_ACCESS_KEY_ID="key", AWS_SECRET_ACCESS_KEY="secret",
        ))

    def test_a_complete_object_storage_configuration_is_silent(self):
        self.assertNotIn("core.W001", self._ids(
            AWS_ACCESS_KEY_ID="key", AWS_SECRET_ACCESS_KEY="secret",
            AWS_STORAGE_BUCKET_NAME="vaceup-media", OBJECT_STORAGE_CONFIGURED=True,
        ))
        self.assertNotIn("core.W001", self._ids())


class LegacySettingsCheckTests(TestCase):
    """checks.py can be newer than config/settings.py after a partial overlay.

    Checks run before every management command, so a missing setting has to
    skip its warning rather than take manage.py down with an AttributeError.
    """

    def test_a_settings_module_without_the_cloudinary_keys_still_runs(self):
        from types import SimpleNamespace
        from unittest import mock

        from apps.core import checks

        media_root = Path(tempfile.mkdtemp(prefix="vaceup-media-"))
        self.addCleanup(shutil.rmtree, media_root, True)
        legacy = SimpleNamespace(
            MEDIA_ROOT=media_root,
            AWS_STORAGE_BUCKET_NAME="vaceup-media",
            AWS_ACCESS_KEY_ID="", AWS_SECRET_ACCESS_KEY="",
            FRONTEND_BASE_URL="https://vaceup.ng",
            MARKETING_PUBLIC_API_URL="https://api.vaceup.ng",
        )
        with mock.patch.object(checks, "settings", legacy):
            storage_ids = [issue.id for issue in checks.media_storage_check(None)]
            link_ids = [issue.id for issue in checks.emailed_link_base_check(None)]
        self.assertIn("core.W001", storage_ids)
        self.assertNotIn("core.W006", storage_ids)
        self.assertNotIn("core.W003", link_ids)
