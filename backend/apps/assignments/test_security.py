from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.assignments.models import Assignment, Submission, Quiz, Question, MCQChoice
from apps.courses.models import Category, Course
from apps.enrollment.models import Enrollment

User = get_user_model()


class AssessmentSecurityTests(APITestCase):
    def setUp(self):
        self.tutor = User.objects.create_user(email="t@example.org", password="x", full_name="Tutor", role="instructor", is_active=True)
        self.other = User.objects.create_user(email="o@example.org", password="x", full_name="Other tutor", role="instructor", is_active=True)
        self.student = User.objects.create_user(email="s@example.org", password="x", full_name="Learner", role="student", is_active=True)
        category = Category.objects.create(name="Skills")
        self.course = Course.objects.create(title="Own course", category=category, instructor=self.tutor, is_published=True)
        self.other_course = Course.objects.create(title="Other course", category=category, instructor=self.other, is_published=True)
        self.enrollment = Enrollment.objects.create(student=self.student, course=self.course)
        self.assignment = Assignment.objects.create(course=self.course, instructor=self.tutor, title="Essay", due_at=timezone.now() + timedelta(days=1))
        self.quiz = Quiz.objects.create(course=self.course, instructor=self.tutor, title="Quiz", status="published", pass_mark=50)
        self.questions = [Question.objects.create(quiz=self.quiz, question_text=f"Question {i}", order=i) for i in range(2)]
        self.choices = [MCQChoice.objects.create(question=q, choice_text="Correct option", is_correct="correct") for q in self.questions]

    def test_cross_assignment_grading_is_rejected(self):
        foreign = Assignment.objects.create(course=self.other_course, instructor=self.other, title="Foreign", due_at=self.assignment.due_at)
        submission = Submission.objects.create(assignment=foreign, student=self.student)
        self.client.force_authenticate(self.tutor)
        response = self.client.post(f"/api/v1/assignments/{self.assignment.pk}/grade/", {"submission_id": submission.pk, "score": 90}, format="json")
        self.assertEqual(response.status_code, 404)
        submission.refresh_from_db()
        self.assertIsNone(submission.score)

    def test_create_on_other_tutor_course_is_rejected(self):
        self.client.force_authenticate(self.tutor)
        response = self.client.post("/api/v1/assignments/", {"course": self.other_course.pk, "title": "Bad", "due_at": self.assignment.due_at.isoformat()}, format="json")
        self.assertEqual(response.status_code, 403)
        response = self.client.post("/api/v1/quizzes/", {"course": self.other_course.pk, "title": "Bad"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_student_lists_assessments_without_receiving_answers(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get("/api/v1/assignments/").status_code, 200)
        response = self.client.get(f"/api/v1/quizzes/{self.quiz.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("is_correct", str(response.data))
        response = self.client.get(f"/api/v1/questions/{self.questions[0].pk}/choices/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("is_correct", str(response.data))

    def test_unenrolled_student_cannot_fetch_question_choices(self):
        self.enrollment.status = "suspended"
        self.enrollment.save()
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(f"/api/v1/questions/{self.questions[0].pk}/choices/").status_code, 404)

    def test_quiz_start_submit_and_retry_are_idempotent(self):
        self.client.force_authenticate(self.student)
        start = self.client.post(f"/api/v1/quizzes/{self.quiz.pk}/start/")
        self.assertEqual(start.status_code, 200, start.data)
        self.assertEqual(self.client.post(f"/api/v1/quizzes/{self.quiz.pk}/start/").data["id"], start.data["id"])
        response = self.client.post(f"/api/v1/quizzes/{self.quiz.pk}/submit/", {"answers": [{"question_id": self.questions[0].pk, "choice_id": self.choices[0].pk}]}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Decimal(response.data["total_score"]), Decimal("50"))
        again = self.client.post(f"/api/v1/quizzes/{self.quiz.pk}/submit/", {"answers": []}, format="json")
        self.assertEqual(again.data["total_score"], response.data["total_score"])

    def test_foreign_choice_and_expired_attempt_are_rejected(self):
        self.client.force_authenticate(self.student)
        self.client.post(f"/api/v1/quizzes/{self.quiz.pk}/start/")
        response = self.client.post(f"/api/v1/quizzes/{self.quiz.pk}/submit/", {"answers": [{"question_id": self.questions[0].pk, "choice_id": self.choices[1].pk}]}, format="json")
        self.assertEqual(response.status_code, 400)
        self.quiz.attempts.update(started_at=timezone.now() - timedelta(hours=2))
        response = self.client.post(f"/api/v1/quizzes/{self.quiz.pk}/submit/", {"answers": []}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_student_cannot_supply_grade_or_overwrite_graded_work(self):
        self.client.force_authenticate(self.student)
        payload = {"assignment": self.assignment.pk, "text_answer": "Essay", "score": 100, "feedback": "Own grade"}
        response = self.client.post("/api/v1/submissions/", payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        submission = Submission.objects.get()
        self.assertIsNone(submission.score)
        self.assertEqual(submission.feedback, "")
        submission.score = 50
        submission.save()
        self.assertEqual(self.client.post("/api/v1/submissions/", payload, format="json").status_code, 400)

    def test_closed_deadline_and_suspension_block_submission(self):
        self.client.force_authenticate(self.student)
        payload = {"assignment": self.assignment.pk, "text_answer": "Essay"}
        self.enrollment.status = "suspended"
        self.enrollment.save()
        self.assertEqual(self.client.post("/api/v1/submissions/", payload, format="json").status_code, 403)
        self.enrollment.status = "active"
        self.enrollment.save()
        self.assignment.allow_late_submission = False
        self.assignment.due_at = timezone.now() - timedelta(hours=1)
        self.assignment.save()
        self.assertEqual(self.client.post("/api/v1/submissions/", payload, format="json").status_code, 400)
