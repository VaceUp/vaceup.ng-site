"""Enrollment & progress business logic (write layer).

Kept idempotent: enrolling twice returns the existing enrollment; marking a
lesson complete twice is a no-op beyond the first. The unique constraints on
``(student, course)`` and ``(enrollment, lesson)`` are the final safety net.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import NotEnrolled, PaymentRequired
from apps.enrollment.models import Enrollment, LessonProgress


@transaction.atomic
def enroll(*, student, course):
    """Enrol a student in a published course.

    Free courses (price == 0) enrol directly. Paid courses defer to the
    payments flow (Phase 1) and raise ``PaymentRequired`` for now.
    Idempotent: returns the existing enrollment if one already exists.
    """
    if not course.is_published:
        raise NotEnrolled("This course is not open for enrollment.")

    existing = Enrollment.objects.filter(student=student, course=course).first()
    if existing is not None:
        return existing

    if course.price and course.price > 0:
        raise PaymentRequired(
            "This course requires payment, which isn't available yet."
        )

    return grant_enrollment(student=student, course=course)


@transaction.atomic
def grant_enrollment(*, student, course):
    """Idempotently create an ACTIVE enrollment regardless of price.

    The single source of truth for creating enrollments. Called by the free
    path above, by the payments app after a verified successful payment, and by
    admin tooling. Bypasses the price gate on purpose — callers decide entitlement.
    """
    enrollment, _ = Enrollment.objects.get_or_create(
        student=student,
        course=course,
        defaults={"status": Enrollment.Status.ACTIVE},
    )
    return enrollment


@transaction.atomic
def mark_lesson_complete(*, student, lesson):
    """Mark a lesson complete for the student and recompute progress.

    Raises ``NotEnrolled`` if the student has no active enrollment in the
    lesson's course. Idempotent.
    """
    course = lesson.module.course
    enrollment = (
        Enrollment.objects.select_for_update()
        .filter(student=student, course=course)
        .first()
    )
    if enrollment is None or enrollment.status == Enrollment.Status.SUSPENDED:
        raise NotEnrolled()

    progress, _ = LessonProgress.objects.get_or_create(
        enrollment=enrollment, lesson=lesson
    )
    if not progress.completed:
        progress.completed = True
        progress.completed_at = timezone.now()
        progress.save(update_fields=["completed", "completed_at", "updated_at"])

    # Derived, never trusted: recompute from stored completions.
    enrollment.recalculate_progress()
    return enrollment
