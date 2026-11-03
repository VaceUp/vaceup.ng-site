"""Live events: the personal joining link, the room it opens and the bulk resend."""

import csv
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.website.join import jitsi_domain, jitsi_room_name, room_is_ready
from apps.website.models import Event, EventRegistration
from apps.website.roster import roster_csv

User = get_user_model()


class SeatTokenTests(TestCase):
    def setUp(self):
        self.now = timezone.now()

    def _event(self, **overrides):
        defaults = {
            "title": "Live Workshop", "event_type": Event.EventType.WORKSHOP,
            "starts_at": self.now + timezone.timedelta(minutes=5),
            "is_published": True, "is_online": True,
            "meeting_url": "https://meet.google.com/abc-defg-hij",
        }
        return Event.objects.create(**{**defaults, **overrides})

    def test_every_seat_carries_its_own_token(self):
        event = self._event()
        first = EventRegistration.objects.create(
            event=event, name="Ada", email="ada@example.com"
        )
        second = EventRegistration.objects.create(
            event=event, name="Bola", email="bola@example.com"
        )
        self.assertTrue(first.join_token)
        self.assertNotEqual(first.join_token, second.join_token)
        self.assertIn(f"token={first.join_token}", first.join_link())

    def test_a_named_room_is_kept_and_a_blank_one_is_derived(self):
        named = self._event(title="Named Room", live_platform="livekit", room_name="cohort-7")
        self.assertEqual(named.room_name, "cohort-7")
        blank = self._event(title="Blank Room", live_platform="livekit")
        self.assertEqual(blank.room_name, f"event-{blank.slug}")


class JitsiRoomTests(TestCase):
    """Jitsi guards a room by its name alone, so the name has to be unguessable."""

    def _event(self, **overrides):
        defaults = {
            "title": "Jitsi Workshop", "event_type": Event.EventType.WORKSHOP,
            "starts_at": timezone.now() + timezone.timedelta(minutes=5),
            "is_published": True, "is_online": True, "live_platform": "jitsi",
        }
        return Event.objects.create(**{**defaults, **overrides})

    def test_two_events_never_share_a_room_code(self):
        first = self._event(title="First Cohort")
        second = self._event(title="Second Cohort")
        self.assertTrue(first.room_secret)
        self.assertNotEqual(first.room_secret, second.room_secret)

    def test_the_public_slug_is_never_the_whole_room_address(self):
        event = self._event()
        room = jitsi_room_name(event)
        self.assertIn(event.room_secret, room)
        self.assertNotEqual(room, f"event-{event.slug}")
        self.assertTrue(event.room_name.startswith("event-"))

    def test_a_label_the_academy_typed_survives_with_the_code_appended(self):
        event = self._event(room_name="Cohort 7 Open Day")
        room = jitsi_room_name(event)
        self.assertTrue(room.startswith("vaceup-Cohort-7-Open-Day-"))
        self.assertIn(event.room_secret, room)
        self.assertNotIn(" ", room)

    def test_a_pasted_server_address_still_names_the_same_server(self):
        cases = {
            "meet.jit.si": "meet.jit.si",
            "https://meet.jit.si/": "meet.jit.si",
            "  meet.jit.si  ": "meet.jit.si",
            "meet.jit.si/some/path": "meet.jit.si",
            "": "meet.jit.si",
        }
        for value, expected in cases.items():
            with self.subTest(value=value), override_settings(JITSI_DOMAIN=value):
                self.assertEqual(jitsi_domain(), expected)

    @override_settings(LIVEKIT_API_KEY="", LIVEKIT_API_SECRET="")
    def test_a_jitsi_event_needs_nothing_from_the_livekit_account(self):
        self.assertTrue(room_is_ready(self._event()))


