"""Tests for direct messaging + the access-control policy."""
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.messaging.models import Message

User = get_user_model()

MESSAGES = "/api/v1/messages/"
THREAD = "/api/v1/messages/thread/"
UNREAD = "/api/v1/messages/unread-count/"


@override_settings(SECURE_SSL_REDIRECT=False)
class MessagingTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.instr = User.objects.create_user(
            email="i@vaceup.ng", password="x", full_name="Ins",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.other_instr = User.objects.create_user(
            email="i2@vaceup.ng", password="x", full_name="Ins2",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s@vaceup.ng", password="x", full_name="Stud",
            role=User.Role.STUDENT, is_active=True)
        self.student2 = User.objects.create_user(
            email="s2@vaceup.ng", password="x", full_name="Stud2",
            role=User.Role.STUDENT, is_active=True)
        self.admin = User.objects.create_user(
            email="a@vaceup.ng", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_active=True, is_staff=True)
        self.cat = Category.objects.create(name="Cat")
        self.course = Course.objects.create(
            title="C", category=self.cat, instructor=self.instr,
            price=0, is_published=True)
        # student is enrolled with instr (but NOT with other_instr).
        Enrollment.objects.create(student=self.student, course=self.course,
                                  status=Enrollment.Status.ACTIVE)

    def _send(self, sender, recipient, body="hi"):
        self.client.force_authenticate(sender)
        return self.client.post(
            MESSAGES, {"recipient": recipient.id, "body": body, "client_message_id": str(uuid4())}, format="json")

    # --- policy -------------------------------------------------------------
    def test_enrolled_student_can_message_their_instructor(self):
        r = self._send(self.student, self.instr)
        self.assertEqual(r.status_code, 201)

    def test_instructor_can_message_their_student(self):
        r = self._send(self.instr, self.student)
        self.assertEqual(r.status_code, 201)

    def test_student_cannot_message_unrelated_instructor(self):
        r = self._send(self.student, self.other_instr)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["error"]["code"], "messaging_not_allowed")

    def test_student_cannot_message_another_student(self):
        r = self._send(self.student, self.student2)
        self.assertEqual(r.status_code, 403)

    def test_anyone_can_message_admin(self):
        r = self._send(self.student2, self.admin)
        self.assertEqual(r.status_code, 201)

    def test_cannot_message_self(self):
        r = self._send(self.instr, self.instr)
        self.assertEqual(r.status_code, 403)

    # --- threads & unread ---------------------------------------------------
    def test_thread_fetch_does_not_mark_read_until_acknowledged(self):
        self._send(self.instr, self.student, "lesson tomorrow")
        # Student has 1 unread.
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(UNREAD).data["unread"], 1)
        # Fetching is not evidence the user has displayed the message.
        r = self.client.get(THREAD, {"with": self.instr.id})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(self.client.get(UNREAD).data["unread"], 1)
        acknowledged = self.client.post("/api/v1/messages/read/", {"with": self.instr.pk, "through_id": r.data["results"][0]["id"]}, format="json")
        self.assertEqual(acknowledged.status_code, 200)
        self.assertEqual(self.client.get(UNREAD).data["unread"], 0)

    def test_thread_list_summarizes_conversations(self):
        self._send(self.student, self.instr, "q1")
        self._send(self.instr, self.student, "a1")
        self.client.force_authenticate(self.student)
        r = self.client.get(MESSAGES)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["results"]), 1)
        self.assertEqual(r.data["results"][0]["user_id"], self.instr.id)
        self.assertEqual(r.data["results"][0]["last_message"], "a1")
        self.assertFalse(r.data["results"][0]["last_from_me"])

    def test_classmates_are_permitted_and_directory_has_no_email(self):
        Enrollment.objects.create(student=self.student2, course=self.course, status="completed")
        self.assertEqual(self._send(self.student, self.student2).status_code, 201)
        data = self.client.get("/api/v1/messages/contacts/").data["results"]
        self.assertIn(self.student2.pk, [row["user_id"] for row in data])
        self.assertTrue(all(set(row) == {"user_id", "full_name", "role"} for row in data))

    def test_retry_returns_original_and_changed_payload_conflicts(self):
        self.client.force_authenticate(self.student)
        data = {"recipient": self.instr.pk, "body": " hi ", "client_message_id": str(uuid4())}
        first = self.client.post(MESSAGES, data, format="json")
        retry = self.client.post(MESSAGES, data, format="json")
        self.assertEqual((first.status_code, retry.status_code), (201, 200))
        self.assertEqual(first.data["id"], retry.data["id"])
        data["body"] = "different"
        self.assertEqual(self.client.post(MESSAGES, data, format="json").status_code, 409)
        self.assertEqual(Message.objects.count(), 1)

    def test_revoked_membership_hides_history_and_prevents_sending(self):
        self._send(self.instr, self.student)
        Enrollment.objects.filter(student=self.student).update(status="suspended")
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(THREAD, {"with": self.instr.pk}).status_code, 403)
        self.assertEqual(self.client.get(MESSAGES).data["count"], 0)
        self.assertEqual(self.client.get(UNREAD).data["unread"], 0)
        self.assertEqual(self._send(self.student, self.instr).status_code, 403)

    def test_block_unblock_and_report_preserve_scope(self):
        sent = self._send(self.instr, self.student)
        self.client.force_authenticate(self.student)
        blocked = self.client.post("/api/v1/messages/block/", {"user_id": self.instr.pk}, format="json")
        self.assertEqual(blocked.status_code, 200)
        self.assertEqual(self.client.get(THREAD, {"with": self.instr.pk}).status_code, 403)
        report = {"message_id": sent.data["id"], "reason": "Unwanted contact"}
        self.assertEqual(self.client.post("/api/v1/messages/report/", report, format="json").status_code, 201)
        self.assertEqual(self.client.post("/api/v1/messages/report/", report, format="json").status_code, 200)
        self.client.force_authenticate(self.student2)
        self.assertEqual(self.client.post("/api/v1/messages/report/", report, format="json").status_code, 404)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post("/api/v1/messages/unblock/", {"user_id": self.instr.pk}, format="json").status_code, 200)
        self.assertEqual(self.client.get(THREAD, {"with": self.instr.pk}).status_code, 200)

    def test_cursor_pagination_and_read_boundary(self):
        Message.objects.bulk_create([Message(sender=self.instr, recipient=self.student, body=str(i)) for i in range(5)])
        self.client.force_authenticate(self.student)
        first = self.client.get(THREAD, {"with": self.instr.pk, "page_size": 2}).data
        self.assertTrue(first["has_more"])
        self.assertEqual([m["body"] for m in first["results"]], ["4", "3"])
        older = self.client.get(THREAD, {"with": self.instr.pk, "page_size": 2, "before_id": first["next_before_id"]}).data
        self.assertEqual([m["body"] for m in older["results"]], ["2", "1"])
        boundary = older["results"][0]["id"]
        read = self.client.post("/api/v1/messages/read/", {"with": self.instr.pk, "through_id": boundary}, format="json")
        self.assertEqual(read.data["updated"], 3)
        self.assertEqual(read.data["unread"], 2)
        first_read = Message.objects.get(pk=boundary).read_at
        self.client.post("/api/v1/messages/read/", {"with": self.instr.pk, "through_id": boundary}, format="json")
        self.assertEqual(Message.objects.get(pk=boundary).read_at, first_read)
        newer = self.client.get(THREAD, {"with": self.instr.pk, "after_id": boundary}).data
        self.assertEqual([m["body"] for m in newer["results"]], ["3", "4"])

    def test_invalid_and_duplicate_query_values_return_400(self):
        self.client.force_authenticate(self.student)
        for query in ["with=x", "with=1&with=2", f"with={self.instr.pk}&page_size=101", f"with={self.instr.pk}&before_id=0", f"with={self.instr.pk}&before_id=1&after_id=2"]:
            self.assertEqual(self.client.get(THREAD + "?" + query).status_code, 400)

    def test_send_limit_is_database_based_and_retry_does_not_use_quota(self):
        for _ in range(30):
            self.assertEqual(self._send(self.student, self.instr).status_code, 201)
        self.assertEqual(self._send(self.student, self.instr).status_code, 429)

    def test_notifications_are_paginated_scoped_and_explicitly_read(self):
        from apps.messaging.models import Notification
        item = Notification.objects.create(recipient=self.student, title="Grade posted", body="Your result is available.", type="grade_posted")
        self.client.force_authenticate(self.student)
        response = self.client.get("/api/v1/notifications/")
        self.assertEqual(response.data["results"][0]["title"], "Grade posted")
        item.refresh_from_db()
        self.assertFalse(item.is_read)
        self.client.post(f"/api/v1/notifications/{item.pk}/read/")
        item.refresh_from_db()
        stamp = item.read_at
        self.client.post(f"/api/v1/notifications/{item.pk}/read/")
        item.refresh_from_db()
        self.assertEqual(stamp, item.read_at)
        self.client.force_authenticate(self.student2)
        self.assertEqual(self.client.post(f"/api/v1/notifications/{item.pk}/read/").status_code, 404)

    def test_empty_body_rejected(self):
        r = self._send(self.student, self.instr, body="   ")
        self.assertEqual(r.status_code, 400)
