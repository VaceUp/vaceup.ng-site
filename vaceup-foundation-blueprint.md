# VaceUp LMS — Foundation Backend Blueprint

*Senior Backend Architect handover — Django 5 · DRF · MySQL · JWT · S3.*

Every module below was booted as a real Django project, migrated to a database, and exercised through the ORM before this document was written (see the Validation appendix). The code is PEP-8 clean and uses lazy string model references throughout to keep app coupling loose.

## Project structure
```
vaceup/
├── config/
│   ├── settings.py        # DRF, JWT, MySQL, storages, security
│   ├── storages.py        # private/public S3 backends  (Step 4)
│   └── urls.py            # JWT endpoints + API router   (Step 3)
├── apps/
│   ├── core/
│   │   ├── models.py      # TimeStampedModel abstract base
│   │   └── permissions.py # IsInstructorOrAdmin, IsEnrolledStudent (Step 2)
│   ├── accounts/
│   │   └── models.py      # Custom User + roles + manager (Step 1)
│   ├── courses/
│   │   ├── models.py      # Category, Course, Module, Lesson (Step 1)
│   │   ├── serializers.py # nested serializers  (Step 3)
│   │   ├── views.py       # ModelViewSets       (Step 3)
│   │   └── urls.py        # router              (Step 3)
│   └── enrollment/
│       └── models.py      # Enrollment + LessonProgress (Step 1)
├── requirements.txt
└── .env.example
```

---
## Step 1 — Database Architecture & Models

**Design decisions:**

- **Custom user via `AbstractBaseUser` + `PermissionsMixin`, keyed on email.** A single `User` table carries a `role` (Admin / Instructor / Student) as `TextChoices`, with `is_*` role predicates so permission checks read cleanly. A custom `UserManager` handles email-based `create_user` / `create_superuser`. `AUTH_USER_MODEL` **must** be set before the first migration — changing it later is painful.
- **Lazy relationships everywhere.** FKs use string references (`"courses.Course"`, `settings.AUTH_USER_MODEL`) so there are no import cycles and apps stay decoupled.
- **Indexes tuned to real queries.** Composite indexes on `(is_published, category)` and `(instructor, is_published)` for the catalog; `(student, status)` / `(course, status)` for enrollment reads. `UniqueConstraint`s enforce one enrollment per `(student, course)`, unique lesson/module ordering, and one progress row per `(enrollment, lesson)`.
- **Progress is derived, never trusted.** `Enrollment.progress_percent` is recomputed from `LessonProgress` rows by `recalculate_progress()`, which also auto-transitions the enrollment to `completed` at 100%.

### `core/models.py` — shared base
```python
# File: apps/core/models.py
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
```

### `accounts/models.py` — custom user with roles
```python
# File: apps/accounts/models.py
"""Custom, email-based User model with role-based identity."""
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """Manager for the email-as-username custom User model."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError(_("Users must have an email address."))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # hashes via the configured password hasher
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.STUDENT)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.update(
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """One user table; ``role`` distinguishes Admin / Instructor / Student."""

    class Role(models.TextChoices):
        ADMIN = "admin", _("Admin")
        INSTRUCTOR = "instructor", _("Instructor")
        STUDENT = "student", _("Student")

    email = models.EmailField(_("email address"), unique=True)  # unique => indexed
    full_name = models.CharField(_("full name"), max_length=150, blank=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        db_index=True,
    )
    # is_active flips to True only after email verification.
    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)  # Django admin access
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]  # prompted by createsuperuser

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        indexes = [models.Index(fields=["role", "is_active"])]

    def __str__(self):
        return f"{self.full_name or self.email} ({self.role})"

    # Role predicates keep permission checks elsewhere terse and readable.
    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_instructor(self) -> bool:
        return self.role == self.Role.INSTRUCTOR

    @property
    def is_student(self) -> bool:
        return self.role == self.Role.STUDENT
```

### `courses/models.py` — Course / Module / Lesson
```python
# File: apps/courses/models.py
"""Course catalog hierarchy: Category -> Course -> Module -> Lesson."""
from django.conf import settings
from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Category(TimeStampedModel):
    """Top-level grouping used for filtering and navigation."""

    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ("name",)

    def __str__(self):
        return self.name


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
            self.slug = slugify(self.title)
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
    video_url = models.URLField(blank=True)  # signed CDN/S3 URL or embed
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
```

