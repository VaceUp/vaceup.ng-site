"""Locked assessment mutations shared by the learner and teaching workspaces."""
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Answer, AssessmentGradeLog, MCQChoice, Question, Quiz, QuizAttempt


def teaching_access(user, course):
    if not (user.is_admin or (user.is_instructor and course.instructor_id == user.pk)):
        raise PermissionDenied("You may only manage assessments for your assigned courses.")


def validate_questions(rows):
    if not rows:
        raise ValidationError("Add at least one question before publishing.")
    for row in rows:
        choices = row["choices"]
        kind = row["question_type"]
        if kind == Question.Type.SHORT_ANSWER:
            if choices:
                raise ValidationError("Short-answer questions cannot have choices.")
        else:
            if len(choices) < 2 or len(choices) > 8:
                raise ValidationError("Choice questions need 2 to 8 options.")
            if kind == Question.Type.TRUE_FALSE and len(choices) != 2:
                raise ValidationError("True/false questions need exactly 2 options.")
            if sum(c["is_correct"] == "correct" for c in choices) != 1:
                raise ValidationError("Choose exactly one correct option for each choice question.")
            if len({c["choice_text"].strip().casefold() for c in choices}) != len(choices):
                raise ValidationError("Each choice must have different text.")


def ensure_publishable(quiz):
    validate_questions([{"question_type": q.question_type, "choices": list(q.choices.values("choice_text", "is_correct"))}
                        for q in quiz.questions.prefetch_related("choices")])


@transaction.atomic
def replace_questions(quiz, user, rows):
    quiz = Quiz.objects.select_for_update().select_related("course").get(pk=quiz.pk)
    teaching_access(user, quiz.course)
    if quiz.status != Quiz.Status.DRAFT or quiz.attempts.exists():
        raise ValidationError("Only unused draft quizzes can have their questions changed.")
    validate_questions(rows)
    quiz.questions.all().delete()
    for index, row in enumerate(rows):
        question = Question.objects.create(quiz=quiz, order=index, question_text=row["question_text"], question_type=row["question_type"])
        MCQChoice.objects.bulk_create([MCQChoice(question=question, order=i, **choice) for i, choice in enumerate(row["choices"])])
    return quiz


def save_answers(attempt, rows):
    """Caller holds the attempt lock. Validate all rows before persisting any."""
    questions = {q.pk: q for q in attempt.quiz.questions.prefetch_related("choices")}
    seen = set()
    for row in rows:
        question = questions.get(row["question_id"])
        if question is None or question.pk in seen:
            raise ValidationError("Each answer must identify a different question in this quiz.")
        seen.add(question.pk)
        if question.question_type == Question.Type.SHORT_ANSWER:
            if row.get("choice_id") is not None:
                raise ValidationError("Use a text answer for this question.")
        else:
            if row.get("short_text"):
                raise ValidationError("Choose an option for this question.")
            if row.get("choice_id") is not None and not any(c.pk == row["choice_id"] for c in question.choices.all()):
                raise ValidationError("That choice does not belong to this question.")
    for row in rows:
        question = questions[row["question_id"]]
        choice = next((c for c in question.choices.all() if c.pk == row.get("choice_id")), None)
        Answer.objects.update_or_create(student=attempt.student, question=question, defaults={
            "choice": choice, "short_text": row.get("short_text", ""),
            "is_correct": None if question.question_type == Question.Type.SHORT_ANSWER else bool(choice and choice.is_correct == "correct"),
            "score_earned": None if question.question_type == Question.Type.SHORT_ANSWER else Decimal(int(bool(choice and choice.is_correct == "correct"))),
        })


def calculate_grade(attempt):
    questions = list(attempt.quiz.questions.all())
    answers = {a.question_id: a for a in Answer.objects.filter(student=attempt.student, question__quiz=attempt.quiz)}
    # Create unanswered short responses for marking as well; no invented final grade.
    pending = any(q.question_type == Question.Type.SHORT_ANSWER and
                  (q.pk not in answers or answers[q.pk].score_earned is None) for q in questions)
    attempt.status = QuizAttempt.Status.SUBMITTED if pending else QuizAttempt.Status.GRADED
    earned = sum((a.score_earned if a.score_earned is not None else Decimal(int(bool(a.is_correct)))) for a in answers.values())
    attempt.total_score = None if pending else (earned * 100 / len(questions)).quantize(Decimal("0.01")) if questions else Decimal("0.00")
    attempt.passed = not pending and attempt.total_score >= attempt.quiz.pass_mark
    attempt.save(update_fields=["status", "total_score", "passed", "updated_at"])
    return attempt


@transaction.atomic
def mark_short_answers(attempt, user, grades):
    attempt = QuizAttempt.objects.select_for_update().select_related("quiz__course", "student").get(pk=attempt.pk)
    teaching_access(user, attempt.quiz.course)
    if attempt.status == QuizAttempt.Status.IN_PROGRESS:
        raise ValidationError("The learner must submit the attempt before grading.")
    before = {str(a.question_id): str(a.score_earned) if a.score_earned is not None else None
              for a in Answer.objects.filter(student=attempt.student, question__quiz=attempt.quiz)}
    seen = set()
    for grade in grades:
        question = get_object_or_404(attempt.quiz.questions, pk=grade["question_id"], question_type=Question.Type.SHORT_ANSWER)
        if question.pk in seen:
            raise ValidationError("Grade each question only once.")
        seen.add(question.pk)
        Answer.objects.update_or_create(student=attempt.student, question=question, defaults={
            "score_earned": grade["score"], "is_correct": grade["score"] == Decimal("1")})
    calculate_grade(attempt)
    after = {str(a.question_id): str(a.score_earned) if a.score_earned is not None else None
             for a in Answer.objects.filter(student=attempt.student, question__quiz=attempt.quiz)}
    if before != after:
        AssessmentGradeLog.objects.create(actor=user, attempt=attempt, before=before, after=after)
    return attempt
