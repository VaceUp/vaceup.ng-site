"""Tests for the periodic live-class reminder task (runs eager in tests)."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.liveclasses.models import LiveClass
from apps.liveclasses.tasks import send_live_class_reminders

User = get_user_model()


@override_settings(LIVE_CLASS_REMINDER_LEAD_MINUTES=30)
class ReminderTests(TestCase):
    def setUp(self):
        self.instr = User.objects.create_user(
            email="i@vaceup.ng", password="x", full_name="Ins",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.s1 = User.objects.create_user(
            email="s1@vaceup.ng", password="x", full_name="S1",
            role=User.Role.STUDENT, is_active=True)
        self.s2 = User.objects.create_user(
            email="s2@vaceup.ng", password="x", full_name="S2",
            role=User.Role.STUDENT, is_active=True)
        self.cat = Category.objects.create(name="Cat")
        self.course = Course.objects.create(
            title="C", category=self.cat, instructor=self.instr,
            price=0, is_published=True)
        Enrollment.objects.create(student=self.s1, course=self.course,
                                  status=Enrollment.Status.ACTIVE)
        Enrollment.objects.create(student=self.s2, course=self.course,
                                  status=Enrollment.Status.ACTIVE)

    def _class(self, minutes_ahead):
        return LiveClass.objects.create(
            course=self.course, title="Lecture",
            scheduled_start=timezone.now() + timedelta(minutes=minutes_ahead),
            duration_minutes=60, provider="external",
            join_url="https://meet.example/x")

    def test_reminders_sent_to_enrolled_students_and_idempotent(self):
        lc = self._class(minutes_ahead=20)  # within the 30-min lead window
        mail.outbox.clear()
        sent = send_live_class_reminders()
        self.assertEqual(sent, 2)              # one per enrolled student
        self.assertEqual(len(mail.outbox), 2)
        lc.refresh_from_db()
        self.assertTrue(lc.reminder_sent)

        # Second run does nothing (idempotent).
        mail.outbox.clear()
        self.assertEqual(send_live_class_reminders(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_class_outside_window_not_reminded(self):
        self._class(minutes_ahead=180)  # 3h away, beyond the 30-min lead
        mail.outbox.clear()
        self.assertEqual(send_live_class_reminders(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_cancelled_class_not_reminded(self):
        lc = self._class(minutes_ahead=15)
        lc.status = LiveClass.Status.CANCELLED
        lc.save(update_fields=["status"])
        mail.outbox.clear()
        self.assertEqual(send_live_class_reminders(), 0)