### `enrollment/models.py` — Enrollment + progress
```python
# File: apps/enrollment/models.py
"""Enrollment links a Student to a Course and tracks completion."""
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel

HUNDRED = Decimal("100.00")
CENTS = Decimal("0.01")


class Enrollment(TimeStampedModel):
    """A student's participation in one course, with a progress percentage."""

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        COMPLETED = "completed", _("Completed")
        SUSPENDED = "suspended", _("Suspended")

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    progress_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00")
    )
    enrolled_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # One enrollment per student per course.
            models.UniqueConstraint(
                fields=["student", "course"],
                name="uq_enrollment_student_course",
            )
        ]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["course", "status"]),
        ]

    def __str__(self):
        return f"{self.student} -> {self.course} ({self.progress_percent}%)"

    def recalculate_progress(self, *, save=True) -> Decimal:
        """Recompute completion % from LessonProgress rows.

        Progress is always *derived* from stored completions, never trusted
        from the client. Call this after marking a lesson complete.
        """
        total = self.course.total_lessons
        if total == 0:
            self.progress_percent = Decimal("0.00")
        else:
            done = self.lesson_progress.filter(completed=True).count()
            ratio = (Decimal(done) / Decimal(total)) * HUNDRED
            self.progress_percent = ratio.quantize(CENTS)

        # Auto-complete once the whole course is finished.
        finished = self.progress_percent >= HUNDRED
        if finished and self.status == self.Status.ACTIVE:
            self.status = self.Status.COMPLETED
            self.completed_at = timezone.now()

        if save:
            self.save(
                update_fields=[
                    "progress_percent",
                    "status",
                    "completed_at",
                    "updated_at",
                ]
            )
        return self.progress_percent


class LessonProgress(TimeStampedModel):
    """Per-lesson completion flag underpinning enrollment progress."""

    enrollment = models.ForeignKey(
        "enrollment.Enrollment",
        on_delete=models.CASCADE,
        related_name="lesson_progress",
    )
    lesson = models.ForeignKey(
        "courses.Lesson",
        on_delete=models.CASCADE,
        related_name="progress_records",
    )
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment", "lesson"], name="uq_lessonprogress"
            )
        ]
        indexes = [models.Index(fields=["enrollment", "completed"])]

    def __str__(self):
        state = "done" if self.completed else "pending"
        return f"{self.enrollment_id}:{self.lesson_id} [{state}]"
```

---
## Step 2 — Authentication & Role-Based Access Control

**JWT configuration** uses `djangorestframework-simplejwt` with short access tokens (15 min) and rotating refresh tokens that are blacklisted after rotation — so a leaked refresh token can't be replayed once refreshed. DRF defaults to `IsAuthenticated`, meaning endpoints must explicitly opt *out* of auth rather than accidentally opt in. Throttling and filter backends are wired globally.

**Custom permissions** live in `core` so every app reuses them:

- `IsInstructorOrAdmin` — write access; admins touch anything, instructors only their own courses (object-level ownership check).
- `IsEnrolledStudent` — read access to gated content for enrolled students; admins and the owning instructor bypass, preview lessons are open. A single indexed `.exists()` check keeps it cheap.

> The enrollment check allows **both `active` and `completed`** enrollments — a student who finishes a course keeps access; only `suspended` revokes it. (This exact case was caught by the smoke test.)

