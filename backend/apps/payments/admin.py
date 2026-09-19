"""Django admin for payments (read-mostly; records come from the gateway)."""
from django.contrib import admin

from apps.payments.models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("reference", "student", "course", "amount", "currency",
                    "status", "pricing_version", "paid_at", "created_at")
    list_filter = ("status", "currency", "pricing_version")
    search_fields = ("reference", "student__email", "course__title")
    autocomplete_fields = ("student", "course")
    readonly_fields = ("reference", "student", "course", "amount", "currency",
                       "authorization_url", "access_code", "paid_at",
                       "status", "pricing_version", "checkout_fingerprint",
                       "gateway_response", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False  # payments are created via the API/gateway only

    def has_delete_permission(self, request, obj=None):
        return False  # retain financial records for reconciliation
