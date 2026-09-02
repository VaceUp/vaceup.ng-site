"""Django admin for accounts — lets staff manage users and see token state."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import (
    EmailVerificationToken,
    PasswordResetToken,
    StudentProfile,
    TutorProfile,
    User,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Admin tuned for the email-as-username custom user."""

    ordering = ("email",)
    list_display = ("email", "full_name", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "full_name")
    readonly_fields = ("date_joined", "last_login")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "role")}),
        ("Permissions", {
            "fields": ("is_active", "is_staff", "is_superuser",
                       "groups", "user_permissions"),
        }),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "full_name", "role", "password1", "password2"),
        }),
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "country", "date_of_birth")
    search_fields = ("user__email", "country")


@admin.register(TutorProfile)
class TutorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "expertise", "years_experience")
    search_fields = ("user__email", "expertise")


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "used", "expires_at", "created_at")
    list_filter = ("used",)
    search_fields = ("user__email",)
    readonly_fields = ("token", "expires_at", "created_at", "updated_at")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "used", "expires_at", "created_at")
    list_filter = ("used",)
    search_fields = ("user__email",)
    readonly_fields = ("token", "expires_at", "created_at", "updated_at")
