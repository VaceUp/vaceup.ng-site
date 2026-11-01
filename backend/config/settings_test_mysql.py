"""Isolated CI MySQL database; never use these settings on the live server."""
from config.settings_test import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env("DB_NAME", default="vaceup_ci"),
        "USER": env("DB_USER", default="root"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="127.0.0.1"),
        "PORT": env("DB_PORT", default="3306"),
        "OPTIONS": {"charset": "utf8mb4", "init_command": "SET sql_mode='STRICT_TRANS_TABLES'"},
    },
}

# [ci-diag] temporary: print the code path that marks the transaction broken.
import sys  # noqa: E402
import traceback  # noqa: E402
from django.db.backends.base.base import BaseDatabaseWrapper  # noqa: E402


def _needs_rollback_get(self):
    return self.__dict__.get("_needs_rollback", False)


def _needs_rollback_set(self, value):
    if value and not self.__dict__.get("_needs_rollback", False):
        print("[ci-diag] needs_rollback=True from:", file=sys.stderr, flush=True)
        traceback.print_stack(file=sys.stderr)
    self.__dict__["_needs_rollback"] = value


BaseDatabaseWrapper.needs_rollback = property(_needs_rollback_get, _needs_rollback_set)
