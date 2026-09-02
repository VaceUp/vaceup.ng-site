"""Application services: submit, review, approve/reject."""

from django.utils import timezone

from apps.applications.models import Application
from apps.enrollment.models import Enrollment


def application_submit(*, student, course, motivation=""):
    """Student submits an application (idempotent — returns existing if any)."""
    application, created = Application.objects.get_or_create(
        student=student,
        course=course,
        defaults={
            "motivation": motivation,
            "status": Application.Status.SUBMITTED,
        },
    )
    return application


def application_review(*, application, reviewer, action, rejection_reason=""):
    """Admin/instructor approves or rejects an application."""
    if application.status != Application.Status.SUBMITTED:
        raise ValueError("Only submitted applications can be reviewed.")

    if action == "approve":
        application.status = Application.Status.APPROVED
        application.reviewed_by = reviewer
        application.reviewed_at = timezone.now()
        application.save()
        # Auto-enroll the student
        Enrollment.objects.get_or_create(
            student=application.student,
            course=application.course,
            defaults={"status": Enrollment.Status.ACTIVE},
        )
    elif action == "reject":
        application.status = Application.Status.REJECTED
        application.reviewed_by = reviewer
        application.reviewed_at = timezone.now()
        application.rejection_reason = rejection_reason
        application.save()
    else:
        raise ValueError("Action must be 'approve' or 'reject'.")

    return application


def application_withdraw(*, application, student):
    """Student withdraws their own application."""
    if application.student_id != student.id:
        raise PermissionError("Can only withdraw your own application.")
    if application.status not in (Application.Status.SUBMITTED, Application.Status.UNDER_REVIEW):
        raise ValueError("Can only withdraw submitted or under-review applications.")
    application.status = Application.Status.WITHDRAWN
    application.save()
    return application