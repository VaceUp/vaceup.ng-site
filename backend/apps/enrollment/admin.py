"""Django admin for enrollments and progress."""
from django.contrib import admin

from apps.enrollment.models import Enrollment, LessonProgress


class LessonProgressInline(admin.TabularInline):
    model = LessonProgress
    extra = 0
    readonly_fields = ("lesson", "completed", "completed_at")


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "status", "progress_percent",
                    "enrolled_at", "completed_at")
    list_filter = ("status",)
    search_fields = ("student__email", "course__title")
    autocomplete_fields = ("student", "course")
    inlines = [LessonProgressInline]


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ("enrollment", "lesson", "completed", "completed_at")
    list_filter = ("completed",)
    search_fields = ("enrollment__student__email", "lesson__title")