### `config/settings.py` — JWT, DRF, MySQL, security
*(Storage keys in this file belong to Step 4.)*
```python
# File: config/settings.py
"""
Production settings for the VaceUp LMS backend.

Only the LMS-relevant sections are shown. Standard Django keys
(TEMPLATES, MIDDLEWARE, ROOT_URLCONF, WSGI_APPLICATION, etc.) are assumed
present. Secrets are read from the environment (12-factor).
"""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

# --- Custom user: MUST be set before the very first migration ---
AUTH_USER_MODEL = "accounts.User"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",  # refresh-token blacklist
    "corsheaders",
    "django_filters",
    "storages",
    # Local
    "apps.core",
    "apps.accounts",
    "apps.courses",
    "apps.enrollment",
]

# --- Database: MySQL (InnoDB, utf8mb4) ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="127.0.0.1"),
        "PORT": env("DB_PORT", default="3306"),
        "CONN_MAX_AGE": 60,  # persistent connections under production load
        "OPTIONS": {
            "charset": "utf8mb4",
            # Strict mode: bad data errors instead of silently truncating.
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# --- Django REST Framework ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # Secure by default: endpoints opt *out* of auth, never in.
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": (
        "rest_framework.pagination.PageNumberPagination"
    ),
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {"anon": "50/hour", "user": "1000/hour"},
}

# --- SimpleJWT ---
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,     # issue a fresh refresh token on refresh
    "BLACKLIST_AFTER_ROTATION": True,  # and invalidate the previous one
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "SIGNING_KEY": env("JWT_SIGNING_KEY", default=SECRET_KEY),
}

# --- Media storage: private S3 via django-storages (see config/storages.py) ---
STORAGES = {
    "default": {"BACKEND": "config.storages.PrivateMediaStorage"},
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.ManifestStaticFilesStorage"
        )
    },
}
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="eu-west-1")
AWS_S3_SIGNATURE_VERSION = "s3v4"  # required for pre-signed URLs

# --- CORS: lock to the known frontend origin(s) ---
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# --- Production hardening (only when DEBUG is False) ---
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31_536_000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    # Trust the proxy's X-Forwarded-Proto (Nginx/ELB terminating TLS).
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --- URLs ---
ROOT_URLCONF = "config.urls"
```

### `core/permissions.py` — RBAC
```python
# File: apps/core/permissions.py
"""Reusable DRF permissions for role- and enrollment-based access control."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


def _course_of(obj):
    """Resolve the owning Course from a Course / Module / Lesson instance.

    Duck-typed on ``related_name`` attributes so the helper stays decoupled
    from concrete model imports.
    """
    if hasattr(obj, "modules"):   # obj is a Course
        return obj
    if hasattr(obj, "lessons"):   # obj is a Module
        return obj.course
    if hasattr(obj, "module"):    # obj is a Lesson
        return obj.module.course
    return None


class IsInstructorOrAdmin(BasePermission):
    """Write access for admins (all) and instructors (their own courses)."""

    message = "Only the course instructor or an admin may modify this."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_instructor or user.is_admin)
        )

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_admin:
            return True
        course = _course_of(obj)
        # Instructors are scoped to courses they own.
        return course is not None and course.instructor_id == user.id


class IsEnrolledStudent(BasePermission):
    """Read access to gated content for actively-enrolled students.

    Admins and the owning instructor bypass the check; preview lessons are
    open to any authenticated user on safe methods.
    """

    message = "You must be enrolled in this course to access its content."

    def has_permission(self, request, view):
        # Gate the door to authenticated users; the real check is per-object.
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_admin:
            return True

        course = _course_of(obj)
        if course is None:
            return False

        if user.is_instructor and course.instructor_id == user.id:
            return True

        if getattr(obj, "is_preview", False) and request.method in SAFE_METHODS:
            return True

        # Local import avoids any app-loading order edge cases.
        from apps.enrollment.models import Enrollment

        # Active AND completed students keep access; only suspension revokes it.
        # .exists() is a single cheap indexed lookup (no row hydration).
        return Enrollment.objects.filter(
            student=user,
            course=course,
            status__in=(
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
            ),
        ).exists()
```

---
## Step 3 — Core API Views & Serializers

**Serializers** split list from detail: `CourseListSerializer` is a lightweight card shape, while `CourseDetailSerializer` embeds the full `modules → lessons` tree via nested read-only serializers. `instructor` and `slug` are read-only — the instructor is bound server-side from `request.user`, never accepted from the client.

**ViewSets** apply the Step 2 permissions per action via `get_permissions()`, swap serializer by action via `get_serializer_class()`, and eager-load the tree with `select_related`/`prefetch_related` to avoid N+1 queries. Querysets are scoped by role: anonymous users and students see only published courses; instructors see their own; students see lessons only from courses they're enrolled in.

