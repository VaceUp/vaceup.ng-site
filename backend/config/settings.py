"""
Production settings for the VaceUp LMS backend.

Only the LMS-relevant sections are shown. Standard Django keys
(TEMPLATES, MIDDLEWARE, ROOT_URLCONF, WSGI_APPLICATION, etc.) are assumed
present. Secrets are read from the environment (12-factor).
"""
from datetime import timedelta
from pathlib import Path
import ssl
from urllib.parse import unquote, urlsplit

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])
REDIS_URL = env("REDIS_URL", default="")
VACEUP_INFRASTRUCTURE = env(
    "VACEUP_INFRASTRUCTURE", default="redis" if REDIS_URL else "database",
).strip().lower()
if VACEUP_INFRASTRUCTURE not in {"database", "redis"}:
    raise ImproperlyConfigured("VACEUP_INFRASTRUCTURE must be database or redis.")
if VACEUP_INFRASTRUCTURE == "redis" and not REDIS_URL:
    raise ImproperlyConfigured("Redis infrastructure requires REDIS_URL.")

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
    "apps.payments",
    "apps.liveclasses",
    "apps.messaging",
    "apps.dashboard",
    "apps.assignments",
    "apps.applications",
    "apps.cart",
    "apps.codeeditor",
    "apps.whiteboard",
    "apps.adminpanel",
    "apps.certificates",
    "apps.marketing",
    "apps.announcements",
    "apps.website",
    "drf_spectacular",
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
        "apps.core.throttling.DatabaseAnonRateThrottle",
        "apps.core.throttling.DatabaseUserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "120/min",
        "user": "1000/hour",
        # Auth scopes use database row locks across all web workers.
        "auth_login": "10/min",
        "auth_register": "5/min",
        "auth_verify": "10/min",
        "auth_resend": "3/min",
        "auth_password_reset": "5/min",
        # Paystack retries a webhook at most a few times per event.
        "payment_webhook": "600/min",
    },
    # OpenAPI/Swagger
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Domain exceptions → consistent JSON envelope (apps/core/exceptions.py).
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    # Ignore spoofable forwarded IPs unless the trusted proxy count is explicit.
    "NUM_PROXIES": env.int("DRF_NUM_PROXIES", default=0),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "VaceUp LMS API",
    "DESCRIPTION": "VaceUp Learning Management System - Complete API Reference",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "COMPONENT_NO_READ_ONLY_REQUIRED": True,
    "SCHEMA_COERCE_PATH_PK": True,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "displayRequestDuration": True,
        "filter": True,
        "tryItOutEnabled": True,
    },
    "REDOC_SETTINGS": {
        "hideDownloadButton": False,
        "expandResponses": "all",
        "pathInMiddlePanel": True,
    },
    "TAGS": [
        {"name": "auth", "description": "Authentication & Authorization"},
        {"name": "courses", "description": "Course Catalog & Management"},
        {"name": "enrollment", "description": "Student Enrollment & Progress"},
        {"name": "assignments", "description": "Assignments, Quizzes & Grading"},
        {"name": "liveclasses", "description": "Live Classes & Breakout Rooms"},
        {"name": "payments", "description": "Payments & Enrollment"},
        {"name": "certificates", "description": "Certificates & Verification"},
        {"name": "notifications", "description": "Notifications & Announcements"},
        {"name": "marketing", "description": "Marketing Campaigns"},
        {"name": "admin", "description": "Admin Dashboard & Management"},
        {"name": "messaging", "description": "Messaging & Whiteboard"},
        {"name": "codeeditor", "description": "Code Editor & Execution"},
        {"name": "whiteboard", "description": "Whiteboard Collaboration"},
        {"name": "cart", "description": "Shopping Cart & Checkout"},
        {"name": "applications", "description": "Applications & Admissions"},
        {"name": "certificates", "description": "Certificates & Verification"},
        {"name": "website", "description": "Public Website: Events, Team & Blog"},
    ],
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

