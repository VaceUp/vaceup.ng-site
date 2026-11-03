"""Meetings between the academy's own people, held inside VaceUp.

An administrator or a tutor calls a colleague rather than trading Meet links
through a third party. The room itself is a LiveKit room, but it is never named
on a page or in an email: the server mints a short-lived token for the host and
for the people they invited, and that token is the only way in.
"""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel

User = get_user_model()

# A meeting can be opened a little before its hour, so nobody is locked out by
# arriving early, and it stays open after it so a call that overruns is not cut.
MEETING_LEAD = timedelta(
    minutes=getattr(settings, "MEETING_LEAD_MINUTES", 15)
)
MEETING_GRACE = timedelta(
    minutes=getattr(settings, "MEETING_GRACE_MINUTES", 30)
)
# A token outlives the window it was minted for, so a dropped connection does
# not need a fresh sign-in. It is still short: a meeting must not hand out a
# key that keeps working for a week.
TOKEN_SLACK = timedelta(minutes=30)
MIN_TOKEN_TTL = 900
MAX_TOKEN_TTL = 24 * 3600

MAX_INVITEES = 25


def _room_secret():
    return secrets.token_urlsafe(18)


def _moment(value):
    local = timezone.localtime(value)
    return f"{local:%A %d %B %Y} at {local.strftime('%I:%M %p').lstrip('0')}"


class MeetingQuerySet(models.QuerySet):
    def visible_to(self, user):
        """Only the people in the meeting ever see that it exists."""
        if not user.is_authenticated:
            return self.none()
        return self.filter(
            models.Q(host=user) | models.Q(participants__user=user)
        ).distinct()


class Meeting(TimeStampedModel):
    """One staff call: who hosts it, who was invited, and when it is open."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", _("Scheduled")
        ENDED = "ended", _("Ended")
        CANCELLED = "cancelled", _("Cancelled")

    title = models.CharField(max_length=150)
    agenda = models.TextField(
        blank=True,
        help_text="Optional. Goes in the invitation so people arrive knowing why.",
    )
    host = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="meetings_hosted",
        limit_choices_to={"is_active": True},
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED,
        db_index=True,
    )
    starts_at = models.DateTimeField(default=timezone.now, db_index=True)
    duration_minutes = models.PositiveIntegerField(default=45)
    ended_at = models.DateTimeField(null=True, blank=True, editable=False)
    # LiveKit guards a room by its name, so the name carries a code no one
    # outside this meeting has. It is never shown to attendees.
    room_secret = models.CharField(
        max_length=64, blank=True, default=_room_secret, editable=False,
    )

    objects = MeetingQuerySet.as_manager()

    class Meta:
        ordering = ("-starts_at",)
        indexes = [models.Index(fields=["status", "starts_at"])]

    def __str__(self):
        return f"{self.title} ({self.starts_at:%Y-%m-%d %H:%M})"

    @property
    def ends_at(self):
        return self.starts_at + timedelta(minutes=self.duration_minutes)

    @property
    def opens_at(self):
        return self.starts_at - MEETING_LEAD

    @property
    def closes_at(self):
        return self.ends_at + MEETING_GRACE

    @property
    def room_name(self):
        """The LiveKit room this meeting runs in. Never derived from the title."""
        return f"vaceup-meeting-{self.pk}-{self.room_secret}"[:120]

    @property
    def is_open_now(self):
        return self.status == self.Status.SCHEDULED and timezone.now() <= self.closes_at

    def state_for(self, user, at=None):
        """Whether this person may walk in right now, and why not if they may not.

        The host is never locked out: they may open the room early to check it,
        and may get back in after the window if the call simply ran long. Someone
        invited to the meeting is held to the window.
        """
        at = at or timezone.now()
        is_host = self.host_id == user.pk
        if self.status == self.Status.CANCELLED:
            return {"can_enter": False, "is_host": is_host,
                    "reason": "This meeting was called off."}
        if self.status == self.Status.ENDED and not is_host:
            return {"can_enter": False, "is_host": False,
                    "reason": "This meeting has finished."}
        if at < self.opens_at:
            return {"can_enter": is_host, "is_host": is_host,
                    "reason": f"The room opens at {_moment(self.opens_at)}."}
        if at > self.closes_at and not is_host:
            return {"can_enter": False, "is_host": False,
                    "reason": "This meeting's window has passed."}
        return {"can_enter": True, "is_host": is_host, "reason": ""}

    def token_ttl(self, at=None):
        """Seconds of validity, long enough to outlast the window and a blip."""
        at = at or timezone.now()
        horizon = max(self.closes_at, at)
        needed = int((horizon - at).total_seconds() + TOKEN_SLACK.total_seconds())
        return max(MIN_TOKEN_TTL, min(needed, MAX_TOKEN_TTL))

    def invited_users(self):
        return User.objects.filter(
            meeting_invitations__meeting=self
        ).order_by("full_name", "email")


class MeetingParticipant(TimeStampedModel):
    """One person invited to one meeting. Being on this list is the access."""

    meeting = models.ForeignKey(
        Meeting, on_delete=models.CASCADE, related_name="participants"
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="meeting_invitations"
    )
    invited_at = models.DateTimeField(null=True, blank=True, editable=False)
    joined_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["meeting", "user"], name="meeting_invitee_is_listed_once"
            )
        ]

    def __str__(self):
        return f"{self.user} in meeting {self.meeting_id}"
