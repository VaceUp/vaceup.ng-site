"""Database-backed abuse limits shared by all cPanel processes.

Uses InnoDB row locks, not a cache read/modify/write race. Failure is closed:
database failures do not disable throttling. Fixed windows can allow a burst
at a boundary; edge-level request limits remain complementary protection.
"""
from datetime import timedelta
from time import sleep

from django.db import DatabaseError, OperationalError, connection, transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.exceptions import APIException

from apps.core.models import RateLimitBucket


class RateLimitUnavailable(APIException):
    status_code = 503
    default_code = "rate_limit_unavailable"
    default_detail = "Security checks are temporarily unavailable. Please retry shortly."


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
        # SELECT FOR UPDATE on a missing key can deadlock competing inserts in
        # InnoDB. Establish the unique row before taking the counter's row lock.
        # A deadlock aborts a MySQL transaction: retry only our own transaction,
        # never a caller-owned transaction that may contain other work.
        caller_transaction = connection.in_atomic_block
        for attempt in range(3):
            try:
                now = timezone.now()
                RateLimitBucket.objects.get_or_create(
                    key=key, defaults={"expires_at": now + timedelta(seconds=self.duration)},
                )
                return self._consume(key)
            except OperationalError as exc:
                cause = exc.__cause__ or exc
                code = cause.args[0] if cause.args else None
                if code not in (1205, 1213) or caller_transaction or attempt == 2:
                    raise RateLimitUnavailable() from exc
                sleep(0.01 * (2 ** attempt))
            except DatabaseError as exc:
                raise RateLimitUnavailable() from exc

    def _consume(self, key):
        with transaction.atomic():
            bucket = RateLimitBucket.objects.select_for_update().get(key=key)
            now = timezone.now()
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
