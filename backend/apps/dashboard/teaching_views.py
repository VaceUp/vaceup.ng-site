"""Tutor-facing gradebook: one course, every learner, every assessment."""
from django.shortcuts import get_object_or_404
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.assignments.models import Assignment, Quiz, QuizAttempt, Submission
from apps.core.permissions import IsInstructorOrAdmin
from apps.courses.models import Course
from apps.dashboard.member_views import PrivateWorkspaceResponse
from apps.enrollment.models import Enrollment


def _percent(score, maximum):
    try:
        maximum = float(maximum)
        return round(float(score) * 100 / maximum, 2) if maximum else None
    except (TypeError, ValueError):
        return None


class CourseGradebookView(PrivateWorkspaceResponse, GenericAPIView):
    """GET /instructor/courses/{id}/gradebook/ → assessment results per learner."""

    permission_classes = [IsInstructorOrAdmin]

    def get(self, request, pk):
        courses = Course.objects.all()
        if not request.user.is_admin:
            courses = courses.filter(instructor=request.user)
        course = get_object_or_404(courses, pk=pk)

        enrollments = list(
            Enrollment.objects.filter(course=course)
            .select_related("student")
            .order_by("student__full_name", "student_id")
        )
        assignments = list(Assignment.objects.filter(course=course).order_by("due_at", "pk"))
        quizzes = list(
            Quiz.objects.filter(course=course)
            .exclude(status=Quiz.Status.DRAFT)
            .order_by("created_at", "pk")
        )
        submissions = {
            (row["student_id"], row["assignment_id"]): row
            for row in Submission.objects.filter(assignment__in=assignments).values(
                "student_id", "assignment_id", "status", "score", "is_late", "submitted_at")
        }
        attempts = {
            (row["student_id"], row["quiz_id"]): row
            for row in QuizAttempt.objects.filter(quiz__in=quizzes).values(
                "student_id", "quiz_id", "status", "total_score", "passed")
        }

        students = []
        graded_percentages = []
        for enrollment in enrollments:
            assignment_cells = {}
            quiz_cells = {}
            for assignment in assignments:
                submission = submissions.get((enrollment.student_id, assignment.pk))
                assignment_cells[str(assignment.pk)] = {
                    "status": submission["status"] if submission else "not_submitted",
                    "score": (str(submission["score"])
                              if submission and submission["score"] is not None else None),
                    "percent": (_percent(submission["score"], assignment.max_score)
                                if submission and submission["score"] is not None else None),
                    "submitted_at": submission["submitted_at"] if submission else None,
                    "is_late": bool(submission and submission["is_late"]),
                }
            for quiz in quizzes:
                attempt = attempts.get((enrollment.student_id, quiz.pk))
                quiz_cells[str(quiz.pk)] = {
                    "status": attempt["status"] if attempt else "not_started",
                    "score": (str(attempt["total_score"])
                              if attempt and attempt["total_score"] is not None else None),
                    "percent": (float(attempt["total_score"])
                                if attempt and attempt["total_score"] is not None else None),
                    "passed": bool(attempt and attempt["passed"]),
                }
            marks = [cell["percent"] for cell in assignment_cells.values() if cell["percent"] is not None]
            marks += [cell["percent"] for cell in quiz_cells.values() if cell["percent"] is not None]
            average = round(sum(marks) / len(marks), 2) if marks else None
            if average is not None:
                graded_percentages.append(average)
            students.append({
                "student_id": enrollment.student_id,
                "student_name": enrollment.student.full_name,
                "email": enrollment.student.email,
                "enrollment_status": enrollment.status,
                "progress_percent": str(enrollment.progress_percent),
                "enrolled_at": enrollment.enrolled_at,
                "assignments": assignment_cells,
                "quizzes": quiz_cells,
                "graded_items": len(marks),
                "average_percent": average,
            })

        ungraded = sum(
            1 for row in submissions.values()
            if row["score"] is None and row["status"] in (
                Submission.Status.SUBMITTED, Submission.Status.LATE, Submission.Status.REVIEW)
        )
        pending_quizzes = sum(
            1 for row in attempts.values()
            if row["total_score"] is None and row["status"] == QuizAttempt.Status.SUBMITTED
        )
        progress_values = [float(enrollment.progress_percent) for enrollment in enrollments]

        return Response({
            "course": {"id": course.pk, "title": course.title},
            "assignments": [{
                "id": assignment.pk, "title": assignment.title,
                "due_at": assignment.due_at, "max_score": str(assignment.max_score),
            } for assignment in assignments],
            "quizzes": [{
                "id": quiz.pk, "title": quiz.title, "status": quiz.status,
                "pass_mark": str(quiz.pass_mark),
            } for quiz in quizzes],
            "students": students,
            "summary": {
                "students": len(enrollments),
                "active": sum(1 for enrollment in enrollments
                              if enrollment.status == Enrollment.Status.ACTIVE),
                "completed": sum(1 for enrollment in enrollments
                                 if enrollment.status == Enrollment.Status.COMPLETED),
                "average_progress": (round(sum(progress_values) / len(progress_values), 2)
                                     if progress_values else 0),
                "average_grade": (round(sum(graded_percentages) / len(graded_percentages), 2)
                                  if graded_percentages else None),
                "awaiting_grading": ungraded + pending_quizzes,
            },
        })
