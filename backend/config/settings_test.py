"""Test settings — SQLite, fast hashing, local email.

Run the suite without a MySQL server:
    python manage.py test --settings=config.settings_test

Inherits everything from the production settings, then swaps in a throwaway
SQLite database and an in-memory email backend so tests are fast and hermetic.
"""
from config.settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Speed: skip the slow production password hasher for tests.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Run Celery tasks inline (no broker/worker needed in tests).
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# The test client speaks plain HTTP.
SECURE_SSL_REDIRECT = False
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]

# Keep test output clean (the suite deliberately exercises many 4xx paths).
import logging  # noqa: E402
logging.disable(logging.CRITICAL)

# Dummy Paystack key for tests (gateway requires a non-empty secret)
PAYSTACK_SECRET_KEY = "sk_test_dummy"
PAYSTACK_PUBLIC_KEY = "pk_test_dummy"
PAYSTACK_CALLBACK_URL = "http://testserver/payment/callback"
PAYMENT_CURRENCY = "NGN"
