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
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "50/hour",
        "user": "1000/hour",
        # Per-endpoint scopes for abuse-prone auth flows. NOTE: throttling is
        # only correct once the cache is a shared store (Redis/Upstash) — with
        # the default per-process LocMem cache these counters are per-worker.
        "auth_login": "10/min",
        "auth_register": "5/min",
        "auth_verify": "10/min",
        "auth_resend": "3/min",
        "auth_password_reset": "5/min",
    },
    # OpenAPI/Swagger
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Domain exceptions → consistent JSON envelope (apps/core/exceptions.py).
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
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
# Falls back to the console backend when no SMTP host is configured, so the
# verify/reset flows are fully testable in dev without a provider. Set the
# EMAIL_* / DEFAULT_FROM_EMAIL / FRONTEND_BASE_URL vars in .env for production.
EMAIL_HOST = env("EMAIL_HOST", default="")
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = env.int("EMAIL_PORT", default=587)
    EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
    EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@vaceup.ng")
# Base URL of the frontend that renders the emailed verify/reset links.
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="https://vaceup.ng")

# Token lifetimes (read by apps/accounts/models.py).
EMAIL_VERIFICATION_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)

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
STORAGES = {
    "default": {"BACKEND": "config.storages.PrivateMediaStorage"},
    "staticfiles": {
        "BACKEND": (
            "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="eu-west-1")
AWS_S3_SIGNATURE_VERSION = "s3v4"  # required for pre-signed URLs
# Set for S3-compatible providers (Cloudflare R2, Backblaze B2, Wasabi). Leave
# blank for AWS S3. R2 reuses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default="") or None

# --- CORS: lock to the known frontend origin(s) ---
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# --- Cache: Redis/Upstash when configured, else per-process memory ---------
# IMPORTANT for scale: DRF throttling and any shared locking are only correct
# with a shared cache. Set REDIS_URL (Upstash) in production; without it we
# fall back to LocMemCache, which is per-worker and NOT safe for throttling.
REDIS_URL = env("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }

# --- Django Channels (WebSockets for real-time features) --------------------
# Redis-backed channel layer for WebSocket pub/sub (code editor, whiteboard,
# notifications, presence). Requires REDIS_URL to be set.
if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        }
    }
else:
    # In-memory channel layer for dev without Redis
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# --- Celery: async email + scheduled reminders -----------------------------
# Broker/result default to the same Upstash Redis as the cache. In dev/CI with
# no worker running, set CELERY_TASK_ALWAYS_EAGER=True to run tasks inline.
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=REDIS_URL)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default=CELERY_BROKER_URL)
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
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

# --- Standard Django keys ---
MIDDLEWARE = [
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
