"""Tests for lesson video: presigned R2 upload + signed playback.

boto3 signs URLs locally (no network), so fake credentials are enough.
"""
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollment.models import Enrollment

User = get_user_model()

LESSONS = "/api/v1/lessons/"

STORAGE = dict(
    SECURE_SSL_REDIRECT=False,
    AWS_ACCESS_KEY_ID="test",
    AWS_SECRET_ACCESS_KEY="test",
    AWS_STORAGE_BUCKET_NAME="vaceup-media",
    AWS_S3_REGION_NAME="auto",
    AWS_S3_ENDPOINT_URL="https://acc.r2.cloudflarestorage.com",
)


@override_settings(**STORAGE)
class VideoTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.instr = User.objects.create_user(
            email="i@vaceup.ng", password="x", full_name="Ins",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.instr2 = User.objects.create_user(
            email="i2@vaceup.ng", password="x", full_name="Ins2",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s@vaceup.ng", password="x", full_name="Stud",
            role=User.Role.STUDENT, is_active=True)
        self.cat = Category.objects.create(name="Cat")
        self.course = Course.objects.create(
            title="C", category=self.cat, instructor=self.instr,
            price=0, is_published=True)
        self.module = Module.objects.create(course=self.course, title="M", order=1)
        self.lesson = Lesson.objects.create(module=self.module, title="L", order=1)
        self.preview = Lesson.objects.create(
            module=self.module, title="P", order=2, is_preview=True,
            video_url="https://youtu.be/abc")

    # --- upload url ---------------------------------------------------------
    def test_instructor_gets_presigned_upload_url(self):
        self.client.force_authenticate(self.instr)
        r = self.client.post(f"{LESSONS}{self.lesson.id}/video-upload-url/",
                             {"content_type": "video/mp4"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["key"].startswith(f"lessons/{self.lesson.id}/"))
        self.assertIn("X-Amz-Signature", r.data["upload_url"])

    def test_non_video_content_type_rejected(self):
        self.client.force_authenticate(self.instr)
        r = self.client.post(f"{LESSONS}{self.lesson.id}/video-upload-url/",
                             {"content_type": "application/pdf"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_foreign_instructor_cannot_get_upload_url(self):
        self.client.force_authenticate(self.instr2)
        r = self.client.post(f"{LESSONS}{self.lesson.id}/video-upload-url/",
                             {"content_type": "video/mp4"}, format="json")
        self.assertEqual(r.status_code, 404)  # not in their queryset

    @override_settings(AWS_ACCESS_KEY_ID="", AWS_SECRET_ACCESS_KEY="")
    def test_upload_url_503_when_storage_unconfigured(self):
        self.client.force_authenticate(self.instr)
        r = self.client.post(f"{LESSONS}{self.lesson.id}/video-upload-url/",
                             {"content_type": "video/mp4"}, format="json")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.data["error"]["code"], "storage_not_configured")

    # --- attach -------------------------------------------------------------
    def test_attach_video_sets_key(self):
        self.client.force_authenticate(self.instr)
        key = f"lessons/{self.lesson.id}/abc.mp4"
        r = self.client.post(f"{LESSONS}{self.lesson.id}/attach-video/",
                             {"key": key}, format="json")
        self.assertEqual(r.status_code, 200)
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.video_key, key)

    def test_attach_rejects_foreign_key(self):
        self.client.force_authenticate(self.instr)
        r = self.client.post(f"{LESSONS}{self.lesson.id}/attach-video/",
                             {"key": "lessons/999/evil.mp4"}, format="json")
        self.assertEqual(r.status_code, 400)

    # --- playback -----------------------------------------------------------
    def test_enrolled_student_gets_signed_playback(self):
        self.lesson.video_key = f"lessons/{self.lesson.id}/v.mp4"
        self.lesson.save(update_fields=["video_key"])
        Enrollment.objects.create(student=self.student, course=self.course,
                                  status=Enrollment.Status.ACTIVE)
        self.client.force_authenticate(self.student)
        r = self.client.get(f"{LESSONS}{self.lesson.id}/play/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["source"], "upload")
        self.assertIn("X-Amz-Signature", r.data["playback_url"])

    def test_preview_play_returns_external_url(self):
        self.client.force_authenticate(self.student)  # not enrolled
        r = self.client.get(f"{LESSONS}{self.preview.id}/play/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["source"], "external")

    def test_non_enrolled_cannot_play_gated_lesson(self):
        self.lesson.video_key = f"lessons/{self.lesson.id}/v.mp4"
        self.lesson.save(update_fields=["video_key"])
        self.client.force_authenticate(self.student)  # not enrolled
        r = self.client.get(f"{LESSONS}{self.lesson.id}/play/")
        self.assertEqual(r.status_code, 404)
