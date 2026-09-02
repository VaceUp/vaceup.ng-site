"""Serializers for the course catalog, incl. nested read representations.

Write serializers enforce instructor ownership: an instructor may only attach
a module to a course they own, or a lesson to a module in a course they own.
Admins bypass the ownership check.
"""
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.courses.models import Category, Course, Lesson, Module
from apps.enrollment.models import Enrollment


def _user(serializer):
    request = serializer.context.get("request")
    return getattr(request, "user", None)


def is_entitled_to_content(user, course) -> bool:
    """True if ``user`` may see the full lesson bodies of ``course``.

    Entitlement = admin, the owning instructor, or a student with an active/
    completed enrollment. Everyone else sees only preview lessons in full;
    non-preview bodies are redacted (see ``NestedLessonSerializer``).
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_admin or course.instructor_id == user.id:
        return True
    return course.enrollments.filter(
        student=user,
        status__in=(Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED),
    ).exists()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug")
        read_only_fields = ("slug",)  # derived from name on save


class LessonSerializer(serializers.ModelSerializer):
    """Read + write. ``module`` is writable and ownership-checked."""

    module = serializers.PrimaryKeyRelatedField(queryset=Module.objects.all())

    class Meta:
        model = Lesson
        fields = (
            "id",
            "module",
            "title",
            "content",
            "video_url",
            "video_key",
            "order",
            "duration_seconds",
            "is_preview",
        )
        # video_key is set via the attach-video action, not written directly.
        read_only_fields = ("video_key",)

    def validate_module(self, module):
        user = _user(self)
        if user and user.is_authenticated and user.is_admin:
            return module
        if module.course.instructor_id != getattr(user, "id", None):
            raise PermissionDenied(
                "You can only add lessons to modules of your own courses."
            )
        return module


class NestedLessonSerializer(serializers.ModelSerializer):
    """Read-only lesson for the public course tree, with content gating.

    Non-preview ``content``/``video_url`` are blanked and ``locked: true`` is set
    unless the viewer is entitled (flag set by ``CourseDetailSerializer``). The
    structure (title, order, duration) stays visible so the UI can show a locked
    outline. This is what stops a non-paying visitor reading a paid course.
    """

    locked = serializers.SerializerMethodField()
    has_video = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = (
            "id",
            "module",
            "title",
            "content",
            "video_url",
            "order",
            "duration_seconds",
            "is_preview",
            "locked",
            "has_video",
        )

    def get_has_video(self, lesson):
        return bool(lesson.video_key or lesson.video_url)

    def get_locked(self, lesson):
        return not self._may_see(lesson)

    def _may_see(self, lesson):
        # Preview lessons are always fully visible; otherwise gate on entitlement.
        return lesson.is_preview or self.context.get("entitled", False)

    def to_representation(self, lesson):
        data = super().to_representation(lesson)
        if not self._may_see(lesson):
            data["content"] = ""
            data["video_url"] = ""
        return data


class NestedModuleSerializer(serializers.ModelSerializer):
    """Read-only module + its lessons, embedded inside a course tree."""

    lessons = NestedLessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ("id", "title", "order", "lessons")


class ModuleSerializer(serializers.ModelSerializer):
    """Read + write for the module endpoint. ``course`` is ownership-checked."""

    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ("id", "course", "title", "order", "lessons")

    def validate_course(self, course):
        user = _user(self)
        if user and user.is_authenticated and user.is_admin:
            return course
        if course.instructor_id != getattr(user, "id", None):
            raise PermissionDenied(
                "You can only add modules to your own courses."
            )
        return course


class CourseListSerializer(serializers.ModelSerializer):
    """Lightweight shape for list endpoints (no nested module tree)."""

    instructor_name = serializers.CharField(
        source="instructor.full_name", read_only=True
    )
    category = serializers.StringRelatedField()

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "slug",
            "category",
            "instructor_name",
            "level",
            "price",
            "thumbnail",
            "is_published",
        )


class CourseBasicSerializer(serializers.ModelSerializer):
    """Minimal course info for cart/checkout (no nested modules)."""

    instructor_name = serializers.CharField(
        source="instructor.full_name", read_only=True
    )
    category = serializers.StringRelatedField()

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "slug",
            "category",
            "instructor_name",
            "level",
            "price",
            "thumbnail",
            "is_published",
        )


class CourseDetailSerializer(serializers.ModelSerializer):
    """Full course tree: modules -> lessons nested inside the course."""

    modules = NestedModuleSerializer(many=True, read_only=True)
    instructor_name = serializers.CharField(
        source="instructor.full_name", read_only=True
    )
    # category is writable (by id); its name is echoed read-only.
    category_name = serializers.CharField(
        source="category.name", read_only=True
    )

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "slug",
            "description",
            "category",
            "category_name",
            "instructor",
            "instructor_name",
            "level",
            "price",
            "thumbnail",
            "is_published",
            "modules",
            "created_at",
        )
        # instructor is bound from request.user server-side; slug is derived.
        read_only_fields = ("instructor", "slug")

    def to_representation(self, course):
        # Decide once per course whether this viewer sees full lesson bodies;
        # nested lesson serializers read this flag from the shared context.
        self.context["entitled"] = is_entitled_to_content(
            _user(self), course
        )
        return super().to_representation(course)
