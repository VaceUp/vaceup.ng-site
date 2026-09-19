"""Django admin for messages (read-only audit)."""
from django.contrib import admin

from apps.messaging.models import Message, MessageBlock, MessageReport


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "recipient", "is_read", "created_at")
    list_filter = ("is_read",)
    search_fields = ("sender__email", "recipient__email", "body")
    readonly_fields = ("sender", "recipient", "body", "is_read", "read_at",
                       "client_message_id", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False


@admin.register(MessageReport)
class MessageReportAdmin(admin.ModelAdmin):
    list_display = ("id", "message_id", "reporter", "created_at", "reviewed_at")
    list_filter = ("reviewed_at",)
    readonly_fields = ("message", "reporter", "reason", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False


@admin.register(MessageBlock)
class MessageBlockAdmin(admin.ModelAdmin):
    list_display = ("id", "blocker", "blocked", "created_at")
    readonly_fields = ("blocker", "blocked", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False
