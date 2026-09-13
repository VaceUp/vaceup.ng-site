"""Services for assignments and quizzes — business logic, kept thin so
views stay trivial and tests can patch this layer."""

from rest_framework.exceptions import ValidationError, PermissionDenied
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


def require_enrollment(student, course):
    if not student.is_student or not Enrollment.objects.filter(
        student=student, course=course,
        status__in=[Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED],
    ).exists():
        raise PermissionDenied("An active enrollment is required for this assessment.")


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


@transaction.atomic
def submission_create(*, student, assignment, file=None, text_answer=None):
    """A student submits an assignment (idempotent — re‑submission updates row)."""
    # Enrollment check
    require_enrollment(student, assignment.course)
    assignment = Assignment.objects.select_for_update().get(pk=assignment.pk)
    late = timezone.now() > assignment.due_at
    if late and not assignment.allow_late_submission:
        raise ValidationError("This assignment no longer accepts submissions.")
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
        if submission.score is not None:
            raise ValidationError("A graded submission cannot be overwritten. Contact your tutor.")
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
    submission.is_late = late
    submission.save(update_fields=["is_late", "updated_at"])
    return submission


@transaction.atomic
def submission_grade(*, submission, grader, score, feedback="", marked_late=False):
    """Instructor grades a submission."""
    Assignment.objects.select_for_update().get(pk=submission.assignment_id)
    submission = Submission.objects.select_for_update().select_related("assignment__course").get(pk=submission.pk)
    if not grader.is_admin and submission.assignment.course.instructor_id != grader.pk:
        raise PermissionDenied("You may only grade submissions for your own courses.")
    if score < 0 or score > submission.assignment.max_score:
        raise ValidationError("Score must be between zero and the assignment maximum.")
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
    require_enrollment(student, course)

    # Determine if answer is correct
    is_correct = False
    if choice_id is not None:
        from apps.assignments.models import MCQChoice
        choice = MCQChoice.objects.filter(id=choice_id, question=question).first()
        if not choice:
            raise ValidationError("That choice does not belong to this question.")
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
    require_enrollment(student, quiz.course)
    if quiz.status != Quiz.Status.PUBLISHED:
        raise PermissionDenied("This quiz is not published.")
    if not quiz.questions.exists():
        raise ValidationError("This quiz has no questions yet.")
    attempt, created = QuizAttempt.objects.get_or_create(
        student=student,
        quiz=quiz,
        defaults={
            "status": QuizAttempt.Status.IN_PROGRESS,
            "started_at": timezone.now(),
        },
    )
    return attempt


def check_attempt_deadline(attempt):
    if (timezone.now() - attempt.started_at).total_seconds() > attempt.quiz.time_limit_minutes * 60:
        raise ValidationError("The time limit for this attempt has expired.")


def attempt_submit(*, attempt, time_spent_seconds=None):
    """Mark a quiz attempt as submitted (within time limit)."""
    from django.utils import timezone
    attempt.status = QuizAttempt.Status.SUBMITTED
    attempt.completed_at = timezone.now()
    attempt.time_spent_seconds = max(0, int((attempt.completed_at - attempt.started_at).total_seconds()))
    attempt.save(
        update_fields=["status", "completed_at", "time_spent_seconds", "updated_at"]
    )
    return attempt


def attempt_grade(*, attempt, auto_grade=False):
    """Grade a quiz attempt. If auto_grade, compute score from answers."""
    from decimal import Decimal
    if attempt.quiz.questions.filter(question_type=Question.Type.SHORT_ANSWER).exists():
        # Manual marking is not implemented yet: never invent a final grade.
        return attempt
    attempt.status = QuizAttempt.Status.GRADED
    attempt.save(update_fields=["status", "updated_at"])

    # Re-compute score from answers
    total_possible = Decimal(attempt.quiz.questions.count())
    total_earned = Decimal("0.00")

    for answer in Answer.objects.filter(
        student=attempt.student,
        question__quiz=attempt.quiz
    ).select_related("question", "choice"):
        if answer.question.question_type == Question.Type.MCQ:
            if answer.is_correct:
                total_earned += Decimal("1.00")
            else:
                pass
        elif answer.question.question_type == Question.Type.TRUE_FALSE:
            if answer.is_correct:
                total_earned += Decimal("1.00")
        elif answer.question.question_type == Question.Type.SHORT_ANSWER:
            pass

    attempt.total_score = (total_earned / total_possible * Decimal("100")) if total_possible > 0 else Decimal("0.00")
    attempt.passed = attempt.total_score >= Decimal(str(attempt.quiz.pass_mark))
    attempt.save(
        update_fields=["total_score", "passed", "updated_at"]
    )
    return attempt
