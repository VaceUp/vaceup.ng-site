"""Django admin registration for website content."""

from django.contrib import admin

from apps.website import revisions
from apps.website.models import (
    AcademyProfile,
    BlogPost,
    BloggerSource,
    ContentRevision,
    Event,
    EventRegistration,
    TeamMember,
)


@admin.register(AcademyProfile)
class AcademyProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "founded_year", "updated_at")

    def save_model(self, request, obj, form, change):
        # Edits made here must be undoable from the site's own admin screen,
        # so the stored values are snapshotted before this form writes over them.
        before = revisions.dump(ContentRevision.Target.PROFILE, AcademyProfile.load()) if change else {}
        super().save_model(request, obj, form, change)
        if before:
            revisions.record(
                ContentRevision.Target.PROFILE,
                object_id=None,
                label="Academy profile",
                before=before,
                after=revisions.dump(ContentRevision.Target.PROFILE, obj),
                changed_by=request.user,
            )


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ("name", "role_title", "is_founder", "is_published", "order")
    list_filter = ("is_founder", "is_published")
    search_fields = ("name", "role_title")

    def save_model(self, request, obj, form, change):
        before = revisions.dump(ContentRevision.Target.TEAM, obj.__class__.objects.get(pk=obj.pk)) if change else {}
        super().save_model(request, obj, form, change)
        if before:
            revisions.record(
                ContentRevision.Target.TEAM,
                object_id=obj.pk,
                label=obj.name or "Team profile",
                before=before,
                after=revisions.dump(ContentRevision.Target.TEAM, obj),
                changed_by=request.user,
            )


@admin.register(ContentRevision)
class ContentRevisionAdmin(admin.ModelAdmin):
    list_display = ("label", "target", "changed_fields", "changed_by", "created_at")
    list_filter = ("target",)
    search_fields = ("label",)
    readonly_fields = ("target", "object_id", "label", "snapshot", "changed_fields", "changed_by", "created_at")

    def has_add_permission(self, request):
        return False


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