# --- Email + account lifecycle -------------------------------------------
# Never print verification/reset links to worker logs when SMTP is missing.
# Tests explicitly use locmem. Diagnose production with diagnose_email_delivery.
EMAIL_HOST = env("EMAIL_HOST", default="").strip()
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default=("django.core.mail.backends.smtp.EmailBackend" if EMAIL_HOST else
             "django.core.mail.backends.dummy.EmailBackend"),
)
# Implicit TLS (usually 465) and STARTTLS (usually 587) are different protocols.
# Explicit contradictory flags remain an error; never silently downgrade TLS.
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=not EMAIL_USE_SSL)
EMAIL_PORT = env.int("EMAIL_PORT", default=465 if EMAIL_USE_SSL else 587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=10)
# Django uses ssl.create_default_context(): hostname and certificate validation
# stay enabled. SSL_CERT_FILE/SSL_CERT_DIR can supply a trusted CA bundle.
# Explicit cPanel option when a persistent worker cannot be run. This only
# affects account mail; a broker outage never silently switches to sync.
ACCOUNT_EMAIL_DELIVERY_MODE = env(
    "ACCOUNT_EMAIL_DELIVERY_MODE",
    default="database" if VACEUP_INFRASTRUCTURE == "database" else "async",
).strip().lower()

DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@vaceup.ng")
# Django's own error mail defaults to root@localhost, which a cPanel/TrueHost
# relay rejects as an unauthorized sender. Account mail and server mail must
# come from the same address the host authorizes.
SERVER_EMAIL = env("SERVER_EMAIL", default="").strip() or DEFAULT_FROM_EMAIL
# Base URL of the frontend that renders the emailed verify/reset links.
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="https://vaceup.ng")
MARKETING_PUBLIC_API_URL = env("MARKETING_PUBLIC_API_URL", default="https://api.vaceup.ng")
ACADEMY_SITE_URL = env("ACADEMY_SITE_URL", default="https://vaceup.ng")


def _frontend_link_base(base, api_url, fallback_url):
    """Absolute origin that emailed links can actually open.

    A missing, relative or API-host base produces links that land on a "Not
    Found" page — which is exactly what a reset email must never do — so the
    value is repaired here instead of being trusted.
    """
    candidate = urlsplit(str(base).strip())
    api_host = (urlsplit(str(api_url).strip()).hostname or "").lower()
    if (candidate.scheme not in {"http", "https"} or not candidate.netloc
            or (candidate.hostname or "").lower() == api_host):
        candidate = urlsplit(str(fallback_url).strip())
        if not candidate.netloc:
            candidate = urlsplit("https://vaceup.ng")
    return f"{candidate.scheme}://{candidate.netloc}{candidate.path.rstrip('/')}"


FRONTEND_LINK_BASE = _frontend_link_base(
    FRONTEND_BASE_URL, MARKETING_PUBLIC_API_URL, ACADEMY_SITE_URL
)

# Token lifetimes (read by apps/accounts/models.py).
EMAIL_VERIFICATION_TTL = timedelta(hours=24)
# A reset link is a short-lived key to an account: keep the window small.
PASSWORD_RESET_TTL = timedelta(minutes=30)

# --- Payments: Paystack (read by apps/payments) ---
PAYSTACK_SECRET_KEY = env("PAYSTACK_SECRET_KEY", default="")
PAYSTACK_PUBLIC_KEY = env("PAYSTACK_PUBLIC_KEY", default="")
# Frontend page that receives Paystack's redirect and calls /payments/verify/.
PAYSTACK_CALLBACK_URL = env("PAYSTACK_CALLBACK_URL", default="")
PAYMENT_CURRENCY = env("PAYMENT_CURRENCY", default="NGN")

