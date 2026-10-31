from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.applications.models import Application
from apps.assignments.models import Assignment, Quiz, QuizAttempt, Submission
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

    def test_approved_application_awaits_payment_until_enrolled(self):
        paid = Course.objects.create(
            title="Paid track", slug="paid-track", category=self.course.category,
            instructor=self.tutor, is_published=True, price="25000.00",
        )
        application = Application.objects.create(
            student=self.student, course=paid, status=Application.Status.APPROVED,
            reviewed_at=timezone.now(),
        )
        overview = self.client.get('/api/v1/dashboard/overview/').data
        self.assertEqual(
            [row['course'] for row in overview['approved_applications']], [paid.pk],
        )
        self.assertEqual(overview['approved_applications'][0]['price'], '25000.00')
        self.assertIn('payment', {row['kind'] for row in overview['tasks']})
        listing = self.client.get('/api/v1/dashboard/applications/').data
        self.assertEqual([row['id'] for row in listing['results']], [application.pk])

        Enrollment.objects.create(student=self.student, course=paid)
        self.assertEqual(
            self.client.get('/api/v1/dashboard/applications/').data['results'], [],
        )
        overview = self.client.get('/api/v1/dashboard/overview/').data
        self.assertEqual(overview['approved_applications'], [])

    def test_approved_applications_are_account_scoped(self):
        application = Application.objects.create(
            student=self.other, course=self.course, status=Application.Status.APPROVED,
        )
        self.assertEqual(
            self.client.get('/api/v1/dashboard/applications/').data['results'], [],
        )
        self.client.force_authenticate(self.other)
        self.assertEqual(
            [row['id'] for row in self.client.get('/api/v1/dashboard/applications/').data['results']],
            [application.pk],
        )

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

    def test_student_agenda_and_tasks_are_account_scoped(self):
        now = timezone.now()
        mine = Assignment.objects.create(
            course=self.course, instructor=self.tutor, title="Essay",
            due_at=now + timedelta(days=2))
        foreign = Assignment.objects.create(
            course=self.foreign, instructor=self.other_tutor, title="Foreign essay",
            due_at=now + timedelta(days=2))
        quiz = Quiz.objects.create(
            course=self.course, instructor=self.tutor, title="Checkpoint",
            status=Quiz.Status.PUBLISHED)
        foreign_quiz = Quiz.objects.create(
            course=self.foreign, instructor=self.other_tutor, title="Foreign checkpoint",
            status=Quiz.Status.PUBLISHED)
        data = self.client.get('/api/v1/dashboard/overview/').data
        agenda = {(row['kind'], row['id']) for row in data['agenda']}
        self.assertIn(('assignment', mine.pk), agenda)
        self.assertIn(('quiz', quiz.pk), agenda)
        self.assertNotIn(('assignment', foreign.pk), agenda)
        self.assertNotIn(('quiz', foreign_quiz.pk), agenda)
        tasks = {row['kind']: row['count'] for row in data['tasks']}
        self.assertEqual(tasks['assignments'], 1)
        self.assertEqual(tasks['quizzes'], 1)
        self.assertEqual(tasks['lessons'], 1)
        Submission.objects.create(
            student=self.student, assignment=mine, status=Submission.Status.SUBMITTED,
            submitted_at=now)
        data = self.client.get('/api/v1/dashboard/overview/').data
        tasks = {row['kind']: row['count'] for row in data['tasks']}
        self.assertEqual(tasks['assignments'], 0)

    def test_tutor_agenda_surfaces_work_awaiting_grading(self):
        assignment = Assignment.objects.create(
            course=self.course, instructor=self.tutor, title="Project",
            due_at=timezone.now() - timedelta(days=1))
        Submission.objects.create(
            student=self.student, assignment=assignment,
            status=Submission.Status.SUBMITTED, submitted_at=timezone.now())
        self.client.force_authenticate(self.tutor)
        data = self.client.get('/api/v1/dashboard/overview/').data
        row = next(item for item in data['agenda']
                   if item['kind'] == 'assignment' and item['id'] == assignment.pk)
        self.assertEqual(row['state'], 'overdue')
        self.assertIn('1 submission', row['detail'])
        tasks = {item['kind']: item['count'] for item in data['tasks']}
        self.assertEqual(tasks['grading'], 1)

    def test_agenda_skips_classes_whose_window_closed(self):
        stale = LiveClass.objects.create(
            course=self.course, title="Stale workshop",
            scheduled_start=timezone.now() - timedelta(hours=3), duration_minutes=30)
        data = self.client.get('/api/v1/dashboard/overview/').data
        agenda = {(row['kind'], row['id']) for row in data['agenda']}
        self.assertNotIn(('class', stale.pk), agenda)

    def test_gradebook_is_scoped_and_normalises_scores(self):
        assignment = Assignment.objects.create(
            course=self.course, instructor=self.tutor, title="Midterm",
            due_at=timezone.now(), max_score=50)
        Submission.objects.create(
            student=self.student, assignment=assignment,
            status=Submission.Status.GRADED, score=40, submitted_at=timezone.now())
        quiz = Quiz.objects.create(
            course=self.course, instructor=self.tutor, title="Unit quiz",
            status=Quiz.Status.PUBLISHED)
        QuizAttempt.objects.create(
            student=self.student, quiz=quiz, status=QuizAttempt.Status.GRADED,
            total_score=80, passed=True)
        self.client.force_authenticate(self.tutor)
        response = self.client.get(
            f'/api/v1/instructor/courses/{self.course.pk}/gradebook/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['summary']['students'], 1)
        student = response.data['students'][0]
        self.assertEqual(student['assignments'][str(assignment.pk)]['percent'], 80.0)
        self.assertEqual(student['quizzes'][str(quiz.pk)]['percent'], 80.0)
        self.assertEqual(student['average_percent'], 80.0)
        self.assertEqual(response.data['summary']['average_grade'], 80.0)
        self.client.force_authenticate(self.other_tutor)
        self.assertEqual(self.client.get(
            f'/api/v1/instructor/courses/{self.course.pk}/gradebook/').status_code, 404)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(
            f'/api/v1/instructor/courses/{self.course.pk}/gradebook/').status_code, 403)

    def test_my_attendance_reflects_recorded_join(self):
        path = f'/api/v1/live-classes/{self.session.pk}/my-attendance/'
        self.assertFalse(self.client.get(path).data['attended'])
        self.client.post(f'/api/v1/live-classes/{self.session.pk}/join/')
        result = self.client.get(path).data
        self.assertTrue(result['attended'])
        self.assertIsNotNone(result['joined_at'])

    @override_settings(
        AWS_ACCESS_KEY_ID="test-key", AWS_SECRET_ACCESS_KEY="test-secret",
        AWS_STORAGE_BUCKET_NAME="test-bucket", AWS_S3_ENDPOINT_URL="https://storage.example.test",
        AWS_S3_REGION_NAME="auto")
    def test_recording_url_requires_attendance_and_ready_state(self):
        self.session.recording_key = "recordings/workshop.mp4"
        self.session.recording_status = "ready"
        self.session.save(update_fields=["recording_key", "recording_status"])
        path = f'/api/v1/live-classes/{self.session.pk}/recording-url/'
        self.assertEqual(self.client.get(path).status_code, 403)
        self.client.post(f'/api/v1/live-classes/{self.session.pk}/join/')
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("workshop.mp4", response.data['url'])
        self.assertEqual(response.data['expires_in'], 3600)

    def test_course_search_pagination_and_constant_queries(self):
        # Warm the shared throttle bucket: first-use INSERT/savepoint queries
        # are independent of the number of courses being measured here.
        self.client.get('/api/v1/dashboard/courses/')
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