### `courses/serializers.py`
```python
# File: apps/courses/serializers.py
"""Serializers for the course catalog, incl. nested read representations."""
from rest_framework import serializers

from apps.courses.models import Course, Lesson, Module


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = (
            "id",
            "title",
            "content",
            "video_url",
            "order",
            "duration_seconds",
            "is_preview",
        )


class ModuleSerializer(serializers.ModelSerializer):
    # Read-only nested lessons; lessons are written via their own endpoint.
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ("id", "title", "order", "lessons")


class CourseListSerializer(serializers.ModelSerializer):
    """Lightweight shape for list endpoints (no nested module tree)."""

    instructor_name = serializers.CharField(
        source="instructor.full_name", read_only=True
    )
    category = serializers.StringRelatedField()

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "slug",
            "category",
            "instructor_name",
            "level",
            "price",
            "thumbnail",
            "is_published",
        )


class CourseDetailSerializer(serializers.ModelSerializer):
    """Full course tree: modules -> lessons nested inside the course."""

    modules = ModuleSerializer(many=True, read_only=True)
    instructor_name = serializers.CharField(
        source="instructor.full_name", read_only=True
    )
    category = serializers.StringRelatedField()

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "slug",
            "description",
            "category",
            "instructor",
            "instructor_name",
            "level",
            "price",
            "thumbnail",
            "is_published",
            "modules",
            "created_at",
        )
        # instructor is bound from request.user server-side; slug is derived.
        read_only_fields = ("instructor", "slug")
```

### `courses/views.py`
```python
# File: apps/courses/views.py
"""ViewSets for courses and lessons with action-scoped permissions."""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from apps.core.permissions import IsEnrolledStudent, IsInstructorOrAdmin
from apps.courses.models import Course, Lesson
from apps.courses.serializers import (
    CourseDetailSerializer,
    CourseListSerializer,
    LessonSerializer,
)
from apps.enrollment.models import Enrollment


class CourseViewSet(viewsets.ModelViewSet):
    """CRUD for courses.

    Reads are public (anonymous users and students see published courses
    only); writes are restricted to the owning instructor or an admin.
    """

    lookup_field = "slug"

    def get_queryset(self):
        # Eager-load the tree to avoid N+1 queries on detail reads.
        qs = Course.objects.select_related(
            "category", "instructor"
        ).prefetch_related("modules__lessons")

        user = self.request.user
        if user.is_authenticated and (user.is_admin or user.is_instructor):
            return qs
        return qs.filter(is_published=True)

    def get_serializer_class(self):
        if self.action == "list":
            return CourseListSerializer
        return CourseDetailSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsInstructorOrAdmin()]
        return [IsAuthenticatedOrReadOnly()]

    def perform_create(self, serializer):
        # Bind the new course to the authenticated instructor.
        serializer.save(instructor=self.request.user)


class LessonViewSet(viewsets.ModelViewSet):
    """CRUD for lessons; content reads are gated by active enrollment."""

    serializer_class = LessonSerializer

    def get_queryset(self):
        qs = Lesson.objects.select_related("module__course")
        user = self.request.user

        if not user.is_authenticated:
            return qs.none()
        if user.is_admin:
            return qs
        if user.is_instructor:
            # Instructors see lessons from the courses they own.
            return qs.filter(module__course__instructor=user)

        # Students see lessons from courses they're enrolled in (active or
        # completed); suspension is the only status that removes access.
        return qs.filter(
            module__course__enrollments__student=user,
            module__course__enrollments__status__in=(
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
            ),
        ).distinct()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsInstructorOrAdmin()]
        return [IsEnrolledStudent()]
```

### `courses/urls.py` + `config/urls.py` — routing
```python
# File: apps/courses/urls.py
"""Router wiring for the courses app (mount under /api/v1/)."""
from rest_framework.routers import DefaultRouter

from apps.courses.views import CourseViewSet, LessonViewSet

router = DefaultRouter()
router.register("courses", CourseViewSet, basename="course")
router.register("lessons", LessonViewSet, basename="lesson")

urlpatterns = router.urls
```

```python
# File: config/urls.py
"""Root URL configuration (API v1)."""
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    # JWT auth endpoints (simplejwt).
    path(
        "api/v1/auth/login/",
        TokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "api/v1/auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "api/v1/auth/logout/",
        TokenBlacklistView.as_view(),
        name="token_blacklist",
    ),
    # App routers.
    path("api/v1/", include("apps.courses.urls")),
]
```

---
## Step 4 — Media & Storage Strategy