# --- Live classes (LiveKit optional; external link is the default provider) ---
LIVEKIT_API_KEY = env("LIVEKIT_API_KEY", default="")
LIVEKIT_API_SECRET = env("LIVEKIT_API_SECRET", default="")
LIVEKIT_WS_URL = env("LIVEKIT_WS_URL", default="")
LIVE_CLASS_JOIN_EARLY_MINUTES = env.int("LIVE_CLASS_JOIN_EARLY_MINUTES", default=10)
LIVE_CLASS_JOIN_GRACE_MINUTES = env.int("LIVE_CLASS_JOIN_GRACE_MINUTES", default=15)

# --- Media storage: private S3 via django-storages (see config/storages.py) ---
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
# Optional separate bucket for public assets (course covers, team photos).
# Defaults to the main bucket; that bucket must allow public reads for them.
AWS_PUBLIC_STORAGE_BUCKET_NAME = env("AWS_PUBLIC_STORAGE_BUCKET_NAME", default="")
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="eu-west-1")
AWS_S3_SIGNATURE_VERSION = "s3v4"  # required for pre-signed URLs
# Set for S3-compatible providers (Cloudflare R2, Backblaze B2, Wasabi). Leave
# blank for AWS S3. R2 reuses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
def _endpoint_url(raw):
    """A leftover .env.example comment is not an endpoint, so it counts as unset."""
    value = str(raw).strip()
    return value if value.lower().startswith(("http://", "https://")) else ""


_AWS_S3_ENDPOINT_RAW = env("AWS_S3_ENDPOINT_URL", default="")
AWS_S3_ENDPOINT_URL = _endpoint_url(_AWS_S3_ENDPOINT_RAW) or None
# Reported by apps.core.checks: a value that was set but unusable must not be
# dropped in silence, or the operator keeps a bucket they are never using.
AWS_S3_ENDPOINT_REJECTED = bool(_AWS_S3_ENDPOINT_RAW.strip()) and AWS_S3_ENDPOINT_URL is None
# Delivery hostname for PUBLIC objects only (R2: media.vaceup.ng). Private
# media ignores it — see config/storages.PrivateMediaStorage.
AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default="").strip() or None

# A bucket name on its own is not a usable object store: without the access
# keys every write becomes an anonymous S3 request that fails, and image
# uploads in the admin panel return a 5xx. Object storage is only selected
# when the bucket AND both keys are present; anything else is local disk.
OBJECT_STORAGE_CONFIGURED = bool(
    AWS_STORAGE_BUCKET_NAME and AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
)

# --- Public images: Cloudinary (optional, highest priority) ------------------
# CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name> is the form
# Cloudinary itself hands out; the three explicit variables are equivalent.
# Credentials win over the URL when both are present.
CLOUDINARY_URL = env("CLOUDINARY_URL", default="").strip()
CLOUDINARY_CLOUD_NAME = env("CLOUDINARY_CLOUD_NAME", default="").strip()
CLOUDINARY_API_KEY = env("CLOUDINARY_API_KEY", default="").strip()
CLOUDINARY_API_SECRET = env("CLOUDINARY_API_SECRET", default="").strip()


def _cloudinary_from_url(value):
    """api_key, api_secret, cloud_name — or blanks when the URL is not usable.

    A line pasted with its trailing note keeps the note, so a URL holding a
    space is reported rather than guessed at, and a cloud name ending in
    "  # from the dashboard" is never sent to the API.
    """
    if not value.startswith("cloudinary://"):
        return ("", "", "", bool(value))
    if any(character.isspace() for character in value):
        return ("", "", "", True)
    try:
        parsed = urlsplit(value)
    except ValueError:
        return ("", "", "", True)
    if not (parsed.username and parsed.password and parsed.hostname):
        return ("", "", "", True)
    return unquote(parsed.username), unquote(parsed.password), parsed.hostname, False


