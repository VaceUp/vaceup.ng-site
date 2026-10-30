"""Scheduled Blogger refresh."""

import logging

from celery import shared_task

from apps.website.models import BloggerSource
from apps.website.services import BloggerSyncError, sync_blogger

logger = logging.getLogger("apps.website")


@shared_task(name="website.sync_blogger_posts")
def sync_blogger_posts():
    source = BloggerSource.load()
    if source is None or not source.is_enabled or not source.blog_id:
        return {"skipped": "Blogger is not configured or disabled."}
    try:
        return sync_blogger(source)
    except BloggerSyncError as exc:
        logger.warning("Scheduled Blogger sync failed: %s", exc)
        return {"error": str(exc)}
