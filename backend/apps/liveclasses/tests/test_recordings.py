"""Recordings: host-only publication, verified uploads and scoped private replays."""
from unittest.mock import patch

from botocore.exceptions import ClientError
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.liveclasses.models import LiveClass, RoomRecording
from apps.meetings.models import Meeting, MeetingParticipant
from apps.website.models import Event, EventRegistration

User = get_user_model()
BASE = "/api/v1/room-recordings/"


class RoomRecordingTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.host = User.objects.create_user(email="host@example.com", password="x", role="instructor", is_active=True)
        self.admin = User.objects.create_user(email="admin@example.com", password="x", role="admin", is_active=True)
        self.other = User.objects.create_user(email="other@example.com", password="x", role="instructor", is_active=True)
        self.student = User.objects.create_user(email="student@example.com", password="x", role="student", is_active=True)
        self.outsider = User.objects.create_user(email="outsider@example.com", password="x", role="student", is_active=True)
        course = Course.objects.create(title="Excel", instructor=self.host, category=Category.objects.create(name="Skills"))
        self.enrollment = Enrollment.objects.create(student=self.student, course=course, status="active")
        self.lesson = LiveClass.objects.create(course=course, title="Excel formulas", provider="livekit", scheduled_start=timezone.now())
        self.event = Event.objects.create(title="3-Day Excel", slug="excel-free-class", starts_at=timezone.now(), is_published=True, is_online=True, live_platform="livekit")
        self.event.hosts.add(self.host)
        self.seat = EventRegistration.objects.create(event=self.event, name="Guest", email="guest@example.com")
        self.meeting = Meeting.objects.create(host=self.host, title="Staff call")
        MeetingParticipant.objects.create(meeting=self.meeting, user=self.other)
        self.signer = patch("apps.core.storage.presigned_upload_url", return_value="https://storage.example/signed-put")
        self.signer.start()
        self.addCleanup(self.signer.stop)
        self.downloader = patch("apps.core.storage.presigned_download_url", return_value="https://storage.example/signed-get")
        self.downloader.start()
        self.addCleanup(self.downloader.stop)
        self.storage = patch("apps.core.storage._client")
        self.client_store = self.storage.start().return_value
        self.client_store.head_object.return_value = {"ContentLength": 100, "ContentType": "video/webm"}
        self.addCleanup(self.storage.stop)

    def upload(self, *, kind="class", target=None, user=None, **extra):
        self.client.force_authenticate(user or self.host)
        return self.client.post(BASE, {
            "kind": kind, "id": target or str(self.lesson.pk), "title": "Excel part one",
            "content_type": "video/webm", "size_bytes": 100, **extra,
        }, format="json")

    def complete(self, result):
        return self.client.post(f"{BASE}{result.data['id']}/complete/", format="json")

    def replays(self, kind="class", target=None, token="", user=None):
        self.client.force_authenticate(user)
        return self.client.post(BASE + "replays/", {"kind": kind, "id": target or str(self.lesson.pk), "token": token}, format="json")

    def test_upload_is_private_until_verified_and_preserves_multiple_parts(self):
        first = self.upload()
        self.assertEqual(first.status_code, 201, first.data)
        self.assertNotIn("key", first.data)
        self.assertEqual(self.replays(user=self.student).data["recordings"], [])
        self.client.force_authenticate(self.host)
        self.assertEqual(self.complete(first).status_code, 200)
        second = self.upload(title="Excel part two")
        self.assertEqual(self.complete(second).status_code, 200)
        recordings = self.replays(user=self.student).data["recordings"]
        self.assertEqual([row["title"] for row in recordings], ["Excel part one", "Excel part two"])
        self.assertTrue(all("key" not in row for row in recordings))
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.recording_status, "ready")
        self.assertTrue(self.lesson._user_has_recording_access(self.student))
        # No Attendance exists: a missed class still has a replay.
        self.assertFalse(self.lesson.attendances.exists())

    def test_student_foreign_tutor_and_outsider_cannot_publish(self):
        for user in (self.student, self.other, self.outsider):
            self.assertEqual(self.upload(user=user).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.post(BASE, {}, format="json").status_code, (401, 403))

    def test_outsider_cannot_play_and_revoked_enrollment_loses_access(self):
        self.assertEqual(self.replays(user=self.outsider).status_code, 403)
        self.enrollment.status = "cancelled"
        self.enrollment.save()
        self.assertEqual(self.replays(user=self.student).status_code, 403)

    def test_incomplete_missing_wrong_type_uploads_never_become_ready(self):
        result = self.upload()
        for info in ({"ContentLength": 99, "ContentType": "video/webm"}, {"ContentLength": 100, "ContentType": "text/html"}):
            self.client_store.head_object.return_value = info
            self.assertEqual(self.complete(result).status_code, 409)
        self.client_store.head_object.side_effect = ClientError({"Error": {"Code": "404"}}, "HeadObject")
        self.assertEqual(self.complete(result).status_code, 409)
        self.assertEqual(RoomRecording.objects.get(pk=result.data["id"]).status, "uploading")

    def test_completion_is_idempotent_and_another_user_cannot_complete(self):
        result = self.upload()
        self.client.force_authenticate(self.student)
        self.assertEqual(self.complete(result).status_code, 403)
        self.client.force_authenticate(self.host)
        self.assertEqual(self.complete(result).status_code, 200)
        self.assertEqual(self.complete(result).status_code, 200)
        self.assertEqual(self.client_store.head_object.call_count, 1)

    def test_reassigned_tutor_cannot_finish_old_upload(self):
        result = self.upload()
        self.lesson.course.instructor = self.other
        self.lesson.course.save()
        self.assertEqual(self.complete(result).status_code, 403)

    def test_invalid_type_size_and_session_fail_validation(self):
        for extra in ({"content_type": "text/html"}, {"size_bytes": 0}, {"size_bytes": 6 * 1024 ** 3}, {"kind": "unknown"}, {"id": "bad"}):
            self.assertEqual(self.upload(**extra).status_code, 400)

    def test_event_guest_can_rewatch_after_event_but_token_cannot_open_other_event(self):
        result = self.upload(kind="event", target=self.event.slug)
        self.assertEqual(self.complete(result).status_code, 200)
        self.event.ends_at = timezone.now() - timezone.timedelta(days=1)
        self.event.save()
        response = self.replays("event", self.event.slug, self.seat.join_token)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["recordings"]), 1)
        other = Event.objects.create(title="Other", starts_at=timezone.now(), is_published=True)
        self.assertEqual(self.replays("event", other.slug, self.seat.join_token).status_code, 403)
        self.assertEqual(self.replays("event", self.event.slug).status_code, 403)

    def test_unassigned_tutor_cannot_record_event_and_removal_revokes_upload(self):
        self.assertEqual(self.upload(kind="event", target=self.event.slug, user=self.other).status_code, 403)
        result = self.upload(kind="event", target=self.event.slug)
        self.event.hosts.clear()
        self.assertEqual(self.complete(result).status_code, 403)

    def test_staff_meeting_replay_is_limited_to_host_and_current_invitees(self):
        result = self.upload(kind="meeting", target=str(self.meeting.pk))
        self.assertEqual(self.complete(result).status_code, 200)
        self.assertEqual(self.replays("meeting", str(self.meeting.pk), user=self.other).status_code, 200)
        self.assertEqual(self.replays("meeting", str(self.meeting.pk), user=self.admin).status_code, 403)
        self.meeting.participants.all().delete()
        self.assertEqual(self.replays("meeting", str(self.meeting.pk), user=self.other).status_code, 403)

    def test_event_host_assignment_accepts_multipart_add_and_clear(self):
        self.client.force_authenticate(self.admin)
        url = f"/api/v1/website/events/{self.event.slug}/"
        response = self.client.patch(url, {"hosts": [self.other.pk]}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(list(self.event.hosts.values_list("pk", flat=True)), [self.other.pk])
        self.assertEqual(self.client.patch(url, {"hosts": ""}, format="multipart").status_code, 200)
        self.assertFalse(self.event.hosts.exists())
        self.assertEqual(self.client.patch(url, {"hosts": [self.student.pk]}, format="json").status_code, 400)

    @override_settings(LIVEKIT_API_KEY="test-key", LIVEKIT_API_SECRET="test-secret-with-at-least-32-characters", LIVEKIT_WS_URL="wss://room.example.test")
    def test_assigned_event_tutor_gets_host_seat_and_guest_never_does(self):
        self.client.force_authenticate(self.host)
        url = f"/api/v1/website/events/{self.event.slug}/join/"
        host = self.client.post(url, {}, format="json")
        self.assertEqual(host.status_code, 200, host.data)
        self.assertTrue(host.data["is_host"])
        self.client.force_authenticate(None)
        guest = self.client.post(url, {"token": self.seat.join_token}, format="json")
        self.assertEqual(guest.status_code, 200, guest.data)
        self.assertFalse(guest.data["is_host"])

    def test_storage_failure_does_not_create_or_publish_recording(self):
        from apps.core.storage import StorageNotConfigured
        with patch("apps.core.storage.presigned_upload_url", side_effect=StorageNotConfigured()):
            self.assertEqual(self.upload().status_code, 503)
        self.assertFalse(RoomRecording.objects.exists())
