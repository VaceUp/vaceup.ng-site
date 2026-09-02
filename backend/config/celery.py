"""Celery application for VaceUp (async email + scheduled reminders).

Run in production alongside the web server:
    celery -A config worker -l info
    celery -A config beat   -l info        # periodic reminders

Config is read from Django settings under the ``CELERY_`` namespace.
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("vaceup")
# All CELERY_* Django settings become Celery config (namespace strips the prefix).
app.config_from_object("django.conf:settings", namespace="CELERY")
# Discover tasks.py in every installed app.
app.autodiscover_tasks()
