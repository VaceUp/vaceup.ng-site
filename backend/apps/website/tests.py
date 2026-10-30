"""Public website API: events, RSVP, team, profile and Blogger sync."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.website.models import (
    AcademyProfile,
    BlogPost,
    BloggerSource,
    Event,
    EventRegistration,
    TeamMember,
)
from apps.website.sanitize import sanitize_html
from apps.website.services import sync_blogger

User = get_user_model()


class WebsiteApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@vaceup.ng", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_active=True,
        )
        self.student = User.objects.create_user(
            email="student@vaceup.ng", password="x", full_name="Student",
            role=User.Role.STUDENT, is_active=True,
        )
        self.start = timezone.now() + timezone.timedelta(days=7)

    def _event(self, **overrides):
        defaults = {
            "title": "Open Day", "event_type": Event.EventType.OPEN_DAY,
            "starts_at": self.start, "location": "Lagos", "is_published": True,
            "capacity": 2,
        }
        return Event.objects.create(**{**defaults, **overrides})

    # --- events ---

    def test_public_event_list_hides_drafts(self):
        self._event()
        self._event(title="Draft event", is_published=False)
        response = self.client.get("/api/v1/website/events/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "Open Day")

    def test_admin_event_list_includes_drafts(self):
        self._event()
        self._event(title="Draft event", is_published=False)
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/v1/website/events/")
        self.assertEqual(response.data["count"], 2)

    def test_admin_can_create_edit_and_delete_events(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post("/api/v1/website/events/", {
            "title": "Career Fair", "event_type": "career_fair",
            "starts_at": self.start.isoformat(), "location": "Lagos",
            "is_published": True,
        }, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.data["slug"])
        slug = created.data["slug"]

        updated = self.client.patch(
            f"/api/v1/website/events/{slug}/", {"location": "Abuja"}, format="json"
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["location"], "Abuja")

        deleted = self.client.delete(f"/api/v1/website/events/{slug}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Event.objects.filter(slug=slug).exists())

    def test_students_cannot_manage_events(self):
        self.client.force_authenticate(self.student)
        response = self.client.post("/api/v1/website/events/", {
            "title": "Fake", "starts_at": self.start.isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_event_rsvp_counts_and_capacity(self):
        event = self._event()
        url = f"/api/v1/website/events/{event.slug}/register/"
        first = self.client.post(url, {"name": "Ada", "email": "Ada@Example.com"}, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["seats_taken"], 1)
        self.assertEqual(EventRegistration.objects.get().email, "ada@example.com")

        duplicate = self.client.post(url, {"name": "Ada", "email": "ada@example.com"}, format="json")
        self.assertEqual(duplicate.status_code, 400)

        self.client.post(url, {"name": "Bola", "email": "bola@example.com"}, format="json")
        full = self.client.post(url, {"name": "Chi", "email": "chi@example.com"}, format="json")
        self.assertEqual(full.status_code, 400)
        self.assertIn("fully booked", full.data["detail"])

    def test_past_event_rejects_rsvp(self):
        event = self._event(starts_at=timezone.now() - timezone.timedelta(days=2))
        response = self.client.post(
            f"/api/v1/website/events/{event.slug}/register/",
            {"name": "Ada", "email": "ada@example.com"}, format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_can_read_event_registrations(self):
        event = self._event()
        EventRegistration.objects.create(event=event, name="Ada", email="ada@example.com")
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/v1/website/events/{event.slug}/registrations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    # --- profile and team ---

    def test_profile_defaults_and_admin_update(self):
        response = self.client.get("/api/v1/website/profile/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "VaceUp Digital Academy")

        self.client.force_authenticate(self.student)
        denied = self.client.patch("/api/v1/website/profile/", {"mission": "Hack"}, format="json")
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.admin)
        saved = self.client.patch("/api/v1/website/profile/", {
            "mission": "Equip Africans with practical digital skills.",
            "founded_year": 2025,
        }, format="json")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(AcademyProfile.load().founded_year, 2025)

    def test_team_list_shows_only_published_profiles(self):
        TeamMember.objects.create(name="Mercy", role_title="Founder", is_founder=True, is_published=True)
        TeamMember.objects.create(name="Hidden", role_title="Tutor", is_published=False)
        response = self.client.get("/api/v1/website/team/")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "Mercy")

    # --- blog ---

    def test_blog_list_shows_visible_posts(self):
        BlogPost.objects.create(
            blogger_id="1", title="Visible", url="https://example.com/1",
            published_at=timezone.now(), is_visible=True,
        )
        BlogPost.objects.create(
            blogger_id="2", title="Hidden", url="https://example.com/2",
            published_at=timezone.now(), is_visible=False,
        )
        response = self.client.get("/api/v1/website/posts/")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], "Visible")

    def test_blog_detail_includes_sanitized_content(self):
        post = BlogPost.objects.create(
            blogger_id="1", title="Hello", url="https://example.com/1",
            content_html="<p>Safe</p><script>alert(1)</script>",
            published_at=timezone.now(),
        )
        response = self.client.get(f"/api/v1/website/posts/{post.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("<p>Safe</p>", response.data["content_html"])
        self.assertNotIn("script", response.data["content_html"])

    def test_sync_requires_admin(self):
        self.client.force_authenticate(self.student)
        response = self.client.post("/api/v1/website/posts/sync/")
        self.assertEqual(response.status_code, 403)


class BlogSyncTests(TestCase):
    payload = {
        "feed": {
            "entry": [
                {
                    "id": {"$t": "tag:blogger.com,1999:blog-123.post-456"},
                    "published": {"$t": "2026-10-01T10:00:00.000+00:00"},
                    "title": {"$t": "Hello VaceUp"},
                    "content": {"$t": '<p>Welcome<script>alert(1)</script> <a href="javascript:alert(1)">x</a></p>'},
                    "author": [{"name": {"$t": "Mercy"}}],
                    "link": [{"rel": "alternate", "href": "https://vaceup.blogspot.com/2026/10/hello.html"}],
                    "category": [{"term": "News"}],
                    "media$thumbnail": {"url": "https://img.example.com/s72-c/cover.jpg"},
                }
            ]
        }
    }

    class Response:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self._payload

    def setUp(self):
        self.source = BloggerSource.objects.create(blog_id="123", is_enabled=True)

    def test_sync_creates_a_sanitized_post(self):
        with patch("apps.website.services.httpx.get", return_value=self.Response(self.payload)):
            result = sync_blogger(self.source)
        self.assertEqual(result["created"], 1)
        post = BlogPost.objects.get(blogger_id="456")
        self.assertEqual(post.title, "Hello VaceUp")
        self.assertIn("s640", post.thumbnail_url)
        self.assertNotIn("script", post.content_html)
        self.assertNotIn("javascript:", post.content_html)
        self.assertEqual(post.labels, ["News"])

    def test_repeat_sync_updates_without_duplicates(self):
        with patch("apps.website.services.httpx.get", return_value=self.Response(self.payload)):
            sync_blogger(self.source)
            result = sync_blogger(self.source)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(BlogPost.objects.count(), 1)

    def test_sync_failure_records_the_reason(self):
        import httpx

        with patch("apps.website.services.httpx.get", side_effect=httpx.ConnectError("offline")):
            with self.assertRaisesMessage(Exception, "Blogger sync failed"):
                sync_blogger(self.source)
        self.source.refresh_from_db()
        self.assertIn("offline", self.source.last_error)


class SanitizerTests(TestCase):
    def test_strips_scripts_handlers_and_unsafe_urls(self):
        html = (
            '<p onclick="steal()">Hi <strong>there</strong></p>'
            '<script>alert(1)</script>'
            '<a href="javascript:alert(1)">bad</a>'
            '<a href="https://vaceup.ng">good</a>'
            '<img src="data:image/svg+xml;base64,AAAA">'
        )
        clean = sanitize_html(html)
        self.assertNotIn("script", clean)
        self.assertNotIn("onclick", clean)
        self.assertNotIn("javascript:", clean)
        self.assertNotIn("data:", clean)
        self.assertIn('<a href="https://vaceup.ng" target="_blank"', clean)
        self.assertIn("<strong>there</strong>", clean)

    def test_allows_only_known_video_embeds(self):
        youtube = sanitize_html('<iframe src="https://www.youtube.com/embed/abc"></iframe>')
        self.assertIn("youtube.com/embed/abc", youtube)
        other = sanitize_html('<iframe src="https://evil.example.com/embed"></iframe>')
        self.assertNotIn("iframe", other)
