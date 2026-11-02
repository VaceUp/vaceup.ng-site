"""Profile pictures: public storage, safe replacement, clean removal."""
import io
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from config.storages import LocalPublicStorage

User = get_user_model()

AVATAR = "/api/v1/auth/me/avatar/"
ME = "/api/v1/auth/me/"


def png_bytes(size=(4, 4)):
    buffer = io.BytesIO()
    Image.new("RGB", size, (0, 8, 138)).save(buffer, format="PNG")
    return buffer.getvalue()


def image_file(name="me.png"):
    return SimpleUploadedFile(name, png_bytes(), content_type="image/png")


@override_settings(
    SECURE_SSL_REDIRECT=False,
    CLOUDINARY_CONFIGURED=False,
    OBJECT_STORAGE_CONFIGURED=False,
)
class AvatarTests(APITestCase):
    def setUp(self):
        self.media_root = Path(tempfile.mkdtemp(prefix="vaceup-avatar-"))
        self.addCleanup(shutil.rmtree, self.media_root, True)
        settings_patch = override_settings(MEDIA_ROOT=self.media_root)
        settings_patch.enable()
        self.addCleanup(settings_patch.disable)
        # The field caches its storage on first use, so a lower MEDIA_ROOT
        # alone would write into the checkout's media directory.
        storage_patch = patch.object(
            User._meta.get_field("avatar"), "storage", LocalPublicStorage()
        )
        storage_patch.start()
        self.addCleanup(storage_patch.stop)

        self.user = User.objects.create_user(
            email="learner@example.com",
            password="Str0ng-Passw0rd!x",
            full_name="Ada Learner",
            is_active=True,
        )
        # The API authenticates JWTs only, so session login would stay anonymous.
        self.client.force_authenticate(self.user)

    def post_avatar(self, upload):
        return self.client.post(AVATAR, {"avatar": upload}, format="multipart")

    def test_a_user_can_set_a_profile_picture(self):
        response = self.post_avatar(image_file())
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.avatar.name.startswith("accounts/avatar/"))
        self.assertTrue((self.media_root / "public" / self.user.avatar.name).is_file())
        self.assertTrue(response.data["avatar"].endswith(self.user.avatar.name))
        self.assertIsNotNone(response.data["avatar_updated_at"])

    def test_the_picture_is_part_of_the_user_payload(self):
        self.post_avatar(image_file())
        payload = self.client.get(ME).data
        self.assertTrue(payload["avatar"])
        self.assertIn("/media/public/", payload["avatar"])

    def test_replacing_the_picture_deletes_the_old_file(self):
        self.post_avatar(image_file("first.png"))
        self.user.refresh_from_db()
        first = self.media_root / "public" / self.user.avatar.name

        response = self.post_avatar(image_file("second.png"))

        self.user.refresh_from_db()
        self.assertFalse(first.exists())
        self.assertTrue((self.media_root / "public" / self.user.avatar.name).is_file())
        # The reply must describe the picture that is now stored, not a blank.
        self.assertTrue(response.data["avatar"].endswith(self.user.avatar.name),
                        response.data["avatar"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.avatar, "removing the old file must not clear the new one")

    def test_deleting_the_picture_clears_it_and_removes_the_file(self):
        self.post_avatar(image_file())
        self.user.refresh_from_db()
        stored = self.media_root / "public" / self.user.avatar.name

        response = self.client.delete(AVATAR)

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)
        self.assertIsNone(self.user.avatar_updated_at)
        self.assertEqual(response.data["avatar"], "")
        self.assertFalse(stored.exists())

    def test_a_file_that_is_not_an_image_is_rejected(self):
        response = self.post_avatar(
            SimpleUploadedFile("notes.png", b"not an image", content_type="image/png")
        )
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)

    def test_an_anonymous_visitor_cannot_set_a_picture(self):
        self.client.force_authenticate(None)
        response = self.post_avatar(image_file())
        self.assertIn(response.status_code, (401, 403))

    def test_deleting_a_picture_that_does_not_exist_is_harmless(self):
        response = self.client.delete(AVATAR)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["avatar"], "")
