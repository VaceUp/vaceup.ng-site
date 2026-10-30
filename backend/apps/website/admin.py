"""Django admin registration for website content."""

from django.contrib import admin

from apps.website.models import (
    AcademyProfile,
    BlogPost,
    BloggerSource,
    Event,
    EventRegistration,
    TeamMember,
)


@admin.register(AcademyProfile)
class AcademyProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "founded_year", "updated_at")


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ("name", "role_title", "is_founder", "is_published", "order")
    list_filter = ("is_founder", "is_published")
    search_fields = ("name", "role_title")


class EventRegistrationInline(admin.TabularInline):
    model = EventRegistration
    extra = 0
    readonly_fields = ("name", "email", "phone", "note", "created_at")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "event_type", "starts_at", "location", "is_published")
    list_filter = ("event_type", "is_published", "is_online")
    search_fields = ("title", "location")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [EventRegistrationInline]


@admin.register(BloggerSource)
class BloggerSourceAdmin(admin.ModelAdmin):
    list_display = ("blog_id", "is_enabled", "last_synced_at")


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ("title", "published_at", "is_visible")
    list_filter = ("is_visible",)
    search_fields = ("title", "author_name")
    readonly_fields = ("blogger_id", "url", "content_html", "fetched_at")