_CLOUD_KEY, _CLOUD_SECRET, _CLOUD_NAME, CLOUDINARY_URL_REJECTED = _cloudinary_from_url(CLOUDINARY_URL)
CLOUDINARY_API_KEY = CLOUDINARY_API_KEY or _CLOUD_KEY
CLOUDINARY_API_SECRET = CLOUDINARY_API_SECRET or _CLOUD_SECRET
CLOUDINARY_CLOUD_NAME = CLOUDINARY_CLOUD_NAME or _CLOUD_NAME
# Prefix inside the account, so the bucket and Cloudinary keep the same layout.
CLOUDINARY_FOLDER = env("CLOUDINARY_FOLDER", default="vaceup").strip().strip("/")
# Optional own hostname (e.g. res.cloudinary.com replaced by a CNAME you own).
CLOUDINARY_SECURE_DISTRIBUTION = env("CLOUDINARY_SECURE_DISTRIBUTION", default="").strip()
CLOUDINARY_CONFIGURED = bool(
    CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET
)

MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"

# Without a configured bucket, keep media on local disk so image uploads
# still work. Only media/public is served over HTTP (see config/urls.py).
STORAGES = {
    "default": {
        "BACKEND": "config.storages.PrivateMediaStorage" if OBJECT_STORAGE_CONFIGURED
        else "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": (
            "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}
if not OBJECT_STORAGE_CONFIGURED:
    STORAGES["default"]["OPTIONS"] = {
        "location": BASE_DIR / "media" / "private",
        "base_url": "/media/private/",
    }

# --- CORS: lock to the known frontend origin(s) ---
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# --- CSRF: required by Django 4+ for admin/form POSTs served from these hosts ---
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# --- Shared cache: explicit Redis mode or a migrated database table --------
# Abuse counters are separate, transactional database rows in both modes.
if VACEUP_INFRASTRUCTURE == "redis":
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
            "LOCATION": "vaceup_cache",
        }
    }

# --- Django Channels (WebSockets for real-time features) --------------------
# Redis-backed channel layer for WebSocket pub/sub (code editor, whiteboard,
# notifications, presence). Requires REDIS_URL to be set.
WEBSOCKETS_ENABLED = env.bool("WEBSOCKETS_ENABLED", default=False)
if VACEUP_INFRASTRUCTURE == "redis":
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        }
    }
else:
    CHANNEL_LAYERS = {}
if WEBSOCKETS_ENABLED and VACEUP_INFRASTRUCTURE != "redis":
    raise ImproperlyConfigured("WebSockets require a shared channel layer. Leave WEBSOCKETS_ENABLED=False in database mode.")

# --- Celery: async email + scheduled reminders -----------------------------
# Broker/result default to the same Upstash Redis as the cache. In dev/CI with
# no worker running, set CELERY_TASK_ALWAYS_EAGER=True to run tasks inline.
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="") or (REDIS_URL if VACEUP_INFRASTRUCTURE == "redis" else "")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="") or CELERY_BROKER_URL
if CELERY_BROKER_URL.startswith("rediss://"):
    CELERY_BROKER_USE_SSL = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
if CELERY_RESULT_BACKEND.startswith("rediss://"):
    CELERY_REDIS_BACKEND_USE_SSL = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
# Bound web-request publishing when the broker is unavailable. Worker task
# retries still apply independently to SMTP delivery failures.
CELERY_BROKER_CONNECTION_TIMEOUT = 5
CELERY_TASK_PUBLISH_RETRY_POLICY = {"max_retries": 1, "interval_start": 0, "interval_step": 0, "interval_max": 0}
CELERY_BROKER_TRANSPORT_OPTIONS = {"socket_connect_timeout": 5, "socket_timeout": 5}
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
# The deployed workers consume "emails", not Celery's default "celery" queue.
CELERY_TASK_ROUTES = {"accounts.*": {"queue": "emails"}}
CELERY_ENABLE_UTC = True
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
# How far ahead of a class to send reminder emails, and how often beat scans.
LIVE_CLASS_REMINDER_LEAD_MINUTES = env.int(
    "LIVE_CLASS_REMINDER_LEAD_MINUTES", default=30
)
CELERY_BEAT_SCHEDULE = {
    "live-class-reminders": {
        "task": "liveclasses.send_live_class_reminders",
        "schedule": float(env.int("LIVE_CLASS_REMINDER_SCAN_SECONDS", default=300)),
    },
    "blogger-sync": {
        "task": "website.sync_blogger_posts",
        "schedule": float(env.int("BLOGGER_SYNC_SECONDS", default=900)),
    },
}

