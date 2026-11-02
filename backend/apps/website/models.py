"""Public website content: academy profile, team, events and blog posts."""

from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import TimeStampedModel
from config.storages import public_media_storage

# Only real image types may be written to public media.
IMAGE_UPLOAD_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]


def _unique_slug(model, value, max_length=200):
    base = slugify(value)[:max_length] or "item"
    candidate = base
    suffix = 2
    while model.objects.filter(slug=candidate).exists():
        candidate = f"{base[: max_length - len(str(suffix)) - 1]}-{suffix}"
        suffix += 1
    return candidate


class AcademyProfile(TimeStampedModel):
    """Singleton-ish profile powering the public About page."""

    name = models.CharField(max_length=200, default="VaceUp Digital Academy")
    tagline = models.CharField(max_length=300, blank=True)
    mission = models.TextField(blank=True)
    story = models.TextField(blank=True)
    # The large line at the top of the About page. Blank keeps the published
    # headline, so an admin can revert to it by clearing the field.
    hero_title = models.CharField(max_length=300, blank=True)
    location = models.CharField(max_length=200, blank=True)
    founded_year = models.PositiveIntegerField(null=True, blank=True)
    # The date the homepage advertises. Editable by an admin so a new cohort
    # can be announced without a code change; blank means no banner.
    next_cohort_start = models.DateField(null=True, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    linkedin_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    website_url = models.URLField(blank=True)

    class Meta:
        verbose_name = "academy profile"
        verbose_name_plural = "academy profile"

    def __str__(self):
        return self.name

    @classmethod
    def load(cls):
        return cls.objects.order_by("pk").first()


class TeamMember(TimeStampedModel):
    """A founder or team profile shown on the About page."""

    name = models.CharField(max_length=150)
    role_title = models.CharField(max_length=150)
    bio = models.TextField(blank=True)
    quote = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    photo = models.ImageField(
        upload_to="website/team/", blank=True, null=True, storage=public_media_storage,
        validators=[FileExtensionValidator(IMAGE_UPLOAD_EXTENSIONS)],
    )
    linkedin_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    website_url = models.URLField(blank=True)
    is_founder = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ("order", "pk")

    def __str__(self):
        return f"{self.name} ({self.role_title})"


class ContentRevision(TimeStampedModel):
    """The state an About-page item held just before it was last changed.

    The academy edits this copy itself, so a mistyped paragraph should not
    need a developer: every saved edit leaves the previous values here, and
    restoring one of them is the "undo" the editor asks for.
    """

    class Target(models.TextChoices):
        PROFILE = "profile", "Academy profile"
        TEAM = "team", "Team profile"

    target = models.CharField(max_length=10, choices=Target.choices, db_index=True)
    # The team row this belongs to; the academy profile is a singleton, so it
    # has no id and stores null.
    object_id = models.PositiveIntegerField(null=True, blank=True)
    label = models.CharField(max_length=200)
    snapshot = models.JSONField()
    changed_fields = models.JSONField(default=list, blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="website_revisions",
    )

    class Meta:
        ordering = ("-created_at", "-pk")
        verbose_name = "content revision"
        verbose_name_plural = "content revisions"
        indexes = [models.Index(fields=["target", "object_id", "-created_at"])]

    def __str__(self):
        return f"{self.label} before {self.created_at:%Y-%m-%d %H:%M}"


class Event(TimeStampedModel):
    """An academy event, workshop or info session managed from the admin."""

    class EventType(models.TextChoices):
        OPEN_DAY = "open_day", "Open Day"
        CAREER_FAIR = "career_fair", "Career Fair"
        WORKSHOP = "workshop", "Workshop"
        NETWORKING = "networking", "Networking"
        INFO_SESSION = "info_session", "Info Session"
        HACKATHON = "hackathon", "Hackathon"
        OTHER = "other", "Other"

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    summary = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    event_type = models.CharField(
        max_length=30, choices=EventType.choices, default=EventType.OTHER
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=250, blank=True)
    is_online = models.BooleanField(default=False)
    meeting_url = models.URLField(
        blank=True, help_text="Online meeting link (Google Meet, Zoom, ...)."
    )
    registration_url = models.CharField(
        max_length=500,
        blank=True,
        help_text="Optional custom registration link; defaults to the in-site RSVP form.",
    )
    capacity = models.PositiveIntegerField(
        null=True, blank=True, help_text="Leave blank for unlimited seats."
    )
    image_url = models.URLField(blank=True)
    cover_image = models.ImageField(
        upload_to="website/events/", blank=True, null=True, storage=public_media_storage,
        validators=[FileExtensionValidator(IMAGE_UPLOAD_EXTENSIONS)],
    )
    is_featured = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ("starts_at",)
        indexes = [models.Index(fields=["is_published", "starts_at"])]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _unique_slug(Event, self.title, max_length=220)
        super().save(*args, **kwargs)

    @property
    def is_past(self):
        end = self.ends_at or self.starts_at
        return end < timezone.now()

    @property
    def seats_taken(self):
        return self.registrations.count()

    @property
    def is_full(self):
        return self.capacity is not None and self.seats_taken >= self.capacity


class EventRegistration(TimeStampedModel):
    """A public RSVP for an event."""

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="registrations"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="event_registrations",
    )
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True)
    note = models.TextField(blank=True)
    consent_marketing = models.BooleanField(
        default=False,
        help_text="The visitor agreed to be emailed about future events.",
    )

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["event", "email"], name="uq_event_registration_email"
            )
        ]

    def __str__(self):
        return f"{self.name} -> {self.event.title}"


class BloggerSource(TimeStampedModel):
    """Connection settings for the academy's existing Blogger blog."""

    blog_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Numeric Blogger blog ID (Blogger dashboard -> Settings).",
    )
    api_key = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional Google API key; public feeds work without one.",
    )
    label_filter = models.CharField(
        max_length=200, blank=True, help_text="Only import posts with this label."
    )
    is_enabled = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    class Meta:
        verbose_name = "blogger source"
        verbose_name_plural = "blogger source"

    def __str__(self):
        return f"Blogger source ({self.blog_id or 'not configured'})"

    @classmethod
    def load(cls):
        return cls.objects.order_by("pk").first()


class BlogPost(TimeStampedModel):
    """A published Blogger post cached locally for the website."""

    blogger_id = models.CharField(max_length=100, unique=True)
    title = models.CharField(max_length=300)
    url = models.URLField(max_length=500)
    summary = models.TextField(blank=True)
    content_html = models.TextField(blank=True)
    author_name = models.CharField(max_length=150, blank=True)
    labels = models.JSONField(default=list, blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True)
    published_at = models.DateTimeField(db_index=True)
    is_visible = models.BooleanField(default=True, db_index=True)
    fetched_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-published_at",)

    def __str__(self):
        return self.title
