"""Course catalog hierarchy: Category -> Course -> Module -> Lesson."""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.core.utils import unique_slug


class Category(TimeStampedModel):
    """Top-level grouping used for filtering and navigation."""

    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name, max_length=140)
        super().save(*args, **kwargs)


class Course(TimeStampedModel):
    """A sellable course owned by a single instructor."""

    class Level(models.TextChoices):
        BEGINNER = "beginner", _("Beginner")
        INTERMEDIATE = "intermediate", _("Intermediate")
        ADVANCED = "advanced", _("Advanced")

    title = models.CharField(max_length=200)
    # Unique slug is auto-indexed and used as the public lookup field.
    slug = models.SlugField(max_length=220, unique=True)
    # Lazy string references avoid import cycles and keep coupling loose.
    category = models.ForeignKey(
        "courses.Category",
        on_delete=models.PROTECT,
        related_name="courses",
    )
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="courses_taught",
        limit_choices_to={"role": "instructor"},
    )
    description = models.TextField(blank=True)
    level = models.CharField(
        max_length=20, choices=Level.choices, default=Level.BEGINNER
    )
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    thumbnail = models.ImageField(
        upload_to="course/thumbnails/", blank=True, null=True
    )
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            # Composite indexes matched to the hottest catalog queries.
            models.Index(fields=["is_published", "category"]),
            models.Index(fields=["instructor", "is_published"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title, max_length=220)
        super().save(*args, **kwargs)

    @property
    def total_lessons(self) -> int:
        """Lesson count for the whole course (drives progress math)."""
        return Lesson.objects.filter(module__course=self).count()


class Module(TimeStampedModel):
    """An ordered section of a course grouping related lessons."""

    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="modules",
    )
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=["course", "order"], name="uq_module_order"
            )
        ]
        indexes = [models.Index(fields=["course", "order"])]

    def __str__(self):
        return f"{self.course.title} - {self.title}"


class Lesson(TimeStampedModel):
    """A single unit of content: rich text and/or a video URL."""

    module = models.ForeignKey(
        "courses.Module",
        on_delete=models.CASCADE,
        related_name="lessons",
    )
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)   # markdown / rich-text body
    video_url = models.URLField(blank=True)  # external embed (YouTube/Vimeo…)
    # Object key of a video uploaded to R2/S3. Playback is served via a
    # short-lived pre-signed GET URL — the raw key is never public.
    video_key = models.CharField(max_length=500, blank=True)
    order = models.PositiveIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    # Preview lessons are viewable before enrolling (marketing hook).
    is_preview = models.BooleanField(default=False)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=["module", "order"], name="uq_lesson_order"
            )
        ]
        indexes = [models.Index(fields=["module", "order"])]

    def __str__(self):
        return self.title
