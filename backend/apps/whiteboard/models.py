"""Whiteboard models for real-time collaborative drawing."""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class WhiteboardSession(TimeStampedModel):
    """A collaborative whiteboard session (typically tied to a LiveClass)."""

    room_id = models.UUIDField(unique=True, db_index=True)
    # CRDT state for the whiteboard (Yjs/Automerge binary)
    crdt_state = models.BinaryField(null=True, blank=True)
    version = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["room_id", "is_active"]),
        ]

    def __str__(self):
        return f"WhiteboardSession({self.room_id})"


class WhiteboardStroke(TimeStampedModel):
    """Individual stroke on the whiteboard for replay/history."""

    class Tool(models.TextChoices):
        PEN = "pen", _("Pen")
        HIGHLIGHTER = "highlighter", _("Highlighter")
        ERASER = "eraser", _("Eraser")
        RECT = "rect", _("Rectangle")
        CIRCLE = "circle", _("Circle")
        LINE = "line", _("Line")
        ARROW = "arrow", _("Arrow")
        TEXT = "text", _("Text")
        STICKY = "sticky", _("Sticky Note")
        LASER = "laser", _("Laser Pointer")

    room_id = models.UUIDField(db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="whiteboard_strokes",
    )
    tool = models.CharField(max_length=20, choices=Tool.choices)
    color = models.CharField(max_length=7)  # #RRGGBB
    width = models.FloatField(default=2.0)
    opacity = models.FloatField(default=1.0)
    # For freehand: [{x, y, pressure, timestamp}, ...]
    # For shapes: {x, y, width, height, rotation, text}
    points = models.JSONField()
    shape_data = models.JSONField(null=True, blank=True)
    is_eraser_stroke = models.BooleanField(default=False)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["room_id", "created_at"]),
        ]

    def __str__(self):
        return f"Stroke({self.room_id}, {self.tool})"


class WhiteboardSnapshot(TimeStampedModel):
    """Periodic full-state snapshots for fast load."""

    room_id = models.UUIDField(db_index=True)
    state_json = models.JSONField()  # Full CRDT state or serialized canvas
    version = models.PositiveIntegerField()

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["room_id", "-created_at"]),
        ]

    def __str__(self):
        return f"WhiteboardSnapshot({self.room_id}, v{self.version})"