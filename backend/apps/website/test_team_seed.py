"""The team profiles are published once, and an edited profile is never reset."""

import io
from pathlib import Path
import shutil
import tempfile
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.website.models import TeamMember
from config.storages import LocalPublicStorage


class SeedTeamMemberTests(TestCase):
    def setUp(self):
        self.media_root = Path(tempfile.mkdtemp(prefix="vaceup-team-"))
        self.addCleanup(shutil.rmtree, self.media_root, True)
        settings_patch = override_settings(
            MEDIA_ROOT=self.media_root, CLOUDINARY_CONFIGURED=False, OBJECT_STORAGE_CONFIGURED=False
        )
        settings_patch.enable()
        self.addCleanup(settings_patch.disable)
        # The field caches its storage on first use, so a lower MEDIA_ROOT alone
        # would leave the photos in the checkout's media directory.
        storage_patch = patch.object(
            TeamMember._meta.get_field("photo"), "storage", LocalPublicStorage()
        )
        storage_patch.start()
        self.addCleanup(storage_patch.stop)

    def test_without_apply_nothing_is_written(self):
        call_command("seed_team_members", stdout=io.StringIO())
        self.assertEqual(TeamMember.objects.count(), 0)

    def test_apply_publishes_every_profile_with_a_photo(self):
        call_command("seed_team_members", "--apply", stdout=io.StringIO())
        members = TeamMember.objects.order_by("order")
        self.assertEqual(
            [member.name for member in members],
            [
                "Stevens Flourish Breakthrough",
                "Mary Anieama",
                "Marvellous Boluwatife Ogunleye",
                "Freeborn Udoekwere",
            ],
        )
        self.assertTrue(all(member.is_published for member in members))
        for member in members:
            self.assertTrue((self.media_root / "public" / member.photo.name).is_file(), member.photo.name)
            self.assertEqual(member.image_url, "")

    def test_a_profile_the_academy_has_edited_is_left_alone(self):
        call_command("seed_team_members", "--apply", stdout=io.StringIO())
        edited = TeamMember.objects.get(name="Mary Anieama")
        edited.role_title = "Editorial Lead"
        edited.is_published = False
        edited.save()

        call_command("seed_team_members", "--apply", stdout=io.StringIO())

        edited.refresh_from_db()
        self.assertEqual(edited.role_title, "Editorial Lead")
        self.assertFalse(edited.is_published)
        self.assertEqual(TeamMember.objects.count(), 4)


class RestoreTeamPhotoTests(TestCase):
    """A stale photo URL is replaced by a real file in the active store."""

    def setUp(self):
        self.media_root = Path(tempfile.mkdtemp(prefix="vaceup-team-restore-"))
        self.addCleanup(shutil.rmtree, self.media_root, True)
        settings_patch = override_settings(
            MEDIA_ROOT=self.media_root, CLOUDINARY_CONFIGURED=False, OBJECT_STORAGE_CONFIGURED=False
        )
        settings_patch.enable()
        self.addCleanup(settings_patch.disable)
        storage_patch = patch.object(
            TeamMember._meta.get_field("photo"), "storage", LocalPublicStorage()
        )
        storage_patch.start()
        self.addCleanup(storage_patch.stop)
        call_command("seed_team_members", "--apply", stdout=io.StringIO())
        for member in TeamMember.objects.all():
            # Simulate the switch: the database keeps a name, the store has no file.
            (self.media_root / "public" / member.photo.name).unlink()

    def _run(self, *args):
        out = io.StringIO()
        with patch(
            "apps.website.management.commands.restore_team_photos.Command._status",
            return_value=200,
        ):
            call_command("restore_team_photos", *args, stdout=out)
        return out.getvalue()

    def test_without_apply_no_photo_is_written(self):
        output = self._run()
        self.assertIn("Dry run", output)
        self.assertIn("WOULD", output)
        for member in TeamMember.objects.all():
            self.assertFalse((self.media_root / "public" / member.photo.name).exists())

    def test_apply_restores_every_bundled_photo(self):
        output = self._run("--apply")
        self.assertIn("PASS", output)
        for member in TeamMember.objects.all():
            self.assertTrue(
                (self.media_root / "public" / member.photo.name).is_file(),
                f"{member.name}: {member.photo.name} was not written",
            )

    def test_it_reports_a_store_that_answers_with_an_error(self):
        out = io.StringIO()
        with patch(
            "apps.website.management.commands.restore_team_photos.Command._status",
            return_value=404,
        ):
            call_command("restore_team_photos", "--apply", stdout=out)
        output = out.getvalue()
        self.assertIn("FAIL", output)
        self.assertIn("404", output)
