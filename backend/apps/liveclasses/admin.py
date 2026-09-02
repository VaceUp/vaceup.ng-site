"""Django admin for live classes and attendance."""
from django.contrib import admin

from apps.liveclasses.models import Attendance, LiveClass


class AttendanceInline(admin.TabularInline):
    model = Attendance
    extra = 0
    readonly_fields = ("student", "joined_at")


@admin.register(LiveClass)
class LiveClassAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "scheduled_start", "duration_minutes",
                    "provider", "status")
    list_filter = ("status", "provider")
    search_fields = ("title", "course__title")
    autocomplete_fields = ("course",)
    inlines = [AttendanceInline]


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("live_class", "student", "joined_at")
    search_fields = ("live_class__title", "student__email")
