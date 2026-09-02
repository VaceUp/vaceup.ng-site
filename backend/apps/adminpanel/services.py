"""Admin panel services: logging, stats, etc."""
from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.adminpanel.models import AdminActionLog
from apps.core.exceptions import DomainError


def log_admin_action(*, admin, action_type, description, target_user=None, 
                     target_course=None, metadata=None, request=None):
    """Log an admin action to the audit trail."""
    metadata = metadata or {}
    
    if request:
        metadata["ip_address"] = get_client_ip(request)
        metadata["user_agent"] = request.META.get("HTTP_USER_AGENT", "")
    
    log = AdminActionLog.objects.create(
        admin=admin,
        action_type=action_type,
        target_user=target_user,
        target_course=target_course,
        description=description,
        metadata=metadata,
        ip_address=metadata.get("ip_address"),
        user_agent=metadata.get("user_agent"),
    )
    return log


def get_client_ip(request):
    """Extract client IP from request."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")