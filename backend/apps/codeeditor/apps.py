"""Code Editor app config."""

from django.apps import AppConfig


class CodeEditorConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.codeeditor"
    verbose_name = "Code Editor"