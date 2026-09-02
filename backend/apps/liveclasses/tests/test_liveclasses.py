"""Tests for scheduling, join-window gating, attendance, and LiveKit tokens."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from apps.liveclasses.models import Attendance, LiveClass

User = get_user_model()

LC = "/api/v1/live-classes/"


@override_settings(SECURE_SSL_REDIRECT=False)
class LiveClassTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.instr = User.objects.create_user(
            email="i@vaceup.ng", password="x", full_name="Ins",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.instr2 = User.objects.create_user(
            email="i2@vaceup.ng", password="x", full_name="Ins2",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s@vaceup.ng", password="x", full_name="Stud",
            role=User.Role.STUDENT, is_active=True)
        self.outsider = User.objects.create_user(
            email="o@vaceup.ng", password="x", full_name="Out",
            role=User.Role.STUDENT, is_active=True)
        self.cat = Category.objects.create(name="Cat")
        self.course = Course.objects.create(
            title="C", category=self.cat, instructor=self.instr,
            price=0, is_published=True)
        Enrollment.objects.create(student=self.student, course=self.course,
                                  status=Enrollment.Status.ACTIVE)

    def _class(self, *, start=None, provider="external", **kw):
        return LiveClass.objects.create(
            course=self.course, title="Lecture",
            scheduled_start=start or timezone.now(),
            duration_minutes=60, provider=provider,
            join_url="https://meet.example/abc", **kw)

    # --- scheduling ---------------------------------------------------------
    def test_instructor_schedules_on_own_course(self):
        self.client.force_authenticate(self.instr)
        r = self.client.post(LC, {
            "course": self.course.id, "title": "Intro",
            "scheduled_start": timezone.now().isoformat(),
            "duration_minutes": 45, "provider": "external",
            "join_url": "https://meet.example/x"}, format="json")
        self.assertEqual(r.status_code, 201)

    def test_instructor_cannot_schedule_on_foreign_course(self):
        self.client.force_authenticate(self.instr2)
        r = self.client.post(LC, {
            "course": self.course.id, "title": "Sneak",
            "scheduled_start": timezone.now().isoformat()}, format="json")
        self.assertEqual(r.status_code, 403)

    # --- listing scope ------------------------------------------------------
    def test_student_sees_only_enrolled_course_classes(self):
        self._class()
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(LC).data["count"], 1)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(LC).data["count"], 0)

    # --- joining ------------------------------------------------------------
    def test_enrolled_student_joins_in_window_records_attendance(self):
        lc = self._class(start=timezone.now())
        self.client.force_authenticate(self.student)
        r = self.client.post(f"{LC}{lc.id}/join/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["provider"], "external")
        self.assertEqual(r.data["url"], "https://meet.example/abc")
        self.assertTrue(Attendance.objects.filter(
            live_class=lc, student=self.student).exists())

    def test_join_outside_window_rejected(self):
        lc = self._class(start=timezone.now() + timedelta(days=2))
        self.client.force_authenticate(self.student)
        r = self.client.post(f"{LC}{lc.id}/join/")
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.data["error"]["code"], "class_not_joinable")

    def test_non_enrolled_cannot_join(self):
        lc = self._class(start=timezone.now())
        self.client.force_authenticate(self.outsider)
        r = self.client.post(f"{LC}{lc.id}/join/")
        self.assertEqual(r.status_code, 404)  # not in their queryset

    def test_host_can_join_anytime(self):
        lc = self._class(start=timezone.now() + timedelta(days=5))
        self.client.force_authenticate(self.instr)
        r = self.client.post(f"{LC}{lc.id}/join/")
        self.assertEqual(r.status_code, 200)

    # --- attendance ---------------------------------------------------------
    def test_instructor_reads_attendance(self):
        lc = self._class(start=timezone.now())
        self.client.force_authenticate(self.student)
        self.client.post(f"{LC}{lc.id}/join/")
        self.client.force_authenticate(self.instr)
        r = self.client.get(f"{LC}{lc.id}/attendance/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["student"]["email"], "s@vaceup.ng")

    # --- LiveKit token ------------------------------------------------------
    @override_settings(LIVEKIT_API_KEY="devkey", LIVEKIT_API_SECRET="devsecret",
                       LIVEKIT_WS_URL="wss://lk.example")
    def test_livekit_join_mints_token(self):
        import jwt
        lc = self._class(start=timezone.now(), provider="livekit",
                         room_name="room-1")
        self.client.force_authenticate(self.student)
        r = self.client.post(f"{LC}{lc.id}/join/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["provider"], "livekit")
        self.assertEqual(r.data["ws_url"], "wss://lk.example")
        claims = jwt.decode(r.data["token"], "devsecret", algorithms=["HS256"])
        self.assertEqual(claims["video"]["room"], "room-1")
        self.assertTrue(claims["video"]["roomJoin"])
