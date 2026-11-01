"""End-to-end API contracts for the member assessment workspaces."""
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment
from .models import Assignment, Submission, Quiz, Question, Answer, AssessmentGradeLog
from .storage import AssignmentStorage


class AssessmentWorkflowTests(APITestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.users = {}
        for key, role in [('admin', 'admin'), ('tutor', 'instructor'), ('other', 'instructor'), ('student', 'student'), ('peer', 'student')]:
            self.users[key] = User.objects.create_user(email=f'{key}@example.test', password='test', full_name=key, role=role, is_active=True)
        self.course = Course.objects.create(title='Assessment course', instructor=self.users['tutor'], category=Category.objects.create(name='Skills'), is_published=True)
        for key in ['student', 'peer']:
            Enrollment.objects.create(student=self.users[key], course=self.course, status='active')
        self.quiz = Quiz.objects.create(title='Knowledge check', instructor=self.users['admin'], course=self.course)
        self.assignment = Assignment.objects.create(title='Project', instructor=self.users['admin'], course=self.course, due_at=timezone.now() + timedelta(days=1))
        self.base = f'/api/v1/quizzes/{self.quiz.pk}/'
        self.questions = [
            {'question_type': 'true_false', 'question_text': 'A draft is public.', 'choices': [
                {'choice_text': 'True', 'is_correct': 'incorrect'}, {'choice_text': 'False', 'is_correct': 'correct'}]},
            {'question_type': 'short_answer', 'question_text': 'Explain your reasoning.', 'choices': []},
        ]

    def as_user(self, key):
        self.client.force_authenticate(self.users[key])

    def publish(self):
        self.as_user('tutor')
        built = self.client.put(self.base + 'builder/', {'questions': self.questions}, format='json')
        self.assertEqual(built.status_code, 200, built.data)
        response = self.client.patch(self.base, {'status': 'published'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return list(self.quiz.questions.order_by('order'))

    def start(self):
        self.as_user('student')
        result = self.client.post(self.base + 'start/')
        self.assertEqual(result.status_code, 200, result.data)
        return result.data['id']

    def test_full_true_false_and_manual_grade_journey_with_retries(self):
        first, short = self.publish()
        attempt = self.start()
        choice = first.choices.get(is_correct='correct')
        payload = {'answers': [{'question_id': first.pk, 'choice_id': choice.pk}, {'question_id': short.pk, 'short_text': 'Only published quizzes are available.'}]}
        saved = self.client.put(self.base + 'save-answers/', payload, format='json')
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertIsNone(saved.data['answers'][0]['score_earned'])
        reloaded = self.client.get(self.base)
        self.assertNotIn('is_correct', str(reloaded.data))
        self.assertEqual(len(reloaded.data['questions'][0]['choices']), 2)
        self.assertEqual(len(reloaded.data['my_attempt']['answers']), 2)
        submitted = self.client.post(self.base + 'submit/', payload, format='json')
        self.assertEqual(submitted.data['status'], 'submitted')
        self.assertIsNone(submitted.data['total_score'])
        grade_url = f'/api/v1/quiz-attempts/{attempt}/grade/'
        grade = {'grades': [{'question_id': short.pk, 'score': '0.50'}]}
        self.assertEqual(self.client.post(grade_url, grade, format='json').status_code, 403)
        self.as_user('tutor')
        for _ in range(2):
            graded = self.client.post(grade_url, grade, format='json')
            self.assertEqual(graded.status_code, 200, graded.data)
            self.assertEqual(Decimal(graded.data['total_score']), Decimal('75'))
        self.assertEqual(AssessmentGradeLog.objects.count(), 1)
        self.as_user('student')
        retry = self.client.post(self.base + 'submit/', {'answers': []}, format='json')
        self.assertEqual(Decimal(retry.data['total_score']), Decimal('75'))
        self.assertEqual(self.quiz.attempts.count(), 1)
        self.assertEqual(Answer.objects.count(), 2)

    def test_draft_and_cross_course_role_boundaries(self):
        for key in ['student', 'peer', 'other']:
            self.as_user(key)
            self.assertEqual(self.client.get(self.base).status_code, 404)
            self.assertIn(self.client.put(self.base + 'builder/', {'questions': self.questions}, format='json').status_code, [403, 404])
        self.publish()
        attempt = self.start()
        for key in ['peer', 'other']:
            self.as_user(key)
            self.assertEqual(self.client.get(f'/api/v1/quiz-attempts/{attempt}/').status_code, 404)
        self.as_user('student')
        Enrollment.objects.filter(student=self.users['student']).update(status='suspended')
        self.assertEqual(self.client.get(self.base).status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/quiz-attempts/{attempt}/').status_code, 404)

    def test_invalid_builder_does_not_erase_existing_questions(self):
        self.as_user('tutor')
        self.client.put(self.base + 'builder/', {'questions': self.questions}, format='json')
        ids = list(self.quiz.questions.values_list('pk', flat=True))
        invalid = [{'question_text': 'Bad', 'question_type': 'mcq', 'choices': [{'choice_text': 'Only one', 'is_correct': 'correct'}]}]
        response = self.client.put(self.base + 'builder/', {'questions': invalid}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(list(self.quiz.questions.values_list('pk', flat=True)), ids)

    def test_cannot_publish_empty_or_edit_attempted_quiz(self):
        self.as_user('tutor')
        self.assertEqual(self.client.patch(self.base, {'status': 'published'}, format='json').status_code, 400)
        self.publish()
        self.start()
        self.as_user('tutor')
        self.assertEqual(self.client.patch(self.base, {'title': 'Changed'}, format='json').status_code, 400)
        self.assertEqual(self.client.put(self.base + 'builder/', {'questions': self.questions}, format='json').status_code, 400)

    def test_invalid_answer_batch_rolls_back_and_bounds_identifiers(self):
        first, short = self.publish()
        self.start()
        payload = {'answers': [{'question_id': short.pk, 'short_text': 'Should not persist'}, {'question_id': first.pk, 'choice_id': 999999}]}
        self.assertEqual(self.client.put(self.base + 'save-answers/', payload, format='json').status_code, 400)
        self.assertEqual(Answer.objects.count(), 0)
        payload['answers'][1]['question_id'] = 10 ** 30
        self.assertEqual(self.client.post(self.base + 'submit/', payload, format='json').status_code, 400)

    def test_expiry_finalizes_saved_answers_without_accepting_late_changes(self):
        first, short = self.publish()
        self.start()
        saved = {'answers': [{'question_id': short.pk, 'short_text': 'Saved on time'}]}
        self.client.put(self.base + 'save-answers/', saved, format='json')
        self.assertEqual(self.client.post(self.base + 'finish-expired/').status_code, 400)
        self.quiz.attempts.update(started_at=timezone.now() - timedelta(days=1))
        saved['answers'][0]['short_text'] = 'Too late'
        self.assertEqual(self.client.put(self.base + 'save-answers/', saved, format='json').status_code, 400)
        response = self.client.post(self.base + 'finish-expired/', saved, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'submitted')
        self.assertEqual(Answer.objects.get().short_text, 'Saved on time')

    def test_invalid_manual_grade_batch_rolls_back(self):
        first, short = self.publish()
        attempt = self.start()
        self.client.post(self.base + 'submit/', {'answers': []}, format='json')
        self.as_user('tutor')
        response = self.client.post(f'/api/v1/quiz-attempts/{attempt}/grade/', {'grades': [{'question_id': short.pk, 'score': 1}, {'question_id': first.pk, 'score': 1}]}, format='json')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Answer.objects.count(), 0)
        self.assertEqual(AssessmentGradeLog.objects.count(), 0)

    def test_assignment_grade_is_audited_and_student_sees_feedback(self):
        self.as_user('student')
        payload = {'assignment': self.assignment.pk, 'text_answer': 'Project answer'}
        for _ in range(2):
            submitted = self.client.post('/api/v1/assignments/submit/', payload, format='json')
            self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(Submission.objects.count(), 1)
        self.as_user('tutor')
        self.assertEqual(self.client.get(f'/api/v1/assignments/{self.assignment.pk}/submissions/').data['count'], 1)
        grade = {'submission_id': submitted.data['id'], 'score': '80.00', 'feedback': 'Clear explanation.'}
        for _ in range(2):
            result = self.client.post(f'/api/v1/assignments/{self.assignment.pk}/grade/', grade, format='json')
            self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(AssessmentGradeLog.objects.count(), 1)
        self.as_user('student')
        result = self.client.get(f'/api/v1/submissions/{submitted.data["id"]}/')
        self.assertEqual(result.data['feedback'], 'Clear explanation.')
        self.assertEqual(self.client.post('/api/v1/submissions/', payload, format='json').status_code, 400)

    def test_private_attachment_download_is_scoped_and_not_a_media_url(self):
        with TemporaryDirectory() as folder, override_settings(BASE_DIR=Path(folder)):
            storage = AssignmentStorage()
            with patch.object(Submission._meta.get_field('file'), 'storage', storage):
                self.as_user('student')
                response = self.client.post('/api/v1/submissions/', {'assignment': self.assignment.pk, 'file': SimpleUploadedFile('answer.txt', b'Private learner work')}, format='multipart')
                self.assertEqual(response.status_code, 200, response.data)
                path = response.data['file']
                self.assertTrue(path.endswith('/download/'))
                self.assertTrue(Path(Submission.objects.get().file.path).is_relative_to(Path(folder) / 'private_uploads'))
                with self.assertRaises(ValueError):
                    _ = Submission.objects.get().file.url
                for key in ['student', 'tutor', 'admin']:
                    self.as_user(key)
                    download = self.client.get(path)
                    self.assertEqual(download.status_code, 200, getattr(download, "content", b""))
                    # Consuming the stream closes the response. Closing it again fires
                    # request_finished a second time, after the client has restored
                    # close_old_connections, which drops the MySQL connection inside
                    # this test's atomic block.
                    self.assertEqual(b''.join(download.streaming_content), b'Private learner work')
                    self.assertIn('no-store', download['Cache-Control'])
                for key in ['peer', 'other']:
                    self.as_user(key)
                    self.assertEqual(self.client.get(path).status_code, 404)
                self.as_user('student')
                Enrollment.objects.filter(student=self.users['student']).update(status='suspended')
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_disguised_or_executable_attachments_are_rejected(self):
        self.as_user('student')
        for name, body in [('script.html', b'<script>alert(1)</script>'), ('fake.png', b'not an image'), ('fake.pdf', b'not a pdf'), ('bad.txt', b'\xff\x00'), ('fake.docx', b'not a zip')]:
            with self.subTest(name=name):
                response = self.client.post('/api/v1/submissions/', {'assignment': self.assignment.pk, 'file': SimpleUploadedFile(name, body)}, format='multipart')
                self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Submission.objects.count(), 0)
