"""Tests for direct messaging + the access-control policy."""
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
            MESSAGES, {"recipient": recipient.id, "body": body}, format="json")

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
    def test_thread_fetch_marks_incoming_read(self):
        self._send(self.instr, self.student, "lesson tomorrow")
        # Student has 1 unread.
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(UNREAD).data["unread"], 1)
        # Opening the thread marks it read.
        r = self.client.get(THREAD, {"with": self.instr.id})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(self.client.get(UNREAD).data["unread"], 0)

    def test_thread_list_summarizes_conversations(self):
        self._send(self.student, self.instr, "q1")
        self._send(self.instr, self.student, "a1")
        self.client.force_authenticate(self.student)
        r = self.client.get(MESSAGES)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["user_id"], self.instr.id)
        self.assertEqual(r.data[0]["last_message"], "a1")
        self.assertFalse(r.data[0]["last_from_me"])

    def test_empty_body_rejected(self):
        r = self._send(self.student, self.instr, body="   ")
        self.assertEqual(r.status_code, 400)
