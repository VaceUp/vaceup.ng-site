from django.contrib import admin

from .models import (
    KidsAdmission,
    KidsCertificate,
    KidsClassSession,
    KidsEnrollment,
    KidsLearner,
    KidsParentProfile,
    KidsSession,
    KidsStageProgress,
)


@admin.register(KidsParentProfile)
class KidsParentProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "consent_status", "created_at")
    list_filter = ("consent_status",)
    search_fields = ("user__email", "user__full_name", "phone")
    autocomplete_fields = ("user",)


@admin.register(KidsLearner)
class KidsLearnerAdmin(admin.ModelAdmin):
    list_display = ("full_name", "parent", "status", "date_of_birth", "created_at")
    list_filter = ("status",)
    search_fields = ("full_name", "parent__user__email", "parent__user__full_name")
    autocomplete_fields = ("parent",)


@admin.register(KidsAdmission)
class KidsAdmissionAdmin(admin.ModelAdmin):
    list_display = ("learner", "course", "status", "payment_preference", "created_at")
    list_filter = ("status", "payment_preference")
    search_fields = ("learner__full_name", "parent__user__email", "course__title")
    autocomplete_fields = ("parent", "learner", "course", "reviewed_by")


@admin.register(KidsEnrollment)
class KidsEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("learner", "course", "status", "current_stage", "progress_percent")
    list_filter = ("status",)
    search_fields = ("learner__full_name", "parent__user__email", "course__title")
    autocomplete_fields = ("admission", "parent", "learner", "course")


@admin.register(KidsStageProgress)
class KidsStageProgressAdmin(admin.ModelAdmin):
    list_display = ("enrollment", "stage_number", "title", "status", "progress_percent")
    list_filter = ("status",)
    search_fields = ("enrollment__learner__full_name", "title")
    autocomplete_fields = ("enrollment",)


@admin.register(KidsClassSession)
class KidsClassSessionAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "scheduled_start", "status", "tutor")
    list_filter = ("status",)
    search_fields = ("title", "course__title", "tutor__email")
    autocomplete_fields = ("course", "tutor")


@admin.register(KidsCertificate)
class KidsCertificateAdmin(admin.ModelAdmin):
    list_display = ("title", "enrollment", "verification_code", "issued_at")
    search_fields = ("title", "verification_code", "enrollment__learner__full_name")
    autocomplete_fields = ("enrollment",)


@admin.register(KidsSession)
class KidsSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "expires_at", "revoked_at", "last_seen_at")
    list_filter = ("revoked_at",)
    search_fields = ("user__email", "user__full_name")
    readonly_fields = ("token_hash",)
