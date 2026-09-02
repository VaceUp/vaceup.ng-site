"""Django admin for messages (read-only audit)."""
from django.contrib import admin

from apps.messaging.models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "recipient", "is_read", "created_at")
    list_filter = ("is_read",)
    search_fields = ("sender__email", "recipient__email", "body")
    readonly_fields = ("sender", "recipient", "body", "is_read", "read_at",
                       "created_at", "updated_at")

    def has_add_permission(self, request):
        return False
