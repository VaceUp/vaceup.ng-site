"""Tests for assignments and quizzes."""

import django
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.assignments.models import (
    Assignment,
    Submission,
    Quiz,
    Question,
    MCQChoice,
    Answer,
    QuizAttempt,
)
from apps.courses.models import Course, Category
from apps.enrollment.models import Enrollment


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class AssignmentTests(APITestCase):
    """Assignment creation, submission, and grading."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

        self.category = Category.objects.create(name="Test")

        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_active=True, is_staff=True)
        self.instr = User.objects.create_user(
            email="i1@vaceup.ng", password="x", full_name="Instructor",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s1@vaceup.ng", password="x", full_name="Student",
            role=User.Role.STUDENT, is_active=True)

        self.course = Course.objects.create(
            title="Test Course", category=self.category,
            instructor=self.instr, price=0, is_published=True)

        Enrollment.objects.create(student=self.student, course=self.course,
                                  status=Enrollment.Status.ACTIVE)

    def _create_assignment(self, title="Assignment 1", due_at=None):
        from datetime import timedelta
        from django.utils import timezone
        if due_at is None:
            due_at = timezone.now() + timedelta(days=7)
        return Assignment.objects.create(
            title=title, course=self.course,
            instructor=self.instr, due_at=due_at)

    # --- creation ---
    def test_instructor_creates_assignment(self):
        self.client.force_authenticate(self.instr)
        r = self.client.post("/api/v1/assignments/", {
            "title": "Essay 1", "course": self.course.id,
            "due_at": (django.utils.timezone.now() +
                       django.utils.timezone.timedelta(days=7)).isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["title"], "Essay 1")

    # --- submission ---
    def test_student_submits_assignment(self):
        assignment = self._create_assignment()
        self.client.force_authenticate(self.student)
        r = self.client.post("/api/v1/assignments/submit/", {
            "assignment": assignment.id,
        }, format="json")
        self.assertEqual(r.status_code, 200)
        submission = Submission.objects.get(student=self.student, assignment=assignment)
        self.assertEqual(submission.status, Submission.Status.SUBMITTED)
        submission = Submission.objects.get(student=self.student, assignment=assignment)
        self.assertEqual(submission.status, Submission.Status.SUBMITTED)

    def test_student_cannot_submit_twice_without_grade(self):
        """Re-submission updates the same row (idempotent)."""
        assignment = self._create_assignment()
        self.client.force_authenticate(self.student)
        # First submit
        r = self.client.post("/api/v1/assignments/submit/", {
            "assignment": assignment.id,
        }, format="json")
        self.assertEqual(r.status_code, 200)
        # Second submit - should update, not create new
        r = self.client.post("/api/v1/assignments/submit/", {
            "assignment": assignment.id,
        }, format="json")
        self.assertEqual(r.status_code, 200)  # 200 OK for re-submission
        count = Submission.objects.filter(
            student=self.student, assignment=assignment).count()
        self.assertEqual(count, 1)  # Still one row

    # --- grading ---
    def test_instructor_can_grade_submission(self):
        assignment = self._create_assignment()
        self.client.force_authenticate(self.student)
        self.client.post("/api/v1/assignments/submit/", {
            "assignment": assignment.id,
        }, format="json")
        # Instructor grades
        self.client.force_authenticate(self.instr)
        r = self.client.post("/api/v1/assignments/{}/grade/".format(assignment.id), {
            "submission_id": assignment.id,
            "score": 85.00,
            "feedback": "Good work!",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        submission = Submission.objects.get(id=r.data["id"])
        self.assertEqual(submission.score, 85.00)
        self.assertEqual(submission.feedback, "Good work!")
        self.assertEqual(submission.status, Submission.Status.GRADED)


@override_settings(SECURE_SSL_REDIRECT=False)
class QuizTests(APITestCase):
    """Quiz creation, question answering, and grading."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

        self.category = Category.objects.create(name="Test")

        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_active=True, is_staff=True)
        self.instr = User.objects.create_user(
            email="i1@vaceup.ng", password="x", full_name="Instructor",
            role=User.Role.INSTRUCTOR, is_active=True)
        self.student = User.objects.create_user(
            email="s1@vaceup.ng", password="x", full_name="Student",
            role=User.Role.STUDENT, is_active=True)

        self.course = Course.objects.create(
            title="Test Course", category=self.category,
            instructor=self.instr, price=0, is_published=True)

        Enrollment.objects.create(student=self.student, course=self.course,
                                  status=Enrollment.Status.ACTIVE)

    def _create_quiz(self, title="Quiz 1", pass_mark=50.0):
        return Quiz.objects.create(
            title=title, course=self.course,
            instructor=self.instr, pass_mark=pass_mark)

    def _add_mcq_question(self, quiz, order=0, question_text="What is Python?"):
        question = Question.objects.create(
            quiz=quiz, question_text=question_text,
            question_type=Question.Type.MCQ, order=order)
        MCQChoice.objects.create(question=question, choice_text="Snake",
                                 is_correct=MCQChoice.CorrectChoice.CORRECT, order=0)
        MCQChoice.objects.create(question=question, choice_text="Language",
                                 is_correct=MCQChoice.CorrectChoice.INCORRECT, order=1)
        return question

    # --- creation ---
    def test_instructor_creates_quiz(self):
        self.client.force_authenticate(self.instr)
        r = self.client.post("/api/v1/quizzes/", {
            "title": "Python Basics", "course": self.course.id,
            "pass_mark": 60.0, "time_limit_minutes": 30,
        }, format="json")
        self.assertEqual(r.status_code, 201)

    # --- questions ---
    def test_instructor_adds_mcq_question(self):
        quiz = self._create_quiz()
        self.client.force_authenticate(self.instr)
        r = self.client.post("/api/v1/quizzes/{}/questions/".format(quiz.id), {
            "question_text": "What is Python?", "question_type": "mcq",
        }, format="json")
        self.assertEqual(r.status_code, 201)

    def test_instructor_adds_true_false_question(self):
        quiz = self._create_quiz()
        self.client.force_authenticate(self.instr)
        r = self.client.post("/api/v1/quizzes/{}/questions/".format(quiz.id), {
            "question_text": "Python is a compiled language.", "question_type": "true_false",
        }, format="json")
        self.assertEqual(r.status_code, 201)

    def test_instructor_adds_short_answer_question(self):
        quiz = self._create_quiz()
        self.client.force_authenticate(self.instr)
        r = self.client.post("/api/v1/quizzes/{}/questions/".format(quiz.id), {
            "question_text": "Explain list comprehension in Python.",
            "question_type": "short_answer",
        }, format="json")
        self.assertEqual(r.status_code, 201)

    # --- answering ---
    def test_student_answers_mcq(self):
        quiz = self._create_quiz()
        self._add_mcq_question(quiz)
        self.client.force_authenticate(self.student)
        attempt = QuizAttempt.objects.create(
            student=self.student, quiz=quiz,
            status=QuizAttempt.Status.IN_PROGRESS)
        question = quiz.questions.first()
        from apps.assignments.models import Answer
        answer = Answer.objects.create(
            student=self.student, question=question,
            choice_id=1, is_correct=False)
        self.assertIsNotNone(answer.id)

    def test_student_answers_true_false(self):
        quiz = self._create_quiz()
        question = Question.objects.create(
            quiz=quiz, question_text="Python is a snake.",
            question_type=Question.Type.TRUE_FALSE, order=0)
        MCQChoice.objects.create(question=question, choice_text="True",
                                 is_correct=True, order=0)
        MCQChoice.objects.create(question=question, choice_text="False",
                                 is_correct=False, order=1)
        self.client.force_authenticate(self.student)
        attempt = QuizAttempt.objects.create(
            student=self.student, quiz=quiz,
            status=QuizAttempt.Status.IN_PROGRESS)
        answer = Answer.objects.create(
            student=self.student, question=question,
            choice_id=2, is_correct=False)
        self.assertIsNotNone(answer.id)

    # --- attempt grading ---
    def test_quiz_attempt_gets_graded(self):
        from apps.assignments.services import answer_submit, attempt_submit, attempt_grade
        from apps.assignments.models import MCQChoice
        quiz = self._create_quiz(pass_mark=70.0)
        self._add_mcq_question(quiz)
        self.client.force_authenticate(self.student)
        attempt = QuizAttempt.objects.create(
            student=self.student, quiz=quiz,
            status=QuizAttempt.Status.IN_PROGRESS)
        # Answer all questions correct
        for q in quiz.questions.all():
            # Get the correct choice (is_correct="correct")
            correct_choice = q.choices.filter(is_correct=MCQChoice.CorrectChoice.CORRECT).first()
            answer_submit(
                student=self.student, question=q,
                choice_id=correct_choice.id)
        attempt_submit(attempt=attempt, time_spent_seconds=30)
        attempt_grade(attempt=attempt, auto_grade=True)
        self.assertTrue(attempt.passed)
        self.assertIsNotNone(attempt.total_score)