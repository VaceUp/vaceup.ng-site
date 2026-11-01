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


LOCK_WAIT_TIMEOUT = 1205
DEADLOCK = 1213

# SQLite reports the same contention as a text error, so codes alone miss it.
TRANSIENT_LOCK_MESSAGES = ("database is locked", "database table is locked", "deadlock found")


def is_transient_lock_error(exc: OperationalError) -> bool:
    cause = exc.__cause__ or exc
    if cause.args and isinstance(cause.args[0], int):
        return cause.args[0] in (LOCK_WAIT_TIMEOUT, DEADLOCK)
    message = str(cause).lower()
    return any(marker in message for marker in TRANSIENT_LOCK_MESSAGES)


# Five tries costs at most 150ms of backoff before the limit fails closed.
LOCK_RETRY_ATTEMPTS = 5


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
        # The write runs in its own savepoint. A failed statement otherwise
        # leaves a caller-owned transaction (ATOMIC_REQUESTS, or a test case)
        # unusable for the rest of the request, so one rejected counter update
        # becomes a 503 on every later query.
        for attempt in range(LOCK_RETRY_ATTEMPTS):
            try:
                now = timezone.now()
                with transaction.atomic():
                    RateLimitBucket.objects.get_or_create(
                        key=key, defaults={"expires_at": now + timedelta(seconds=self.duration)},
                    )
                    return self._consume(key)
            except OperationalError as exc:
                exhausted = attempt == LOCK_RETRY_ATTEMPTS - 1
                if not is_transient_lock_error(exc) or caller_transaction or exhausted:
                    raise RateLimitUnavailable() from exc
                sleep(0.01 * (2 ** attempt))
            except DatabaseError as exc:
                raise RateLimitUnavailable() from exc

    def _consume(self, key):
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
