"""Shared abstract base models used across every VaceUp app."""
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base adding self-managing created/updated timestamps.

    Every concrete model inherits this, so audit timestamps are consistent
    and never hand-managed at the call site.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ("-created_at",)


class CacheEntry(models.Model):
    """Schema required by Django's DatabaseCache; installed by migrations."""

    cache_key = models.CharField(max_length=255, primary_key=True)
    value = models.TextField()
    expires = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "vaceup_cache"


class RateLimitBucket(models.Model):
    """Shared fixed-window counter, serialized by a database row lock."""

    key = models.CharField(max_length=64, primary_key=True)
    expires_at = models.DateTimeField(db_index=True)
    count = models.PositiveIntegerField(default=0)
