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
