"""Application services: submit, review, approve/reject."""

from django.utils import timezone
from django.db import transaction

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


@transaction.atomic
def application_review(*, application, reviewer, action, rejection_reason=""):
    """Admin/instructor approves or rejects an application."""
    application = Application.objects.select_for_update().select_related("course").get(pk=application.pk)
    if not (reviewer.is_admin or application.course.instructor_id == reviewer.pk):
        raise PermissionError("Only the assigned tutor or an administrator can review this application.")
    if application.status != Application.Status.SUBMITTED:
        raise ValueError("Only submitted applications can be reviewed.")

    if action == "approve":
        application.status = Application.Status.APPROVED
        application.reviewed_by = reviewer
        application.reviewed_at = timezone.now()
        application.save()
        # Admission is not proof of payment. Only free courses grant immediate
        # access; paid courses use verified checkout or explicit admin grants.
        if application.course.price == 0:
            from apps.enrollment.services import grant_enrollment
            grant_enrollment(student=application.student, course=application.course)
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
