"""Code Editor models for real-time collaborative editing."""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class CodeEditorSession(TimeStampedModel):
    """A collaborative code editing session (typically tied to a LiveClass)."""

    class Language(models.TextChoices):
        PYTHON = "python", _("Python")
        JAVASCRIPT = "javascript", _("JavaScript")
        TYPESCRIPT = "typescript", _("TypeScript")
        JAVA = "java", _("Java")
        CPP = "cpp", _("C++")
        GO = "go", _("Go")
        RUST = "rust", _("Rust")
        CSHARP = "csharp", _("C#")

    room_id = models.UUIDField(unique=True, db_index=True)
    language = models.CharField(
        max_length=20, choices=Language.choices, default=Language.PYTHON
    )
    # Yjs/Automerge CRDT state as binary blob
    crdt_state = models.BinaryField(null=True, blank=True)
    version = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["room_id", "is_active"]),
        ]

    def __str__(self):
        return f"CodeEditorSession({self.room_id}, {self.language})"


class CodeExecution(TimeStampedModel):
    """Record of a code execution attempt."""

    session = models.ForeignKey(
        CodeEditorSession,
        on_delete=models.CASCADE,
        related_name="executions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="code_executions",
    )
    code = models.TextField()
    language = models.CharField(max_length=20)
    stdin = models.TextField(blank=True)
    stdout = models.TextField(blank=True)
    stderr = models.TextField(blank=True)
    exit_code = models.IntegerField(null=True)
    duration_ms = models.PositiveIntegerField(null=True)
    memory_mb = models.FloatField(null=True)
    is_success = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["session", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"CodeExecution({self.session_id}, {self.user_id})"