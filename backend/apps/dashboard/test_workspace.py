from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course, Module, Lesson
from apps.enrollment.models import Enrollment, LessonProgress
from apps.liveclasses.models import LiveClass, Attendance
from apps.payments.models import Payment


class WorkspaceTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.student = User.objects.create_user(email="learner@example.test", full_name="Test Learner", password="test-only", role="student", is_active=True)
        cls.other = User.objects.create_user(email="other@example.test", full_name="Other Learner", password="test-only", role="student", is_active=True)
        cls.tutor = User.objects.create_user(email="tutor@example.test", full_name="Test Tutor", password="test-only", role="instructor", is_active=True)
        cls.other_tutor = User.objects.create_user(email="teacher@example.test", full_name="Other Tutor", password="test-only", role="instructor", is_active=True)
        category = Category.objects.create(name="Data", slug="data")
        cls.course = Course.objects.create(title="Data foundations", slug="data-foundations", category=category, instructor=cls.tutor, is_published=True)
        cls.draft = Course.objects.create(title="Draft course", slug="draft-course", category=category, instructor=cls.tutor)
        cls.foreign = Course.objects.create(title="Other course", slug="other-course", category=category, instructor=cls.other_tutor, is_published=True)
        module = Module.objects.create(course=cls.course, title="Getting started", order=1)
        cls.lesson = Lesson.objects.create(module=module, title="First lesson", content="Private lesson material", duration_seconds=600, order=1)
        cls.enrollment = Enrollment.objects.create(student=cls.student, course=cls.course)
        Enrollment.objects.create(student=cls.other, course=cls.foreign)
        cls.session = LiveClass.objects.create(course=cls.course, title="Workshop", scheduled_start=timezone.now(), join_url="https://meet.google.com/test-room")
        LiveClass.objects.create(course=cls.foreign, title="Other workshop", scheduled_start=timezone.now() + timedelta(hours=2))

    def setUp(self):
        cache.clear()
        self.client.force_authenticate(self.student)

    def test_authentication_required(self):
        self.client.force_authenticate(None)
        for path in ("overview/", "courses/", f"courses/{self.course.pk}/", "payments/"):
            self.assertEqual(self.client.get(f"/api/v1/dashboard/{path}").status_code, 401)

    def test_private_responses_are_not_shared_cacheable(self):
        for path in ("overview/", "courses/", f"courses/{self.course.pk}/", "payments/"):
            response = self.client.get(f"/api/v1/dashboard/{path}")
            self.assertIn('private', response['Cache-Control'])
            self.assertIn('no-store', response['Cache-Control'])

    def test_student_overview_real_counts(self):
        LessonProgress.objects.create(enrollment=self.enrollment, lesson=self.lesson, completed=True)
        result = self.client.get('/api/v1/dashboard/overview/')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['counts']['courses'], 1)
        self.assertEqual(result.data['counts']['lessons_completed'], 1)
        self.assertEqual(result.data['counts']['completed_lesson_seconds'], 600)
        self.assertEqual([row['id'] for row in result.data['recent_courses']], [self.course.pk])
        self.assertNotIn('Other workshop', str(result.data))

    def test_empty_account_is_zero_not_demo(self):
        Enrollment.objects.filter(student=self.other).delete()
        self.client.force_authenticate(self.other)
        result = self.client.get('/api/v1/dashboard/overview/').data
        self.assertTrue(all(value == 0 for value in result['counts'].values()))
        self.assertEqual(result['recent_courses'], [])

    def test_course_detail_scoped_and_content_unlocked(self):
        response = self.client.get(f'/api/v1/dashboard/courses/{self.course.pk}/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['course']['modules'][0]['lessons'][0]['content'], 'Private lesson material')
        self.assertEqual(self.client.get(f'/api/v1/dashboard/courses/{self.foreign.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/dashboard/courses/{self.draft.pk}/').status_code, 404)

    def test_suspended_listed_but_cannot_open_or_join(self):
        self.enrollment.status = 'suspended'
        self.enrollment.save()
        listing = self.client.get('/api/v1/dashboard/courses/').data
        self.assertEqual(listing['results'][0]['enrollment_status'], 'suspended')
        self.assertEqual(self.client.get(f'/api/v1/dashboard/courses/{self.course.pk}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/v1/live-classes/{self.session.pk}/join/').status_code, 404)

    def test_tutor_drafts_and_roster_are_scoped(self):
        self.client.force_authenticate(self.tutor)
        data = self.client.get('/api/v1/dashboard/courses/').data
        self.assertEqual({row['id'] for row in data['results']}, {self.course.pk, self.draft.pk})
        self.assertEqual(self.client.get(f'/api/v1/dashboard/courses/{self.draft.pk}/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/v1/dashboard/courses/{self.foreign.pk}/').status_code, 404)
        roster = self.client.get('/api/v1/instructor/students/').data
        self.assertEqual([row['student_id'] for row in roster['results']], [self.student.pk])

    def test_payments_are_private_and_exclude_gateway_details(self):
        Payment.objects.create(student=self.student, course=self.course, amount='12500', gateway_response={'private': 'value'})
        Payment.objects.create(student=self.other, course=self.foreign, amount='9000')
        response = self.client.get('/api/v1/dashboard/payments/')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['amount'], '12500.00')
        self.assertNotIn('gateway_response', response.data['results'][0])

    def test_students_cannot_schedule_or_read_roster(self):
        self.assertEqual(self.client.get('/api/v1/instructor/students/').status_code, 403)
        self.assertEqual(self.client.post('/api/v1/live-classes/', {}).status_code, 403)

    def test_tutor_cannot_schedule_another_tutors_course(self):
        self.client.force_authenticate(self.tutor)
        response = self.client.post('/api/v1/live-classes/', {'course': self.foreign.pk, 'title': 'Invalid', 'scheduled_start': (timezone.now() + timedelta(hours=1)).isoformat(), 'duration_minutes': 60, 'provider': 'external', 'join_url': 'https://meet.google.com/test'})
        self.assertEqual(response.status_code, 403)

    def test_join_and_completion_are_idempotent(self):
        for _ in range(2):
            self.assertEqual(self.client.post(f'/api/v1/live-classes/{self.session.pk}/join/').status_code, 200)
            response = self.client.post('/api/v1/enrollments/complete-lesson/', {'lesson': self.lesson.pk})
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Attendance.objects.filter(student=self.student, live_class=self.session).count(), 1)
        self.assertEqual(LessonProgress.objects.filter(enrollment=self.enrollment, lesson=self.lesson).count(), 1)
        detail = self.client.get(f'/api/v1/dashboard/courses/{self.course.pk}/').data
        self.assertEqual(detail['completed_lesson_ids'], [self.lesson.pk])

    def test_course_search_pagination_and_constant_queries(self):
        with CaptureQueriesContext(connection) as one:
            self.client.get('/api/v1/dashboard/courses/')
        for number in range(24):
            course = Course.objects.create(title=f'Extra {number}', slug=f'extra-{number}', category=self.course.category, instructor=self.tutor)
            Enrollment.objects.create(student=self.student, course=course)
        with CaptureQueriesContext(connection) as many:
            response = self.client.get('/api/v1/dashboard/courses/')
        self.assertEqual(len(many), len(one))
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 20)
        self.assertEqual(len(self.client.get('/api/v1/dashboard/courses/?page=2').data['results']), 5)
        self.assertEqual(self.client.get('/api/v1/dashboard/courses/?search=foundations').data['count'], 1)
