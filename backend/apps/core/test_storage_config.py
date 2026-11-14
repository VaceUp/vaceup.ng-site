"""Storage configuration tests never read real objects or contact a provider."""
from io import StringIO
import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from django.conf import settings
from django.core.management import call_command
from django.test import SimpleTestCase, override_settings

from apps.core.storage import StorageNotConfigured, _client, connection_options, presigned_upload_url
from apps.core.storage_config import endpoint_url
from apps.core.management.commands.storage_probe import Command as Probe


class EndpointValidationTests(SimpleTestCase):
    def test_valid_origins_and_local_test_server_are_normalized(self):
        for raw, expected in (
            ("", ""), ("  https://account.r2.cloudflarestorage.com/  ", "https://account.r2.cloudflarestorage.com"),
            ("https://s3.eu-west-1.amazonaws.com", "https://s3.eu-west-1.amazonaws.com"),
            ("http://localhost:9000/", "http://localhost:9000"),
            ("http://[::1]:9000", "http://[::1]:9000"),
        ):
            with self.subTest(raw=raw):
                self.assertEqual(endpoint_url(raw), expected)

    def test_malformed_or_unsafe_endpoint_does_not_become_a_service_origin(self):
        invalid = ("# example", "https://", "https://<accountid>.r2.cloudflarestorage.com", "https://user:password@storage.example",
                   "https://storage.example/bucket", "https://storage.example?credential=secret", "https://storage.example#note",
                   "https://storage.example:bad", "https://storage.example:99999", "https://storage.example trailing comment",
                   "http://storage.example", "https://[::1", "https://bucket_name.example", "https://storage.example\\bucket")
        for raw in invalid:
            with self.subTest(raw=raw):
                self.assertEqual(endpoint_url(raw), "")

    @override_settings(AWS_ACCESS_KEY_ID="fake-key", AWS_SECRET_ACCESS_KEY="fake-secret", AWS_STORAGE_BUCKET_NAME="test-bucket", AWS_S3_ENDPOINT_URL=None, AWS_S3_ENDPOINT_REJECTED=True)
    def test_rejected_endpoint_cannot_generate_an_aws_fallback_url(self):
        with patch("boto3.client") as factory:
            with self.assertRaises(StorageNotConfigured) as caught:
                presigned_upload_url("private/test.webm", "video/webm")
        factory.assert_not_called()
        self.assertIn("AWS_S3_ENDPOINT_URL", caught.exception.detail)
        self.assertEqual(caught.exception.status_code, 503)
        self.assertNotIn("fake-secret", caught.exception.detail)

    @override_settings(AWS_S3_ENDPOINT_URL="https://user:private@storage.example", AWS_S3_ENDPOINT_REJECTED=False)
    def test_runtime_endpoint_override_is_validated_without_leaking_its_value(self):
        with self.assertRaises(StorageNotConfigured) as caught:
            connection_options()
        self.assertNotIn("private", caught.exception.detail)
        self.assertNotIn("user:", caught.exception.detail)

    def test_invalid_endpoint_keeps_django_bootable_and_selects_public_fallback(self):
        # An isolated process verifies settings-import decisions and Django startup,
        # rather than merely overriding already-computed settings in this process.
        environment = {name: os.environ[name] for name in ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP") if name in os.environ}
        environment.update({"DJANGO_SETTINGS_MODULE": "config.settings_test", "SECRET_KEY": "storage-startup-test-key-not-a-real-secret",
            "DEBUG": "False", "ALLOWED_HOSTS": "testserver", "VACEUP_INFRASTRUCTURE": "database", "REDIS_URL": "", "SENTRY_DSN": "",
            # Production settings read these before settings_test replaces MySQL
            # with SQLite. Never depend on a developer .env or CI credentials.
            "DB_NAME": "storage_fixture", "DB_USER": "unused_fixture", "DB_PASSWORD": "unused_fixture", "DB_HOST": "127.0.0.1", "DB_PORT": "3306",
            "CELERY_BROKER_URL": "memory://", "CELERY_RESULT_BACKEND": "cache+memory://",
            "AWS_ACCESS_KEY_ID": "fake-key", "AWS_SECRET_ACCESS_KEY": "fake-secret", "AWS_STORAGE_BUCKET_NAME": "test-bucket",
            "AWS_S3_ENDPOINT_URL": "https://<accountid>.r2.cloudflarestorage.com", "CLOUDINARY_URL": "", "CLOUDINARY_CLOUD_NAME": "",
            "CLOUDINARY_API_KEY": "", "CLOUDINARY_API_SECRET": ""})
        # Disable dotenv loading only in the child process. The user's file is
        # untouched, and this fixture exercises the same clean setup as CI.
        script = "import environ;environ.Env.read_env=lambda *args,**kwargs:None;import django,json;django.setup();from django.conf import settings;from config.storages import public_media_storage;print(json.dumps({'rejected':settings.AWS_S3_ENDPOINT_REJECTED,'configured':settings.OBJECT_STORAGE_CONFIGURED,'public_storage':type(public_media_storage()).__name__}))"
        result = subprocess.run([sys.executable, "-c", script], cwd=Path(settings.BASE_DIR), env=environment, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, "Isolated Django startup failed; provider configuration and captured stderr are withheld.")
        self.assertEqual(json.loads(result.stdout), {"rejected": True, "configured": False, "public_storage": "LocalPublicStorage"})


@override_settings(AWS_ACCESS_KEY_ID="fake-key", AWS_SECRET_ACCESS_KEY="fake-secret", AWS_STORAGE_BUCKET_NAME="test-bucket", AWS_S3_ENDPOINT_REJECTED=False)
class PresignedShapeTests(SimpleTestCase):
    @override_settings(AWS_S3_ENDPOINT_URL="https://account.r2.cloudflarestorage.com/", AWS_S3_REGION_NAME="eu-west-1")
    def test_r2_uses_account_origin_auto_region_and_path_bucket(self):
        url = presigned_upload_url("private/recording.webm", "video/webm")
        parsed = urlsplit(url)
        self.assertEqual(parsed.hostname, "account.r2.cloudflarestorage.com")
        self.assertEqual(parsed.path, "/test-bucket/private/recording.webm")
        query = parse_qs(parsed.query)
        self.assertIn("/auto/s3/aws4_request", query["X-Amz-Credential"][0])
        self.assertIn("content-type", query["X-Amz-SignedHeaders"][0])

    @override_settings(AWS_S3_ENDPOINT_URL=None, AWS_S3_REGION_NAME="eu-west-1")
    def test_blank_endpoint_preserves_real_aws_region_and_signed_upload(self):
        url = presigned_upload_url("private/recording.webm", "video/webm")
        parsed = urlsplit(url)
        self.assertTrue(parsed.hostname.endswith(".amazonaws.com"))
        self.assertIn("/eu-west-1/s3/aws4_request", parse_qs(parsed.query)["X-Amz-Credential"][0])

    @override_settings(AWS_S3_ENDPOINT_URL=None, AWS_S3_REGION_NAME="eu-west-1")
    def test_sdk_configuration_failure_is_a_safe_actionable_503(self):
        with patch("boto3.client", side_effect=ValueError("invalid endpoint with private credential")):
            with self.assertRaises(StorageNotConfigured) as caught:
                _client()
        self.assertNotIn("private credential", caught.exception.detail)
        self.assertIn("region", caught.exception.detail)


class DiagnosticSafetyTests(SimpleTestCase):
    @override_settings(AWS_ACCESS_KEY_ID="do-not-print-key", AWS_SECRET_ACCESS_KEY="do-not-print-secret")
    def test_exception_urls_lose_query_and_credentials(self):
        message = 'Failed https://user:password@storage.example/bucket/file?X-Amz-Credential=do-not-print-key&X-Amz-Signature=temporary-proof&custom=private-value; do-not-print-secret'
        cleaned = Probe._clean(RuntimeError(message))
        for private in ("user:", "password", "do-not-print-key", "temporary-proof", "private-value", "do-not-print-secret"):
            self.assertNotIn(private, cleaned)
        self.assertIn("https://storage.example/bucket/file?[redacted]", cleaned)

    @override_settings(AWS_S3_ENDPOINT_URL=None, AWS_S3_ENDPOINT_REJECTED=True, OBJECT_STORAGE_CONFIGURED=False)
    def test_probe_rejects_endpoint_without_constructing_client_or_writing(self):
        output = StringIO()
        with patch("apps.core.storage._client") as factory:
            call_command("storage_probe", stdout=output)
        factory.assert_not_called()
        self.assertIn("AWS_S3_ENDPOINT_URL is invalid", output.getvalue())

    @override_settings(AWS_ACCESS_KEY_ID="fake-key", AWS_SECRET_ACCESS_KEY="fake-secret", AWS_STORAGE_BUCKET_NAME="bucket-not-printed", AWS_S3_ENDPOINT_URL=None, AWS_S3_ENDPOINT_REJECTED=True, OBJECT_STORAGE_CONFIGURED=False, CLOUDINARY_CONFIGURED=True)
    def test_report_explains_rejected_endpoint_and_preserves_cloudinary(self):
        output = StringIO()
        call_command("storage_report", stdout=output)
        text = output.getvalue()
        self.assertIn("REJECTED", text)
        self.assertIn("Cloudinary", text)
        self.assertIn("ACTION:", text)
        for private in ("fake-key", "fake-secret", "bucket-not-printed"):
            self.assertNotIn(private, text)

    @override_settings(AWS_ACCESS_KEY_ID="fake-key", AWS_SECRET_ACCESS_KEY="fake-secret", AWS_STORAGE_BUCKET_NAME="test-bucket", AWS_S3_ENDPOINT_REJECTED=True, OBJECT_STORAGE_CONFIGURED=False, CLOUDINARY_CONFIGURED=True)
    def test_invalid_endpoint_warning_does_not_mislabel_complete_credentials(self):
        from apps.core.checks import media_storage_check
        issues = media_storage_check(None)
        ids = [issue.id for issue in issues]
        self.assertIn("core.W005", ids)
        self.assertNotIn("core.W001", ids)
        warning = next(issue for issue in issues if issue.id == "core.W005")
        self.assertIn("will not fall back", warning.msg)
