"""Blogger feed sync: cache published posts for the public website."""

import logging

import httpx
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.website.models import BlogPost, BloggerSource
from apps.website.sanitize import sanitize_html

logger = logging.getLogger("apps.website")

REQUEST_TIMEOUT = 20


class BloggerSyncError(Exception):
    """Raised when the Blogger source cannot be read."""


def _blogger_id(value):
    if not value:
        return ""
    value = value.strip()
    if "post-" in value:
        return value.rsplit("post-", 1)[-1].split(".")[0]
    return value


def _request_target(source):
    """Return (url, is_api) for the configured blog."""
    blog_id = source.blog_id.strip()
    if blog_id.isdigit():
        if source.api_key:
            return f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts", True
        return f"https://www.blogger.com/feeds/{blog_id}/posts/default", False
    if "." in blog_id:
        return f"https://{blog_id}/feeds/posts/default", False
    raise BloggerSyncError("Blogger blog ID must be numeric or a blogspot.com domain.")


def _parse_feed(payload):
    entries = payload.get("feed", {}).get("entry", []) or []
    for entry in entries:
        links = entry.get("link", []) or []
        url = next((link.get("href") for link in links if link.get("rel") == "alternate"), "")
        published = parse_datetime(entry.get("published", {}).get("$t", "")) or timezone.now()
        thumbnail = (entry.get("media$thumbnail") or {}).get("url", "")
        if thumbnail:
            thumbnail = thumbnail.replace("/s72-c/", "/s640/")
        yield {
            "blogger_id": _blogger_id(entry.get("id", {}).get("$t", "")),
            "title": entry.get("title", {}).get("$t", "Untitled"),
            "url": url,
            "content_html": entry.get("content", {}).get("$t", ""),
            "author_name": (entry.get("author") or [{}])[0].get("name", {}).get("$t", ""),
            "labels": [category.get("term", "") for category in entry.get("category", []) or [] if category.get("term")],
            "thumbnail_url": thumbnail,
            "published_at": published,
        }


def _parse_api(payload):
    for item in payload.get("items", []) or []:
        published = parse_datetime(item.get("published", "")) or timezone.now()
        images = item.get("images") or []
        yield {
            "blogger_id": str(item.get("id", "")),
            "title": item.get("title", "Untitled"),
            "url": item.get("url", ""),
            "content_html": item.get("content", ""),
            "author_name": (item.get("author") or {}).get("displayName", ""),
            "labels": item.get("labels", []) or [],
            "thumbnail_url": images[0].get("url", "") if images else "",
            "published_at": published,
        }


def html_to_text(value, limit=260):
    from html.parser import HTMLParser

    class Text(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.chunks = []

        def handle_data(self, data):
            text = " ".join(data.split())
            if text:
                self.chunks.append(text)

    parser = Text()
    parser.feed(value or "")
    parser.close()
    text = " ".join(parser.chunks).strip()
    return text[:limit].rstrip() + ("..." if len(text) > limit else "")


def sync_blogger(source=None, limit=100):
    """Fetch published posts and cache them. Returns a summary dict."""
    source = source or BloggerSource.load()
    if source is None:
        raise BloggerSyncError("Blogger is not configured yet.")
    if not source.is_enabled:
        raise BloggerSyncError("Blogger sync is disabled.")
    if not source.blog_id:
        raise BloggerSyncError("Add the Blogger blog ID before syncing.")

    url, is_api = _request_target(source)
    if is_api:
        params = {
            "key": source.api_key,
            "maxResults": min(limit, 100),
            "fetchBodies": "true",
            "status": "live",
        }
    else:
        params = {"alt": "json", "max-results": min(limit, 150)}

    try:
        response = httpx.get(
            url,
            params=params,
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        source.last_error = f"Blogger sync failed: {exc}"
        source.save(update_fields=["last_error", "updated_at"])
        logger.warning("Blogger sync failed: %s", exc)
        raise BloggerSyncError(source.last_error) from exc

    entries = _parse_api(payload) if is_api else _parse_feed(payload)
    created = updated = skipped = 0
    for entry in entries:
        if not entry["blogger_id"] or not entry["url"]:
            skipped += 1
            continue
        if source.label_filter and source.label_filter.lower() not in [
            label.lower() for label in entry["labels"]
        ]:
            skipped += 1
            continue
        content = sanitize_html(entry["content_html"])
        _, was_created = BlogPost.objects.update_or_create(
            blogger_id=entry["blogger_id"],
            defaults={
                "title": entry["title"][:300],
                "url": entry["url"][:500],
                "content_html": content,
                "summary": html_to_text(content),
                "author_name": entry["author_name"][:150],
                "labels": entry["labels"],
                "thumbnail_url": entry["thumbnail_url"][:500],
                "published_at": entry["published_at"],
                "fetched_at": timezone.now(),
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

    source.last_synced_at = timezone.now()
    source.last_error = ""
    source.save(update_fields=["last_synced_at", "last_error", "updated_at"])
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "synced_at": source.last_synced_at.isoformat(),
    }
