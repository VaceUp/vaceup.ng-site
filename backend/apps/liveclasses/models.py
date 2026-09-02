"""Live classes: an instructor schedules a session on a course; enrolled
students join within a time window and attendance is recorded."""
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel

JOIN_EARLY = timedelta(
    minutes=getattr(settings, "LIVE_CLASS_JOIN_EARLY_MINUTES", 10)
)
JOIN_GRACE = timedelta(
    minutes=getattr(settings, "LIVE_CLASS_JOIN_GRACE_MINUTES", 15)
)


class LiveClass(TimeStampedModel):
    class Provider(models.TextChoices):
        EXTERNAL = "external", _("External link (Meet/Zoom)")
        LIVEKIT = "livekit", _("Native (LiveKit)")

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", _("Scheduled")
        LIVE = "live", _("Live")
        ENDED = "ended", _("Ended")
        CANCELLED = "cancelled", _("Cancelled")

    course = models.ForeignKey(
        "courses.Course", on_delete=models.CASCADE, related_name="live_classes"
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    scheduled_start = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    provider = models.CharField(
        max_length=20, choices=Provider.choices, default=Provider.EXTERNAL
    )
    # External providers store the meeting link; LiveKit stores a room name and
    # mints a per-user token at join time.
    join_url = models.URLField(blank=True)
    room_name = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.SCHEDULED, db_index=True,
    )
    # Optional R2 key of the recording, played back via a signed URL.
    recording_key = models.CharField(max_length=500, blank=True)
    # Recording metadata
    recording_started_at = models.DateTimeField(null=True, blank=True)
    recording_ended_at = models.DateTimeField(null=True, blank=True)
    recording_status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("processing", "Processing"),
            ("ready", "Ready"),
            ("failed", "Failed"),
        ],
        default="pending",
        blank=True,
    )
    # Breakout room metadata (JSON)
    breakout_metadata = models.JSONField(default=dict, blank=True)
    # Set once the pre-class reminder emails have been enqueued (idempotency).
    reminder_sent = models.BooleanField(default=False)

    class Meta:
        ordering = ("scheduled_start",)
        indexes = [
            models.Index(fields=["course", "scheduled_start"]),
            models.Index(fields=["status", "scheduled_start"]),
        ]

    def __str__(self):
        return f"{self.title} @ {self.scheduled_start:%Y-%m-%d %H:%M}"

    @property
    def scheduled_end(self):
        return self.scheduled_start + timedelta(minutes=self.duration_minutes)

    @property
    def join_opens_at(self):
        return self.scheduled_start - JOIN_EARLY

    def is_joinable(self, now=None) -> bool:
        """Within the join window and not cancelled/ended."""
        now = now or timezone.now()
        if self.status in (self.Status.CANCELLED, self.Status.ENDED):
            return False
        return self.join_opens_at <= now <= (self.scheduled_end + JOIN_GRACE)
    
    def get_breakout_rooms(self) -> list:
        """Get configured breakout rooms."""
        return self.breakout_metadata.get('breakout_rooms', [])
    
    def create_breakout_rooms(self, count: int = 3, prefix: str = "breakout") -> list:
        """Create breakout rooms for this class."""
        rooms = []
        base_name = self.room_name or f"class-{self.id}"
        for i in range(count):
            room_name = f"{self.room_name or f'class-{self.id}'}-breakout-{i+1}"
            rooms.append({
                "name": room_name,
                "display_name": f"Breakout Room {i+1}",
                "max_participants": 10,
                "created_at": timezone.now().isoformat(),
            })
        
        self.breakout_metadata = self.breakout_metadata or {}
        self.breakout_metadata['breakout_rooms'] = rooms
        self.save(update_fields=['breakout_metadata'])
        return rooms
    
    def close_breakout_rooms(self) -> bool:
        """Close all breakout rooms."""
        self.breakout_metadata = {}
        self.save(update_fields=['breakout_metadata'])
        return True
    
    def start_recording(self) -> bool:
        """Mark recording as started."""
        self.recording_started_at = timezone.now()
        self.recording_status = "processing"
        self.save(update_fields=['recording_started_at', 'recording_status'])
        return True
    
    def end_recording(self, recording_key: str = None) -> bool:
        """Mark recording as ended."""
        self.recording_ended_at = timezone.now()
        self.recording_status = "processing"
        if recording_key:
            self.recording_key = recording_key
        self.save(update_fields=['recording_ended_at', 'recording_status', 'recording_key'])
        return True
    
    def mark_recording_ready(self, recording_key: str) -> bool:
        """Mark recording as ready for playback."""
        self.recording_key = recording_key
        self.recording_status = "ready"
        self.save(update_fields=['recording_key', 'recording_status'])
        return True
    
    def mark_recording_failed(self) -> bool:
        """Mark recording as failed."""
        self.recording_status = "failed"
        self.save(update_fields=['recording_status'])
        return True
    
    def get_recording_playback_url(self, user, expires_in: int = 3600) -> str | None:
        """Generate a signed playback URL for the recording.
        
        Returns a signed URL that expires after the specified seconds.
        Only returns a URL if the recording is ready and user has access.
        """
        if self.recording_status != "ready" or not self.recording_key:
            return None
        
        # Check if user has access to this recording
        if not self._user_has_recording_access(user):
            return None
        
        # Generate signed URL for the recording
        from apps.core.storage import presigned_download_url
        return presigned_download_url(self.recording_key, expires_in=expires_in)
    
    def _user_has_recording_access(self, user) -> bool:
        """Check if user has access to the recording."""
        # Admins and instructors of the course have access
        if user.is_admin or self.course.instructor_id == user.id:
            return True
        
        # Check if student was enrolled and attended
        from apps.enrollment.models import Enrollment
        from apps.liveclasses.models import Attendance
        
        is_enrolled = Enrollment.objects.filter(
            student=user,
            course=self.course,
            status__in=[Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED]
        ).exists()
        
        if not is_enrolled:
            return False
        
        # Check if student attended the live class
        attended = Attendance.objects.filter(
            live_class=self,
            student=user
        ).exists()
        
        # Students who attended have access
        return attended


class Attendance(TimeStampedModel):
    """One row per student per class, created when they first join."""

    live_class = models.ForeignKey(
        "liveclasses.LiveClass", on_delete=models.CASCADE,
        related_name="attendances",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="attendances",
    )
    joined_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["live_class", "student"], name="uq_attendance"
            )
        ]
        indexes = [models.Index(fields=["live_class", "student"])]

    def __str__(self):
        return f"{self.student} @ {self.live_class_id}"
