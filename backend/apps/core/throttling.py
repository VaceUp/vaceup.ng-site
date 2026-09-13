"""Database-backed abuse limits shared by all cPanel processes.

Uses InnoDB row locks, not a cache read/modify/write race. Failure is closed:
database failures do not disable throttling. Fixed windows can allow a burst
at a boundary; edge-level request limits remain complementary protection.
"""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle

from apps.core.models import RateLimitBucket


class DatabaseLimitMixin:
    def allow_request(self, request, view):
        if isinstance(self, ScopedRateThrottle):
            self.scope = getattr(view, self.scope_attr, None)
            if not self.scope:
                return True
            self.rate = self.get_rate()
            self.num_requests, self.duration = self.parse_rate(self.rate)
        if self.rate is None:
            return True
        identity = self.get_cache_key(request, view)
        if identity is None:
            return True
        key = salted_hmac("vaceup.rate-limit", identity, algorithm="sha256").hexdigest()
        now = timezone.now()
        with transaction.atomic():
            bucket, _ = RateLimitBucket.objects.select_for_update().get_or_create(
                key=key, defaults={"expires_at": now + timedelta(seconds=self.duration)},
            )
            if bucket.expires_at <= now:
                bucket.count = 0
                bucket.expires_at = now + timedelta(seconds=self.duration)
            self.retry_after = max(1, (bucket.expires_at - now).total_seconds())
            if bucket.count >= self.num_requests:
                return False
            bucket.count += 1
            bucket.save(update_fields=["count", "expires_at"])
        return True

    def wait(self):
        return self.retry_after


class DatabaseAnonRateThrottle(DatabaseLimitMixin, AnonRateThrottle):
    pass


class DatabaseUserRateThrottle(DatabaseLimitMixin, UserRateThrottle):
    pass


class DatabaseScopedRateThrottle(DatabaseLimitMixin, ScopedRateThrottle):
    pass
