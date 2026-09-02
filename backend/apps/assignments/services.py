"""Services for assignments and quizzes — business logic, kept thin so
views stay trivial and tests can patch this layer."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.assignments.models import (
    Assignment,
    Submission,
    Quiz,
    Question,
    MCQChoice,
    Answer,
    QuizAttempt,
)
from apps.courses.models import Course
from apps.enrollment.models import Enrollment


def assignment_create(*, instructor, course, title, description, due_at,
                      max_score=100.00, allow_late=True):
    """Instructor creates an assignment for one of their courses."""
    # Ownership check
    if course.instructor_id != instructor.id:
        raise ValidationError("Only the course instructor may create assignments.")
    assignment = Assignment.objects.create(
        instructor=instructor,
        course=course,
        title=title,
        description=description,
        due_at=due_at,
        max_score=max_score,
        allow_late_submission=allow_late,
    )
    return assignment


def submission_create(*, student, assignment, file=None, text_answer=None):
    """A student submits an assignment (idempotent — re‑submission updates row)."""
    # Enrollment check
    Enrollment.objects.get(student=student, course=assignment.course)
    # If already submitted, we update in place (idempotent)
    submission, created = Submission.objects.get_or_create(
        student=student,
        assignment=assignment,
        defaults={
            "file": file,
            "text_answer": text_answer or "",
            "submitted_at": timezone.now(),
        },
    )
    if not created:
        # Update existing submission
        if file is not None:
            submission.file = file
        if text_answer is not None:
            submission.text_answer = text_answer
        submission.status = Submission.Status.SUBMITTED
        submission.submitted_at = timezone.now()
        submission.save(
            update_fields=["file", "text_answer", "status", "submitted_at"]
        )
    else:
        # New submission - set status to SUBMITTED
        submission.status = Submission.Status.SUBMITTED
        submission.submitted_at = timezone.now()
        submission.save(
            update_fields=["status", "submitted_at"]
        )
    return submission


def submission_grade(*, submission, score, feedback="", marked_late=False):
    """Instructor grades a submission."""
    submission.score = score
    submission.feedback = feedback
    if marked_late:
        submission.status = Submission.Status.LATE
    else:
        submission.status = Submission.Status.GRADED
    submission.save(
        update_fields=["score", "feedback", "status", "updated_at"]
    )
    return submission


def quiz_create(*, instructor, course, title, description,
                pass_mark=50.00, time_limit_minutes=60, status="draft"):
    """Instructor creates a quiz for one of their courses."""
    if course.instructor_id != instructor.id:
        raise ValidationError("Only the course instructor may create quizzes.")
    quiz = Quiz.objects.create(
        instructor=instructor,
        course=course,
        title=title,
        description=description,
        pass_mark=pass_mark,
        time_limit_minutes=time_limit_minutes,
        status=status,
    )
    return quiz


def question_create(*, quiz, question_text, question_type, order=None):
    """Add a question to a quiz."""
    if order is None:
        order = quiz.questions.count()
    question = Question.objects.create(
        quiz=quiz,
        question_text=question_text,
        question_type=question_type,
        order=order,
    )
    return question


def mcq_choice_create(*, question, choice_text, is_correct, order=None):
    """Add an MCQ choice to a question."""
    if order is None:
        order = question.choices.count()
    choice = MCQChoice.objects.create(
        question=question,
        choice_text=choice_text,
        is_correct=is_correct,
        order=order,
    )
    return choice


def answer_submit(*, student, question, choice_id=None, short_text=None):
    """A student submits an answer for a question (idempotent)."""
    # Validate student is enrolled in the quiz's course
    course = question.quiz.course
    Enrollment.objects.get(student=student, course=course)

    # Determine if answer is correct
    is_correct = False
    if choice_id is not None:
        from apps.assignments.models import MCQChoice
        choice = MCQChoice.objects.filter(id=choice_id, question=question).first()
        if choice:
            is_correct = choice.is_correct == MCQChoice.CorrectChoice.CORRECT

    # Upsert the answer
    answer, created = Answer.objects.get_or_create(
        student=student,
        question=question,
        defaults={
            "choice_id": choice_id,
            "short_text": short_text,
            "is_correct": is_correct,
        },
    )
    if not created:
        if choice_id is not None:
            answer.choice_id = choice_id
        if short_text is not None:
            answer.short_text = short_text
        answer.is_correct = is_correct
        answer.save(
            update_fields=["choice_id", "short_text", "is_correct", "updated_at"]
        )
    return answer


def attempt_create(*, student, quiz):
    """Start a new quiz attempt (idempotent — re‑uses existing if not completed)."""
    attempt, created = QuizAttempt.objects.get_or_create(
        student=student,
        quiz=quiz,
        defaults={
            "status": QuizAttempt.Status.IN_PROGRESS,
            "started_at": timezone.now(),
        },
    )
    if not created and attempt.status == QuizAttempt.Status.GRADED:
        # Already graded, cannot restart
        raise ValidationError("This quiz has already been graded.")
    return attempt


def attempt_submit(*, attempt, time_spent_seconds=None):
    """Mark a quiz attempt as submitted (within time limit)."""
    from django.utils import timezone
    attempt.status = QuizAttempt.Status.SUBMITTED
    attempt.completed_at = timezone.now()
    if time_spent_seconds is not None:
        attempt.time_spent_seconds = time_spent_seconds
    attempt.save(
        update_fields=["status", "completed_at", "time_spent_seconds", "updated_at"]
    )
    return attempt


def attempt_grade(*, attempt, auto_grade=False):
    """Grade a quiz attempt. If auto_grade, compute score from answers."""
    from decimal import Decimal
    attempt.status = QuizAttempt.Status.GRADED
    attempt.save(update_fields=["status", "updated_at"])

    # Re-compute score from answers
    total_possible = Decimal("0.00")
    total_earned = Decimal("0.00")

    for answer in Answer.objects.filter(
        student=attempt.student,
        question__quiz=attempt.quiz
    ).select_related("question", "choice"):
        if answer.question.question_type == Question.Type.MCQ:
            if answer.is_correct:
                total_possible += Decimal("1.00")
                total_earned += Decimal("1.00")
            else:
                total_possible += Decimal("1.00")
        elif answer.question.question_type == Question.Type.TRUE_FALSE:
            total_possible += Decimal("1.00")
            if answer.is_correct:
                total_earned += Decimal("1.00")
        elif answer.question.question_type == Question.Type.SHORT_ANSWER:
            total_possible += Decimal("1.00")

    attempt.total_score = (total_earned / total_possible * Decimal(str(
        attempt.quiz.pass_mark))) if total_possible > 0 else Decimal("0.00")
    attempt.passed = attempt.total_score >= Decimal(str(attempt.quiz.pass_mark))
    attempt.save(
        update_fields=["total_score", "passed", "updated_at"]
    )
    return attempt