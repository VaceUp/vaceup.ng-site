"""Django admin for the course catalog."""
from django.contrib import admin

from apps.courses.models import Category, Course, Lesson, Module


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 0


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "instructor", "level", "price",
                    "is_published")
    list_filter = ("is_published", "level", "category")
    search_fields = ("title", "instructor__email")
    autocomplete_fields = ("category", "instructor")
    inlines = [ModuleInline]


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "order")
    list_filter = ("course",)
    search_fields = ("title", "course__title")
    inlines = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "module", "order", "is_preview",
                    "duration_seconds")
    list_filter = ("is_preview",)
    search_fields = ("title", "module__title")
