"""Jitsi becomes a live-room choice, and every event gains a private room code.

A Jitsi room is guarded by its name alone, so the code cannot come from a
callable default: that is evaluated once when the column is added and would hand
every existing event the same code, which is one guess away from every other
event's room. So the column is added empty, filled row by row, then given its
default for events created from here on.
"""

import secrets

from django.db import migrations, models

import apps.website.models


def backfill_room_secrets(apps, schema_editor):
    Event = apps.get_model("website", "Event")
    for row in Event.objects.all().iterator(chunk_size=200):
        row.room_secret = secrets.token_urlsafe(18)
        row.save(update_fields=["room_secret"])


class Migration(migrations.Migration):

    dependencies = [
        ("website", "0007_event_live_room_and_join_token"),
    ]

    operations = [
        migrations.AlterField(
            model_name="event",
            name="live_platform",
            field=models.CharField(
                choices=[
                    ("external", "External link (Google Meet, Zoom, ...)"),
                    ("livekit", "VaceUp Live Room (LiveKit)"),
                    ("jitsi", "VaceUp Live Room (Jitsi)"),
                ],
                default="external",
                help_text="Where attendees actually go when they click Join.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="room_secret",
            field=models.CharField(
                blank=True, default="", editable=False, max_length=64
            ),
        ),
        migrations.RunPython(backfill_room_secrets, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="event",
            name="room_secret",
            field=models.CharField(
                blank=True,
                default=apps.website.models._room_secret,
                editable=False,
                help_text="Private code baked into a Jitsi room name. "
                          "Never shown to attendees.",
                max_length=64,
            ),
        ),
    ]
