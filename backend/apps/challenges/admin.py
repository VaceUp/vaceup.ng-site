"""Challenge records remain inspectable in Django's administrator console."""
from django.contrib import admin
from .models import ChallengeRound, RoundCategory, ChallengeRegistration, ChallengeSubmission, AssessmentRun, EngagementSnapshot, ChallengeJob, ScoreOverride


@admin.register(ChallengeRound)
class ChallengeRoundAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "mode", "registration_opens_at", "submission_closes_at")
    readonly_fields = ("published_rules", "frozen_scorebook", "scorebook_version", "frozen_at", "published_at")
    def has_add_permission(self, request):
        return False  # The dashboard API validates dates, rules and draft cloning.
    def has_delete_permission(self, request, obj=None):
        return bool(obj and obj.status == "draft" and not obj.registrations.exists())
    def get_readonly_fields(self, request, obj=None):
        # Published rules may only change through a new round, including in Django admin.
        if obj and obj.status != "draft":
            return tuple(field.name for field in self.model._meta.fields)
        return self.readonly_fields + ("status",)


@admin.register(RoundCategory)
class RoundCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "round", "enabled", "rubric_version")
    def has_add_permission(self, request):
        return False
    def has_delete_permission(self, request, obj=None):
        return bool(obj and obj.round.status == "draft" and not obj.registrations.exists())
    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields) if obj and obj.round.status != "draft" else ("round", "rubric_version", "brief_pdf_key")


class AuditReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False


for model in (ChallengeRegistration, ChallengeSubmission, AssessmentRun, EngagementSnapshot, ChallengeJob, ScoreOverride):
    admin.site.register(model, AuditReadOnlyAdmin)
