"""Passenger entry point for cPanel / Truehost 'Setup Python App'.

The app's startup file must expose a WSGI callable named ``application``.
"""
import os
import sys

# Make the project root (this file's directory) importable.
sys.path.insert(0, os.path.dirname(__file__))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from config.wsgi import application  # noqa: E402  (must follow sys.path setup)