# --- Sentry error monitoring (only when a DSN is provided) -----------------
SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration()],
            environment=env("SENTRY_ENVIRONMENT", default="production"),
            traces_sample_rate=env.float(
                "SENTRY_TRACES_SAMPLE_RATE", default=0.1
            ),
            send_default_pii=False,  # don't ship user PII to Sentry
            include_local_variables=False,  # mail stack frames contain account links
        )
    except ImportError:
        # sentry-sdk not installed; skip rather than crash the app.
        pass

# --- Logging: structured console output (captured by the host/PaaS) --------
# Level via LOG_LEVEL (default INFO). Everything goes to stdout/stderr so the
# platform (systemd/journald, Docker, PaaS, cPanel logs) collects it; Sentry
# captures ERROR+ separately once its DSN is set.
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(asctime)s %(levelname)s %(name)s "
                      "%(module)s:%(lineno)d %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        # Surface 4xx/5xx and unhandled request errors.
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        # Our own apps.
        "apps": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}

# --- Production hardening (only when DEBUG is False) ---
if not DEBUG:
    # Configurable: set SECURE_SSL_REDIRECT=False in .env if cPanel already
    # forces HTTPS at the domain level (prevents a redirect loop).
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31_536_000)  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
    SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_HTTPONLY = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    # Send less referrer detail to third parties (the site links out to Paystack).
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    X_FRAME_OPTIONS = "DENY"
    # Trust the proxy's X-Forwarded-Proto (Cloudflare terminates TLS).
    # apps.core.middleware.TrustedProxySchemeMiddleware removes the header
    # first unless the request really came from Cloudflare or this host.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --- Request size limits -------------------------------------------------
# Django's 2.5 MB default is fine for our largest legitimate upload (a course
# cover image). Bigger bodies are rejected before they reach a view.
FILE_UPLOAD_MAX_MEMORY_SIZE = env.int("FILE_UPLOAD_MAX_MEMORY_SIZE", default=2_621_440)
DATA_UPLOAD_MAX_MEMORY_SIZE = env.int("DATA_UPLOAD_MAX_MEMORY_SIZE", default=5_242_880)
DATA_UPLOAD_MAX_NUMBER_FIELDS = env.int("DATA_UPLOAD_MAX_NUMBER_FIELDS", default=2000)

# --- Django admin --------------------------------------------------------
# The staff login lives on a path the operator can change in .env.
def _admin_url(raw):
    """A route for django.urls.path never carries a leading slash.

    One that does can never match, so a value pasted as "/secret-door/" is
    repaired here rather than shipping an admin that 404s at every address —
    and a blank line keeps the default instead of mounting it at the site root.
    """
    return (str(raw).strip().strip("/") or "admin") + "/"


ADMIN_URL = _admin_url(env("ADMIN_URL", default="admin"))

# --- URLs ---
ROOT_URLCONF = "config.urls"

# --- Standard Django keys ---
MIDDLEWARE = [
    # Runs first: drops a spoofed X-Forwarded-Proto before SecurityMiddleware
    # decides whether the request is already HTTPS.
    "apps.core.middleware.TrustedProxySchemeMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # serves static on shared host
    "corsheaders.middleware.CorsMiddleware",  # must sit above CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation."
             "UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation."
             "MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation."
             "CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation."
             "NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
