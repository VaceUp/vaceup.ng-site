"""Tests for booking a staff meeting, who may open its room, and how it closes."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.meetings.models import Meeting, MeetingParticipant

User = get_user_model()

MEETINGS = "/api/v1/meetings/"
LIVEKIT_KEYS = {
    "LIVEKIT_API_KEY": "devkey",
    "LIVEKIT_API_SECRET": "devsecret-devsecret-devsecret-9f",
    "LIVEKIT_WS_URL": "wss://lk.example",
}


class MeetingTests(APITestCase):
    """The whole staff-meeting surface, seen through the API the dashboard uses."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.admin = self._user("amara@vaceup.ng", "Amara Owner", User.Role.ADMIN)
        self.tutor = self._user("bola@vaceup.ng", "Bola Tutor", User.Role.INSTRUCTOR)
        self.other_tutor = self._user("chidi@vaceup.ng", "Chidi Tutor",
                                      User.Role.INSTRUCTOR)
        self.learner = self._user("ada@example.com", "Ada Learner", User.Role.STUDENT)

    def _user(self, email, name, role):
        return User.objects.create_user(
            email=email, password="x", full_name=name, role=role, is_active=True
        )

    def _book(self, user, **overrides):
        body = {
            "title": "Weekly tutor check-in",
            "agenda": "How the Virtual Assistant cohort is going.",
            "starts_at": (timezone.now() + timedelta(minutes=5)).isoformat(),
            "duration_minutes": 30,
            "invitees": [self.tutor.pk],
        }
        body.update(overrides)
        self.client.force_authenticate(user=user)
        return self.client.post(MEETINGS, body, format="json")

    def _meeting(self, host=None, **overrides):
        kwargs = {
            "host": host or self.admin,
            "title": "Weekly tutor check-in",
            "starts_at": timezone.now(),
            "duration_minutes": 30,
        }
        kwargs.update(overrides)
        return Meeting.objects.create(**kwargs)

    def _invite(self, meeting, *users):
        return [
            MeetingParticipant.objects.create(meeting=meeting, user=person)
            for person in users
        ]

    def _token(self, user, meeting):
        self.client.force_authenticate(user=user)
        return self.client.post(f"{MEETINGS}{meeting.pk}/token/", {}, format="json")

    # --- who the meeting is visible to ---

    def test_the_booker_and_the_invited_are_the_only_people_it_shows_for(self):
        response = self._book(self.admin)
        self.assertEqual(response.status_code, 201, response.data)
        meeting_id = response.data["id"]

        for person, expected in ((self.admin, 200), (self.tutor, 200),
                                 (self.other_tutor, 404), (self.learner, 404)):
            self.client.force_authenticate(user=person)
            detail = self.client.get(f"{MEETINGS}{meeting_id}/")
            self.assertEqual(detail.status_code, expected,
                             f"{person.role} should not see a staff meeting")

    def test_a_learner_sees_an_empty_list_even_when_a_meeting_is_booked(self):
        self._book(self.admin)
        self.client.force_authenticate(user=self.learner)
        response = self.client.get(MEETINGS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 0)

    def test_only_the_academy_own_people_can_book_a_meeting(self):
        self.client.force_authenticate(user=self.learner)
        response = self.client.post(
            MEETINGS,
            {"title": "Study chat", "starts_at": timezone.now().isoformat(),
             "duration_minutes": 30, "invitees": [self.admin.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("academy's own people", response.data["detail"])

    def test_a_learner_cannot_be_invited_into_a_staff_meeting(self):
        response = self._book(self.admin, invitees=[self.learner.pk])
        self.assertEqual(response.status_code, 400)
        self.assertIn("invitees", response.data)

    def test_a_meeting_is_refused_before_anything_is_booked_if_nobody_is_chosen(self):
        response = self._book(self.admin, invitees=[])
        self.assertEqual(response.status_code, 400)
        self.assertIn("at least one colleague", response.data["invitees"][0])
        self.assertEqual(Meeting.objects.count(), 0)

    def test_a_title_no_one_would_recognise_is_sent_back_with_the_field_to_fix(self):
        response = self._book(self.admin, title="  ")
        self.assertEqual(response.status_code, 400)
        self.assertIn("recognise", response.data["title"][0])

    # --- the room itself ---

    def test_two_meetings_never_share_a_room(self):
        first = self._meeting()
        second = self._meeting(title="Cohort planning")
        self.assertNotEqual(first.room_name, second.room_name)

    def test_the_room_name_is_never_handed_to_the_dashboard(self):
        response = self._book(self.admin)
        self.assertNotIn("room", response.data)
        body = str(response.data)
        meeting = Meeting.objects.get(pk=response.data["id"])
        self.assertNotIn(meeting.room_secret, body)
        self.assertNotIn(meeting.room_name, body)

    @override_settings(**LIVEKIT_KEYS)
    def test_an_invited_tutor_is_handed_a_room_and_their_own_name(self):
        import jwt

        response = self._book(self.admin)
        meeting = Meeting.objects.get(pk=response.data["id"])
        opened = self._token(self.tutor, meeting)
        self.assertEqual(opened.status_code, 200, opened.data)
        self.assertEqual(opened.data["provider"], "livekit")
        self.assertEqual(opened.data["display_name"], "Bola Tutor")
        self.assertFalse(opened.data["is_host"])

        claims = jwt.decode(
            opened.data["token"], LIVEKIT_KEYS["LIVEKIT_API_SECRET"],
            algorithms=["HS256"],
        )
        self.assertEqual(claims["sub"], opened.data["identity"])
        self.assertEqual(claims["video"]["room"], meeting.room_name)
        self.assertTrue(claims["video"]["roomJoin"])

    @override_settings(**LIVEKIT_KEYS)
    def test_opening_the_room_marks_that_the_invitation_was_taken_up(self):
        response = self._book(self.admin)
        meeting = Meeting.objects.get(pk=response.data["id"])
        self._token(self.tutor, meeting)
        row = MeetingParticipant.objects.get(meeting=meeting, user=self.tutor)
        self.assertIsNotNone(row.joined_at)

    @override_settings(LIVEKIT_API_KEY="", LIVEKIT_API_SECRET="", LIVEKIT_WS_URL="")
    def test_a_server_without_keys_says_so_instead_of_opening_a_blank_room(self):
        response = self._book(self.admin)
        meeting = Meeting.objects.get(pk=response.data["id"])
        opened = self._token(self.tutor, meeting)
        self.assertEqual(opened.status_code, 503)
        self.assertIn("LIVEKIT_API_KEY", opened.data["detail"])

    @override_settings(LIVEKIT_API_KEY="", LIVEKIT_API_SECRET="", LIVEKIT_WS_URL="")
    def test_the_dashboard_is_told_up_front_whether_the_room_can_open(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"{MEETINGS}readiness/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["ready"])
        self.assertIn("LIVEKIT_API_KEY", response.data["detail"])

    @override_settings(**{**LIVEKIT_KEYS, "LIVEKIT_WS_URL": ""})
    def test_keys_without_an_address_are_reported_as_the_address_not_the_keys(self):
        """The browser dials an address, not a key, so the sentence must name the right line."""
        response = self._book(self.admin)
        meeting = Meeting.objects.get(pk=response.data["id"])
        opened = self._token(self.tutor, meeting)
        self.assertEqual(opened.status_code, 503)
        self.assertIn("LIVEKIT_WS_URL", opened.data["detail"])
        self.assertNotIn("LIVEKIT_API_KEY", opened.data["detail"])

    def test_somebody_not_invited_cannot_get_into_the_room(self):
        meeting = self._meeting()
        self._invite(meeting, self.tutor)
        opened = self._token(self.other_tutor, meeting)
        self.assertEqual(opened.status_code, 404)

    # --- the window ---

    @override_settings(**LIVEKIT_KEYS)
    def test_an_invitee_arriving_early_is_told_when_the_room_opens(self):
        meeting = self._meeting(starts_at=timezone.now() + timedelta(hours=3))
        self._invite(meeting, self.tutor)
        opened = self._token(self.tutor, meeting)
        self.assertEqual(opened.status_code, 403)
        self.assertIn("opens at", opened.data["detail"])

    @override_settings(**LIVEKIT_KEYS)
    def test_the_booker_can_rehearse_the_room_before_anyone_is_due(self):
        meeting = self._meeting(starts_at=timezone.now() + timedelta(hours=3))
        self._invite(meeting, self.tutor)
        opened = self._token(self.admin, meeting)
        self.assertEqual(opened.status_code, 200, opened.data)
        self.assertTrue(opened.data["is_host"])

    @override_settings(**LIVEKIT_KEYS)
    def test_a_call_that_ran_long_is_not_cut_off_from_the_booker(self):
        meeting = self._meeting(
            starts_at=timezone.now() - timedelta(hours=4), duration_minutes=30
        )
        self._invite(meeting, self.tutor)
        self.assertEqual(self._token(self.admin, meeting).status_code, 200)
        gone = self._token(self.tutor, meeting)
        self.assertEqual(gone.status_code, 403)
        self.assertIn("window has passed", gone.data["detail"])

    # --- changing and closing ---

    def test_only_the_booker_can_change_the_invitation_list(self):
        response = self._book(self.admin)
        meeting_id = response.data["id"]
        self.client.force_authenticate(user=self.tutor)
        patched = self.client.patch(
            f"{MEETINGS}{meeting_id}/", {"title": "Renamed by the tutor"},
            format="json",
        )
        self.assertEqual(patched.status_code, 403)
        self.assertIn("booked this meeting", patched.data["detail"])

    def test_dropping_someone_from_the_list_takes_their_door_away(self):
        response = self._book(self.admin)
        meeting = Meeting.objects.get(pk=response.data["id"])
        self.client.force_authenticate(user=self.admin)
        patched = self.client.patch(
            f"{MEETINGS}{meeting.pk}/", {"invitees": [self.other_tutor.pk]},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertFalse(
            MeetingParticipant.objects.filter(meeting=meeting, user=self.tutor).exists()
        )
        self.assertTrue(
            MeetingParticipant.objects.filter(meeting=meeting,
                                              user=self.other_tutor).exists()
        )

    @override_settings(**LIVEKIT_KEYS)
    def test_an_ended_meeting_stops_answering_for_the_invited(self):
        response = self._book(self.admin)
        meeting = Meeting.objects.get(pk=response.data["id"])
        self.client.force_authenticate(user=self.admin)
        closed = self.client.post(f"{MEETINGS}{meeting.pk}/end/", {}, format="json")
        self.assertEqual(closed.status_code, 200, closed.data)
        self.assertEqual(closed.data["status"], "ended")

        opened = self._token(self.tutor, meeting)
        self.assertEqual(opened.status_code, 403)
        self.assertIn("finished", opened.data["detail"])

    def test_an_invited_tutor_cannot_end_a_meeting_they_did_not_book(self):
        response = self._book(self.admin)
        meeting_id = response.data["id"]
        self.client.force_authenticate(user=self.tutor)
        closed = self.client.post(f"{MEETINGS}{meeting_id}/end/", {}, format="json")
        self.assertEqual(closed.status_code, 403)

    def test_calling_a_meeting_off_tells_everyone_who_was_invited(self):
        mail.outbox.clear()
        response = self._book(self.admin)
        meeting = Meeting.objects.get(pk=response.data["id"])
        mail.outbox.clear()

        self.client.force_authenticate(user=self.admin)
        closed = self.client.post(f"{MEETINGS}{meeting.pk}/cancel/", {}, format="json")
        self.assertEqual(closed.status_code, 200, closed.data)
        self.assertEqual(closed.data["status"], "cancelled")
        self.assertEqual([message.to for message in mail.outbox], [["bola@vaceup.ng"]])
        self.assertIn("called off", mail.outbox[0].body)

    def test_the_invitation_names_the_host_the_hour_and_the_door_in_the_app(self):
        mail.outbox.clear()
        response = self._book(self.admin)
        self.assertEqual(len(mail.outbox), 1, "one message per invitee, never a list")
        message = mail.outbox[0]
        self.assertEqual(message.to, ["bola@vaceup.ng"])
        self.assertIn("Amara Owner", message.body)
        self.assertIn("Weekly tutor check-in", message.body)
        self.assertIn("/meeting/?meeting=", message.body)
        self.assertIn("How the Virtual Assistant cohort is going", message.body)

    def test_an_invitation_never_carries_the_room_name_or_a_second_recipient(self):
        mail.outbox.clear()
        response = self._book(self.admin, invitees=[self.tutor.pk, self.other_tutor.pk])
        meeting = Meeting.objects.get(pk=response.data["id"])
        self.assertEqual(len(mail.outbox), 2)
        for message in mail.outbox:
            self.assertEqual(len(message.to), 1)
            self.assertNotIn(meeting.room_name, message.body)
            self.assertNotIn(meeting.room_secret, message.body)

    def test_a_refused_invitation_is_reported_and_the_meeting_still_stands(self):
        response = self._book(self.admin)
        self.assertEqual(response.data["invited"], ["Bola Tutor"])
        self.assertEqual(response.data["invitation_email_failed"], [])

        # A relay the server will not accept mail from must not undo the booking:
        # the invitation is already in the colleague's dashboard.
        with self.settings(EMAIL_BACKEND="django.core.mail.backends.dummy.EmailBackend"):
            second = self._book(self.admin, title="Records review",
                                invitees=[self.other_tutor.pk])
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(second.data["invited"], [])
        self.assertEqual(second.data["invitation_email_failed"], ["Chidi Tutor"])

        meeting = Meeting.objects.get(pk=second.data["id"])
        self.assertEqual(meeting.status, Meeting.Status.SCHEDULED)
        row = MeetingParticipant.objects.get(meeting=meeting, user=self.other_tutor)
        self.assertIsNone(row.invited_at)

    def test_a_meeting_already_closed_cannot_be_edited_into_a_new_one(self):
        response = self._book(self.admin)
        meeting = Meeting.objects.get(pk=response.data["id"])
        self.client.force_authenticate(user=self.admin)
        self.client.post(f"{MEETINGS}{meeting.pk}/end/", {}, format="json")
        patched = self.client.patch(
            f"{MEETINGS}{meeting.pk}/", {"title": "Rewritten after the call"},
            format="json",
        )
        self.assertEqual(patched.status_code, 403)
        self.assertIn("stays as it is", patched.data["detail"])

    def test_adding_someone_afterwards_reports_whether_the_mail_actually_went(self):
        response = self._book(self.admin)
        meeting_id = response.data["id"]
        mail.outbox.clear()
        self.client.force_authenticate(user=self.admin)
        patched = self.client.patch(
            f"{MEETINGS}{meeting_id}/", {"invitees": [self.tutor.pk, self.other_tutor.pk]},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        # The first colleague was already mailed, so only the new one is reported.
        self.assertEqual(patched.data["invited"], ["Chidi Tutor"])
        self.assertEqual(patched.data["invitation_email_failed"], [])
        self.assertEqual(len(mail.outbox), 1, "nobody is mailed twice for one meeting")

        with self.settings(EMAIL_BACKEND="django.core.mail.backends.dummy.EmailBackend"):
            late = self._user("dee@vaceup.ng", "Dee Tutor", User.Role.INSTRUCTOR)
            refused = self.client.patch(
                f"{MEETINGS}{meeting_id}/",
                {"invitees": [self.tutor.pk, self.other_tutor.pk, late.pk]},
                format="json",
            )
        self.assertEqual(refused.status_code, 200, refused.data)
        self.assertEqual(refused.data["invited"], [], "only the new colleague is reported")
        self.assertEqual(refused.data["invitation_email_failed"], ["Dee Tutor"])
        row = MeetingParticipant.objects.get(meeting_id=meeting_id, user=late)
        self.assertIsNone(row.invited_at, "the meeting is in their dashboard, but no mail went")

    def test_the_colleague_picker_offers_staff_and_never_learners(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"{MEETINGS}colleagues/")
        self.assertEqual(response.status_code, 200)
        ids = {row["id"] for row in response.data}
        self.assertIn(self.tutor.pk, ids)
        self.assertNotIn(self.admin.pk, ids, "you cannot invite yourself")
        self.assertNotIn(self.learner.pk, ids)

    def test_the_picker_is_not_a_directory_for_learners(self):
        self.client.force_authenticate(user=self.learner)
        response = self.client.get(f"{MEETINGS}colleagues/")
        self.assertEqual(response.status_code, 403)

    def test_a_booked_meeting_says_who_has_not_walked_in_yet(self):
        response = self._book(self.admin)
        meeting_id = response.data["id"]
        self.client.force_authenticate(user=self.admin)
        detail = self.client.get(f"{MEETINGS}{meeting_id}/")
        row = detail.data["participants"][0]["person"]
        self.assertEqual(row["full_name"], "Bola Tutor")
        self.assertNotIn("email", row, "an address is not needed to recognise a colleague")
        self.assertFalse(detail.data["participants"][0]["opened_room"])
        self.assertTrue(detail.data["participants"][0]["invited_at"])

    def test_a_far_future_date_is_answered_with_the_honest_limit(self):
        response = self._book(
            self.admin,
            starts_at=(timezone.now() + timedelta(days=400)).isoformat(),
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("four months", response.data["starts_at"][0])
