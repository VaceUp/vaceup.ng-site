"""Undo history for the About page: every edit leaves the wording it replaced."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.website.models import AcademyProfile, ContentRevision, TeamMember

User = get_user_model()

PROFILE = "/api/v1/website/profile/"
REVISIONS = "/api/v1/website/revisions/"
UNDO = "/api/v1/website/revisions/undo/"


class AboutPageUndoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="registrar@vaceup.ng", password="x", full_name="Grace Bello",
            role=User.Role.ADMIN, is_active=True,
        )
        self.student = User.objects.create_user(
            email="learner@vaceup.ng", password="x", full_name="Ada Learner",
            role=User.Role.STUDENT, is_active=True,
        )
        self.client.force_authenticate(self.admin)

    def patch_profile(self, payload):
        return self.client.patch(PROFILE, payload, format="json")

    # --- academy profile ---

    def test_an_edit_leaves_the_wording_it_replaced_in_history(self):
        self.patch_profile({"story": "We teach coding to African students."})
        self.patch_profile({"story": "We teach coding."})

        response = self.client.get(REVISIONS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["label"], "Academy profile")
        self.assertEqual(response.data[0]["changed_fields"], ["story"])
        self.assertEqual(response.data[0]["changed_by_name"], "Grace Bello")

    def test_undo_puts_the_previous_wording_back(self):
        self.patch_profile({"story": "First version.", "tagline": "Learn by building."})
        self.patch_profile({"story": "Typo in a hurry."})

        response = self.client.post(UNDO, {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["profile"]["story"], "First version.")
        # Untouched fields stay where the editor left them.
        self.assertEqual(response.data["profile"]["tagline"], "Learn by building.")
        self.assertEqual(AcademyProfile.load().story, "First version.")

    def test_undo_is_itself_undoable(self):
        self.patch_profile({"story": "First version."})
        self.patch_profile({"story": "Second version."})

        self.client.post(UNDO, {}, format="json")
        again = self.client.post(UNDO, {}, format="json")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data["profile"]["story"], "Second version.")

    def test_restoring_a_named_revision_jumps_back_to_that_version(self):
        self.patch_profile({"story": "Version one."})
        self.patch_profile({"story": "Version two."})
        self.patch_profile({"story": "Version three."})

        oldest = ContentRevision.objects.order_by("pk").first()
        response = self.client.post(f"{REVISIONS}{oldest.pk}/restore/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["profile"]["story"], "Version one.")

    def test_saving_identical_text_records_nothing(self):
        self.patch_profile({"story": "Same words."})
        self.patch_profile({"story": "Same words."})
        self.assertEqual(ContentRevision.objects.count(), 0)

    def test_undo_without_history_says_so(self):
        self.patch_profile({"story": "Only one version exists."})
        response = self.client.post(UNDO, {}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertIn("no earlier version", response.data["detail"])

    # --- team profiles ---

    def _member(self):
        return TeamMember.objects.create(
            name="Mercy O. Dennis", role_title="Lead Tutor", bio="Tutor bio.",
            is_published=True,
        )

    def test_a_team_edit_can_be_undone_without_touching_the_photo(self):
        member = self._member()
        self.client.patch(f"/api/v1/website/team/{member.pk}/", {"bio": "Wrong bio pasted."}, format="json")

        response = self.client.post(UNDO, {"target": "team", "object_id": member.pk}, format="json")
        self.assertEqual(response.status_code, 200)
        member.refresh_from_db()
        self.assertEqual(member.bio, "Tutor bio.")
        self.assertEqual(response.data["member"]["name"], "Mercy O. Dennis")

    def test_restoring_a_deleted_team_profile_explains_why_it_cannot(self):
        member = self._member()
        self.client.patch(f"/api/v1/website/team/{member.pk}/", {"bio": "Edited."}, format="json")
        revision = ContentRevision.objects.get(target=ContentRevision.Target.TEAM)
        member.delete()

        response = self.client.post(f"{REVISIONS}{revision.pk}/restore/", {}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertIn("has since been deleted", response.data["detail"])

    def test_history_separates_the_profile_from_each_team_member(self):
        member = self._member()
        self.patch_profile({"story": "Academy story."})
        self.patch_profile({"story": "Academy story, edited."})
        self.client.patch(f"/api/v1/website/team/{member.pk}/", {"bio": "Edited bio."}, format="json")

        rows = self.client.get(REVISIONS).data
        self.assertEqual([row["label"] for row in rows], ["Mercy O. Dennis", "Academy profile"])

        # Undoing the academy profile must not reach into the team row.
        self.client.post(UNDO, {}, format="json")
        member.refresh_from_db()
        self.assertEqual(member.bio, "Edited bio.")
        self.assertEqual(AcademyProfile.load().story, "Academy story.")

    # --- access ---

    def test_only_admins_read_and_restore_history(self):
        self.patch_profile({"story": "Version one."})
        self.patch_profile({"story": "Version two."})
        revision = ContentRevision.objects.first()

        self.client.force_authenticate(self.student)
        self.assertIn(self.client.get(REVISIONS).status_code, (401, 403))
        self.assertEqual(self.client.post(UNDO, {}, format="json").status_code, 403)
        self.assertEqual(
            self.client.post(f"{REVISIONS}{revision.pk}/restore/", {}, format="json").status_code, 403
        )
        self.assertEqual(AcademyProfile.load().story, "Version two.")

    def test_history_is_not_readable_before_signing_in(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(REVISIONS).status_code, (401, 403))