class EventJoinTests(TestCase):
    """Who may open the room, and what they are handed once they do."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Amara Host",
            role=User.Role.ADMIN, is_active=True,
        )
        self.now = timezone.now()

    def _event(self, **overrides):
        defaults = {
            "title": "Live Workshop", "event_type": Event.EventType.WORKSHOP,
            "starts_at": self.now + timezone.timedelta(minutes=5),
            "is_published": True, "is_online": True,
            "meeting_url": "https://meet.google.com/abc-defg-hij",
        }
        return Event.objects.create(**{**defaults, **overrides})

    def _registration(self, event, **overrides):
        defaults = {"name": "Ada Obi", "email": "ada@example.com"}
        return EventRegistration.objects.create(event=event, **{**defaults, **overrides})

    def _join(self, event, **body):
        return self.client.post(
            f"/api/v1/website/events/{event.slug}/join/", body, format="json"
        )

    def test_a_link_we_never_issued_is_refused(self):
        event = self._event()
        self._registration(event)
        for body in ({"token": ""}, {"token": "made-up"}, {}):
            response = self._join(event, **body)
            self.assertEqual(response.status_code, 403, body)
            self.assertIn("not one we issued", response.data["detail"])

    def test_an_in_person_event_has_no_room_to_enter(self):
        event = self._event(is_online=False)
        registration = self._registration(event)
        response = self._join(event, token=registration.join_token)
        self.assertEqual(response.status_code, 400)
        self.assertIn("not online", response.data["detail"])

    def test_the_seat_opens_before_the_start_and_closes_after_the_end(self):
        event = self._event(
            starts_at=self.now + timezone.timedelta(hours=2),
            ends_at=self.now + timezone.timedelta(hours=3),
        )
        registration = self._registration(event)
        too_early = self._join(event, token=registration.join_token)
        self.assertEqual(too_early.status_code, 409)
        self.assertIn("The room opens at", too_early.data["detail"])

        Event.objects.filter(pk=event.pk).update(
            starts_at=self.now - timezone.timedelta(hours=3),
            ends_at=self.now - timezone.timedelta(hours=2),
        )
        event.refresh_from_db()
        too_late = self._join(event, token=registration.join_token)
        self.assertEqual(too_late.status_code, 409)
        self.assertIn("has finished", too_late.data["detail"])

    def test_an_external_room_hands_over_the_meeting_link(self):
        event = self._event()
        registration = self._registration(event)
        response = self._join(event, token=registration.join_token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["provider"], "external")
        self.assertEqual(response.data["url"], event.meeting_url)
        self.assertEqual(response.data["display_name"], "Ada Obi")

    def test_an_external_room_without_a_link_says_so(self):
        event = self._event(meeting_url="")
        registration = self._registration(event)
        response = self._join(event, token=registration.join_token)
        self.assertEqual(response.status_code, 503)
        self.assertIn("has not set the meeting link", response.data["detail"])

    @override_settings(LIVEKIT_API_KEY="devkey",
                       LIVEKIT_API_SECRET="devsecret-devsecret-devsecret-9f",
                       LIVEKIT_WS_URL="wss://lk.example")
    def test_the_built_in_room_mints_a_token_for_the_seat(self):
        import jwt

        event = self._event(live_platform="livekit", meeting_url="")
        registration = self._registration(event)
        response = self._join(event, token=registration.join_token)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["provider"], "livekit")
        self.assertEqual(response.data["room"], f"event-{event.slug}")
        self.assertEqual(response.data["ws_url"], "wss://lk.example")
        self.assertNotIn("url", response.data)

        claims = jwt.decode(
            response.data["token"], "devsecret-devsecret-devsecret-9f",
            algorithms=["HS256"],
        )
        self.assertEqual(claims["sub"], response.data["identity"])
        self.assertEqual(claims["name"], "Ada Obi")
        self.assertEqual(claims["video"]["room"], f"event-{event.slug}")
        self.assertTrue(claims["video"]["roomJoin"])
        self.assertGreater(claims["exp"], claims["nbf"])

    @override_settings(LIVEKIT_API_KEY="devkey",
                       LIVEKIT_API_SECRET="devsecret-devsecret-devsecret-9f",
                       LIVEKIT_WS_URL="https://lk.example/project")
    def test_a_pasted_https_address_becomes_the_socket_the_browser_needs(self):
        """A dashboard hands out an https URL; the room client only dials a ws one."""
        event = self._event(live_platform="livekit", meeting_url="")
        registration = self._registration(event)
        response = self._join(event, token=registration.join_token)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["ws_url"], "wss://lk.example/project")

    @override_settings(LIVEKIT_API_KEY="devkey",
                       LIVEKIT_API_SECRET="devsecret-devsecret-devsecret-9f",
                       LIVEKIT_WS_URL="lk.example")
    def test_a_bare_host_is_still_a_room_address(self):
        event = self._event(live_platform="livekit", meeting_url="")
        registration = self._registration(event)
        response = self._join(event, token=registration.join_token)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["ws_url"], "wss://lk.example")

    @override_settings(LIVEKIT_API_KEY="", LIVEKIT_API_SECRET="")
    def test_the_built_in_room_without_keys_does_not_send_people_nowhere(self):
        event = self._event(live_platform="livekit", meeting_url="")
        registration = self._registration(event)
        response = self._join(event, token=registration.join_token)
        self.assertEqual(response.status_code, 503)
        self.assertIn("LIVEKIT_API_KEY", response.data["detail"])

    @override_settings(JITSI_DOMAIN="meet.jit.si",
                       LIVEKIT_API_KEY="", LIVEKIT_API_SECRET="")
    def test_a_jitsi_seat_is_handed_the_room_and_their_own_name(self):
        event = self._event(live_platform="jitsi", meeting_url="")
        registration = self._registration(event)
        response = self._join(event, token=registration.join_token)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["provider"], "jitsi")
        self.assertIn(event.room_secret, response.data["room"])
        self.assertEqual(
            response.data["url"], f"https://meet.jit.si/{response.data['room']}"
        )
        self.assertEqual(response.data["display_name"], "Ada Obi")
        self.assertFalse(response.data["is_host"])

    @override_settings(JITSI_DOMAIN="meet.jit.si")
    def test_a_host_entering_a_jitsi_room_is_marked_as_one_of_ours(self):
        event = self._event(live_platform="jitsi", meeting_url="",
                            starts_at=self.now + timezone.timedelta(days=1))
        self.client.force_authenticate(self.admin)
        host = self._join(event, token="")
        self.assertEqual(host.status_code, 200, host.data)
        self.assertTrue(host.data["is_host"])
        self.assertEqual(host.data["display_name"], "Amara Host")

    @override_settings(JITSI_DOMAIN="meet.jit.si")
    def test_the_public_payload_never_carries_the_jitsi_address(self):
        event = self._event(live_platform="jitsi", meeting_url="")
        response = self.client.get(f"/api/v1/website/events/{event.slug}/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["join_ready"])
        for key in ("room", "room_secret", "url", "domain", "room_name"):
            self.assertNotIn(key, response.data)

    def test_a_host_may_rehearse_before_the_room_opens(self):
        event = self._event(starts_at=self.now + timezone.timedelta(days=1))
        registration = self._registration(event)
        self.assertEqual(
            self._join(event, token=registration.join_token).status_code, 409
        )

        self.client.force_authenticate(self.admin)
        host = self._join(event, token=registration.join_token)
        self.assertEqual(host.status_code, 200, host.data)
        self.assertEqual(host.data["provider"], "external")

    @override_settings(LIVEKIT_API_KEY="devkey",
                       LIVEKIT_API_SECRET="devsecret-devsecret-devsecret-9f",
                       LIVEKIT_WS_URL="wss://lk.example")
    def test_a_host_entering_the_built_in_room_may_speak(self):
        event = self._event(live_platform="livekit", meeting_url="",
                            starts_at=self.now + timezone.timedelta(days=1))
        registration = self._registration(event)
        self.client.force_authenticate(self.admin)
        host = self._join(event, token=registration.join_token)
        self.assertEqual(host.status_code, 200, host.data)
        self.assertTrue(host.data["is_host"])
        self.assertTrue(host.data["can_publish"])
        self.assertEqual(host.data["identity"], f"host-{self.admin.pk}")

    def test_the_public_payload_shows_readiness_but_never_the_address(self):
        event = self._event()
        response = self.client.get(f"/api/v1/website/events/{event.slug}/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["join_ready"])
        self.assertTrue(response.data["is_joinable"])
        self.assertIsNone(response.data.get("meeting_url"))
        self.assertIsNotNone(response.data["join_opens_at"])

    def test_a_draft_event_is_not_joinable_by_the_public(self):
        event = self._event(is_published=False)
        registration = self._registration(event)
        self.assertEqual(
            self._join(event, token=registration.join_token).status_code, 404
        )


class EventSendLinkTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Amara Host",
            role=User.Role.ADMIN, is_active=True,
        )
        self.now = timezone.now()

    def _event(self, **overrides):
        defaults = {
            "title": "Live Workshop", "event_type": Event.EventType.WORKSHOP,
            "starts_at": self.now + timezone.timedelta(days=1),
            "is_published": True, "is_online": True,
            "meeting_url": "https://meet.google.com/abc-defg-hij",
        }
        return Event.objects.create(**{**defaults, **overrides})

    def _roster(self, event, *emails):
        return [
            EventRegistration.objects.create(
                event=event, name=email.split("@")[0].title(), email=email
            )
            for email in emails
        ]

    def _send(self, event):
        self.client.force_authenticate(self.admin)
        return self.client.post(
            f"/api/v1/website/events/{event.slug}/send-link/", {}, format="json"
        )

    def test_only_an_admin_can_bulk_send(self):
        event = self._event()
        self._roster(event, "ada@example.com")
        response = self.client.post(
            f"/api/v1/website/events/{event.slug}/send-link/", {}, format="json"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(len(mail.outbox), 0)

    def test_an_in_person_event_has_no_link_to_send(self):
        event = self._event(is_online=False)
        response = self._send(event)
        self.assertEqual(response.status_code, 400)
        self.assertIn("not online", response.data["detail"])

    def test_the_link_is_not_sent_before_the_room_exists(self):
        event = self._event(meeting_url="")
        self._roster(event, "ada@example.com")
        response = self._send(event)
        self.assertEqual(response.status_code, 400)
        self.assertIn("VaceUp Live Room", response.data["detail"])
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(LIVEKIT_API_KEY="", LIVEKIT_API_SECRET="")
    def test_a_jitsi_roster_can_be_mailed_straight_away(self):
        event = self._event(live_platform="jitsi", meeting_url="")
        self._roster(event, "ada@example.com")
        mail.outbox.clear()

        response = self._send(event)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["sent"], 1)
        self.assertIn("Join here:", mail.outbox[0].body)

    def test_an_empty_roster_is_reported_not_sent(self):
        event = self._event()
        response = self._send(event)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["total"], 0)

    def test_every_registrant_is_emailed_and_stamped(self):
        event = self._event()
        kept, dropped = self._roster(event, "ada@example.com", "bola@example.com")
        mail.outbox.clear()

        def relay(message):
            if message.to == ["bola@example.com"]:
                raise RuntimeError("smtp rejected")

        with patch("apps.website.emails.send_account_message", side_effect=relay):
            response = self._send(event)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["sent"], 1)
        self.assertEqual(response.data["failed"], 1)
        self.assertEqual(response.data["total"], 2)
        self.assertIn("1 of 2 registrants", response.data["detail"])
        self.assertEqual(len(mail.outbox), 0)
        kept.refresh_from_db()
        dropped.refresh_from_db()
        self.assertIsNotNone(kept.join_link_sent_at)
        self.assertIsNone(dropped.join_link_sent_at)

    def test_the_joining_mail_carries_the_personal_link(self):
        event = self._event()
        registration = self._roster(event, "ada@example.com")[0]
        mail.outbox.clear()
        self._send(event)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ada@example.com"])
        self.assertIn("Joining link:", mail.outbox[0].subject)
        self.assertIn(registration.join_link(), mail.outbox[0].body)
        registration.refresh_from_db()
        self.assertIsNotNone(registration.join_link_sent_at)


class EventResendLinkTests(TestCase):
    """Self-serve recovery for an attendee who cannot find the confirmation."""

    def setUp(self):
        self.client = APIClient()
        now = timezone.now()
        self.event = Event.objects.create(
            title="Live Clinic", event_type=Event.EventType.WORKSHOP,
            starts_at=now + timezone.timedelta(days=1), is_published=True,
            is_online=True, meeting_url="https://meet.google.com/abc-defg-hij",
        )
        self.registration = EventRegistration.objects.create(
            event=self.event, name="Ada Obi", email="ada@example.com",
        )
        self.url = f"/api/v1/website/events/{self.event.slug}/resend-link/"

    def test_a_lost_link_is_reissued_to_the_booked_email(self):
        mail.outbox.clear()
        response = self.client.post(self.url, {"email": " ADA@example.com "}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("on its way", response.data["detail"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ada@example.com"])
        self.assertIn(self.registration.join_link(), mail.outbox[0].body)
        self.registration.refresh_from_db()
        self.assertIsNotNone(self.registration.join_link_sent_at)

    def test_an_unknown_email_is_answered_exactly_the_same(self):
        mail.outbox.clear()
        response = self.client.post(self.url, {"email": "nobody@example.com"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        self.assertIn("If that email registered", response.data["detail"])

    def test_a_blank_email_promises_nothing(self):
        mail.outbox.clear()
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_an_in_person_event_has_no_link_to_reissue(self):
        event = Event.objects.create(
            title="Open Day", starts_at=timezone.now(), is_published=True,
        )
        response = self.client.post(
            f"/api/v1/website/events/{event.slug}/resend-link/",
            {"email": "ada@example.com"}, format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_the_recovery_route_cannot_be_used_to_spam_a_seat(self):
        for _ in range(3):
            self.assertEqual(
                self.client.post(self.url, {"email": "ada@example.com"}, format="json").status_code,
                200,
            )
        self.assertEqual(
            self.client.post(self.url, {"email": "ada@example.com"}, format="json").status_code,
            429,
        )


class RosterLinkColumnTests(TestCase):
    """The printed list must answer "did this person get the link?"."""

    def test_the_column_is_empty_for_a_physical_venue(self):
        event = Event.objects.create(
            title="Bootcamp Open Day", starts_at=timezone.now(), is_online=False,
        )
        EventRegistration.objects.create(event=event, name="Ada", email="ada@example.com")
        body = roster_csv(event)
        self.assertIn("Joining link sent", body.splitlines()[0])
        rows = {
            r[0]: r[5]
            for r in csv.reader(body.lstrip("﻿").splitlines())
        }
        self.assertEqual(rows["Ada"], "")

    def test_an_online_roster_shares_who_was_emailed(self):
        event = Event.objects.create(
            title="Live Clinic", starts_at=timezone.now(), is_online=True,
            meeting_url="https://meet.google.com/abc-defg-hij",
        )
        emailed = EventRegistration.objects.create(
            event=event, name="Ada", email="ada@example.com"
        )
        EventRegistration.objects.create(event=event, name="Bola", email="bola@example.com")
        emailed.join_link_sent_at = timezone.now()
        emailed.save(update_fields=["join_link_sent_at"])

        rows = {
            r[0]: r[5]
            for r in csv.reader(roster_csv(event).lstrip("﻿").splitlines())
        }
        self.assertEqual(rows["Ada"], timezone.localtime(
            emailed.join_link_sent_at).strftime("%Y-%m-%d %H:%M"))
        self.assertEqual(rows["Bola"], "not sent")

    def test_the_list_also_says_who_got_the_academy_note(self):
        event = Event.objects.create(
            title="Open Day", starts_at=timezone.now(), is_online=False,
        )
        mailed = EventRegistration.objects.create(
            event=event, name="Ada", email="ada@example.com"
        )
        EventRegistration.objects.create(event=event, name="Bola", email="bola@example.com")
        mailed.broadcast_sent_at = timezone.now()
        mailed.save(update_fields=["broadcast_sent_at"])

        rows = {
            r[0]: r[7]
            for r in csv.reader(roster_csv(event).lstrip("﻿").splitlines())
        }
        self.assertEqual(rows["Ada"], timezone.localtime(
            mailed.broadcast_sent_at).strftime("%Y-%m-%d %H:%M"))
        self.assertEqual(rows["Bola"], "not sent")


class EventBroadcastTests(TestCase):
    """Bulk mail from the event panel: one note, one message per registrant."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Amara Host",
            role=User.Role.ADMIN, is_active=True,
        )
        self.event = Event.objects.create(
            title="Excel Bootcamp", event_type=Event.EventType.WORKSHOP,
            starts_at=timezone.now() + timezone.timedelta(days=1),
            is_published=True, is_online=True,
            meeting_url="https://meet.google.com/abc-defg-hij",
        )

    def _roster(self, *emails):
        return [
            EventRegistration.objects.create(
                event=self.event, name=email.split("@")[0].title(), email=email
            )
            for email in emails
        ]

    def _send(self, **payload):
        body = {"subject": "The classroom opens early",
                "message": "The room opens at 19:30, not 20:00."}
        body.update(payload)
        self.client.force_authenticate(self.admin)
        return self.client.post(
            f"/api/v1/website/events/{self.event.slug}/broadcast/", body, format="json"
        )

    def test_only_an_admin_can_send_a_note(self):
        self._roster("ada@example.com")
        mail.outbox.clear()
        response = self.client.post(
            f"/api/v1/website/events/{self.event.slug}/broadcast/",
            {"subject": "Hello", "message": "The room is ready."}, format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(len(mail.outbox), 0)

    def test_an_empty_roster_is_refused_before_anything_is_written(self):
        response = self._send()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["total"], 0)

    def test_every_registrant_gets_their_own_message(self):
        self._roster("ada@example.com", "bola@example.com", "chidi@example.com")
        mail.outbox.clear()

        response = self._send()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["sent"], 3)
        self.assertEqual(response.data["remaining"], 0)
        self.assertEqual(len(mail.outbox), 3)
        for message in mail.outbox:
            self.assertEqual(len(message.to), 1)
            self.assertEqual(message.subject, "The classroom opens early")
            self.assertIn("The room opens at 19:30", message.body)
            self.assertIn("Excel Bootcamp", message.body)
            self.assertIn("You are receiving this because you registered", message.body)

    def test_a_roster_is_walked_in_batches_without_repeating_anyone(self):
        self._roster("ada@example.com", "bola@example.com", "chidi@example.com")
        mail.outbox.clear()

        first = self._send(batch=2)
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["sent"], 2)
        self.assertEqual(first.data["remaining"], 1)
        self.assertIs(first.data["done"], False)

        second = self._send(batch=2)
        self.assertEqual(second.data["sent"], 1)
        self.assertEqual(second.data["remaining"], 0)
        self.assertIs(second.data["done"], True)

        self.assertEqual(len(mail.outbox), 3)
        self.assertEqual(
            sorted(address for message in mail.outbox for address in message.to),
            ["ada@example.com", "bola@example.com", "chidi@example.com"],
        )

    def test_send_again_to_everyone_includes_the_already_mailed(self):
        self._roster("ada@example.com", "bola@example.com")
        mail.outbox.clear()
        self.assertEqual(self._send(batch=5).data["sent"], 2)

        response = self._send(batch=5, only_unmailed="false")
        self.assertEqual(response.data["sent"], 2)
        self.assertEqual(len(mail.outbox), 4)

    def test_a_blank_subject_or_message_is_answered_with_the_field_to_fix(self):
        self._roster("ada@example.com")
        response = self._send(subject=" ", message="")
        self.assertEqual(response.status_code, 400)
        self.assertIn("subject", response.data)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_a_subject_cannot_smuggle_a_second_header(self):
        self._roster("ada@example.com")
        mail.outbox.clear()

        response = self._send(subject="Moved\r\nBcc: someone@example.com")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(mail.outbox[0].subject, "Moved Bcc: someone@example.com")
        self.assertNotIn("\r", mail.outbox[0].subject)
        self.assertNotIn("\n", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["ada@example.com"])

    def test_the_joining_link_rides_along_only_when_asked(self):
        registration = self._roster("ada@example.com")[0]
        mail.outbox.clear()
        self._send()
        self.assertIn(registration.join_link(), mail.outbox[0].body)

        mail.outbox.clear()
        self._send(subject="Certificate collection", include_link="false", only_unmailed="false")
        self.assertNotIn("Join here:", mail.outbox[0].body)

    def test_a_refused_address_is_left_unstamped_for_the_next_batch(self):
        self._roster("ada@example.com", "bola@example.com", "chidi@example.com")
        mail.outbox.clear()

        def relay(message):
            if message.to == ["bola@example.com"]:
                raise RuntimeError("relay refused the sender")

        with patch("apps.website.emails.send_account_message", side_effect=relay):
            first = self._send(batch=2)
        self.assertEqual(first.data["sent"], 1)
        self.assertEqual(first.data["failed"], 1)
        self.assertEqual(first.data["remaining"], 2)
        self.assertEqual(
            {row.email for row in self.event.registrations.filter(broadcast_sent_at__isnull=True)},
            {"bola@example.com", "chidi@example.com"},
        )

    def test_an_overlong_message_is_refused_rather_than_truncated(self):
        self._roster("ada@example.com")
        response = self._send(message="x" * 4001)
        self.assertEqual(response.status_code, 400)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)
