"""Reusable DRF permissions for role- and enrollment-based access control."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


def _course_of(obj):
    """Resolve the owning Course from a Course / Module / Lesson instance.

    Duck-typed on ``related_name`` attributes so the helper stays decoupled
    from concrete model imports.
    """
    if hasattr(obj, "modules"):   # obj is a Course
        return obj
    if hasattr(obj, "lessons"):   # obj is a Module
        return obj.course
    if hasattr(obj, "module"):    # obj is a Lesson
        return obj.module.course
    if hasattr(obj, "course"):    # obj directly owns a course (LiveClass, …)
        return obj.course
    return None


class IsAdmin(BasePermission):
    """Permission: admin only."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_admin
        )


class IsAdminOrReadOnly(BasePermission):
    """Anyone may read; only admins may write. Used for catalog-wide data
    (e.g. Category) that isn't owned by an individual instructor."""

    message = "Only an admin may modify this."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin)


class IsInstructorOrAdmin(BasePermission):
    """Write access for admins (all) and instructors (their own courses)."""

    message = "Only the course instructor or an admin may modify this."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_instructor or user.is_admin)
        )

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_admin:
            return True
        course = _course_of(obj)
        # Instructors are scoped to courses they own.
        return course is not None and course.instructor_id == user.id


class IsEnrolledStudent(BasePermission):
    """Read access to gated content for actively-enrolled students.

    Admins and the owning instructor bypass the check; preview lessons are
    open to any authenticated user on safe methods.
    """

    message = "You must be enrolled in this course to access its content."

    def has_permission(self, request, view):
        # Gate the door to authenticated users; the real check is per-object.
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_admin:
            return True

        course = _course_of(obj)
        if course is None:
            return False

        if user.is_instructor and course.instructor_id == user.id:
            return True

        if getattr(obj, "is_preview", False) and request.method in SAFE_METHODS:
            return True

        # Local import avoids any app-loading order edge cases.
        from apps.enrollment.models import Enrollment

        # Active AND completed students keep access; only suspension revokes it.
        # .exists() is a single cheap indexed lookup (no row hydration).
        return Enrollment.objects.filter(
            student=user,
            course=course,
            status__in=(
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
            ),
        ).exists()
