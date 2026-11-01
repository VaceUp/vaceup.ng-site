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