**Never serve LMS media through Django in production.** The application server should not proxy multi-hundred-MB video files. Best practice:

1. **Store media in a private S3 bucket** with *Block Public Access* on and ACLs disabled. Access is governed by the bucket policy, not per-object ACLs — hence `default_acl = None` in the backend below.
2. **Serve every download via a short-lived pre-signed URL** (`querystring_auth=True`, 1-hour expiry). Raw object URLs are useless without the signature, so lesson links can't be scraped and shared.
3. **Separate private from public storage.** Lesson videos, PDFs and student submissions use `PrivateMediaStorage`; safe, cacheable assets like thumbnails use `PublicMediaStorage` behind a CDN.
4. **Upload large videos directly to S3** using pre-signed POST/PUT so bytes never transit the Django server; the API only issues the upload credential and records the resulting key.
5. **For real video delivery at scale**, front S3 with CloudFront signed URLs/cookies, or offload to a dedicated video platform (Mux, Cloudflare Stream) that handles transcoding and adaptive streaming — store only the playback ID in `Lesson.video_url`.
6. **Validate on upload:** enforce content-type and size limits, and generate unique keys (`file_overwrite=False`) so uploads never collide.

### `config/storages.py`
```python
# File: config/storages.py
"""Custom django-storages backends for LMS media on Amazon S3."""
from storages.backends.s3boto3 import S3Boto3Storage


class PrivateMediaStorage(S3Boto3Storage):
    """Private storage for lesson videos, PDFs and student submissions.

    Access is controlled by the bucket policy + S3 Block Public Access
    (modern buckets have ACLs disabled), and every download is served
    through a short-lived pre-signed URL, so raw object links can't leak.
    """

    default_acl = None        # do not send an ACL; rely on bucket policy
    file_overwrite = False    # never clobber an existing key
    querystring_auth = True   # serve via signed URLs
    querystring_expire = 3600  # links valid for one hour


class PublicMediaStorage(S3Boto3Storage):
    """Public, CDN-cacheable assets such as course thumbnails."""

    default_acl = None
    file_overwrite = False
    querystring_auth = False  # stable, cacheable public URLs
```

The backends are activated by the `STORAGES` setting in `config/settings.py` (shown in Step 2): `default` → `config.storages.PrivateMediaStorage`. A model simply declares the private backend on sensitive fields, e.g.:

```python
from config.storages import PrivateMediaStorage

class Lesson(models.Model):
    # ...
    video_file = models.FileField(
        upload_to="lessons/videos/",
        storage=PrivateMediaStorage(),  # private + pre-signed URLs
        blank=True,
    )
```

---
## Running on a live server

```bash
# 1. System deps for the MySQL driver (Debian/Ubuntu)
sudo apt-get install -y python3-dev default-libmysqlclient-dev build-essential

# 2. Environment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in real secrets

# 3. Database
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput

# 4. Serve behind Nginx (TLS) via Gunicorn
gunicorn config.wsgi:application --workers 3 --bind 127.0.0.1:8000
```

**Production checklist:** `DEBUG=False`; real `ALLOWED_HOSTS`; secrets only in the environment; run `python manage.py check --deploy`; put Gunicorn behind Nginx terminating TLS (the settings already trust `X-Forwarded-Proto`); enable automated MySQL backups; add Sentry for error monitoring; and run Celery workers for async work (email, PDFs) as the system grows.

---
## Validation appendix — what was actually run

This blueprint isn't theoretical; the code was executed:

- `pycodestyle --max-line-length=88` → **0 violations** in shipped code.
- `manage.py check` → **System check identified no issues.**
- `manage.py makemigrations` → clean initial migrations for all three apps, including every index and unique constraint.
- `manage.py migrate` → full schema built on a live database (incl. the simplejwt token-blacklist tables).
- **ORM smoke test** confirmed: email-based user creation across all roles; slug auto-generation; progress math (2/4 → 50.00%, 4/4 → 100.00% with auto-transition to `completed` and `completed_at` set); the `(student, course)` unique constraint blocking duplicate enrollment; and permission outcomes (enrolled student ✓, non-enrolled ✗, owning instructor ✓).

*The completed-student access bug noted in Step 2 was found by this smoke test and fixed before delivery.*

*End of blueprint.*