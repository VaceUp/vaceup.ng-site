"""Events get a venue choice; every registrant gets a personal join token.

The token is backfilled row by row before the unique index is added, because a
callable default is evaluated once when a column is added to a table that
already has rows, and every existing attendee would share one token.
"""

import secrets

from django.db import migrations, models

import apps.website.models


def backfill_join_tokens(apps, schema_editor):
    EventRegistration = apps.get_model("website", "EventRegistration")
    for row in EventRegistration.objects.all().iterator(chunk_size=200):
        row.join_token = secrets.token_urlsafe(24)
        row.save(update_fields=["join_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("website", "0006_academyprofile_hero_title_contentrevision"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="live_platform",
            field=models.CharField(
                choices=[
                    ("external", "External link (Google Meet, Zoom, ...)"),
                    ("livekit", "VaceUp Live Room (built in)"),
                ],
                default="external",
                help_text="Where attendees actually go when they click Join.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="room_name",
            field=models.CharField(
                blank=True,
                help_text="VaceUp Live Room name. Left blank, the event slug names the room.",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="eventregistration",
            name="join_link_sent_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="eventregistration",
            name="join_token",
            field=models.CharField(blank=True, editable=False, max_length=64),
        ),
        migrations.RunPython(backfill_join_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="eventregistration",
            name="join_token",
            field=models.CharField(
                default=apps.website.models._join_token,
                editable=False,
                max_length=64,
                unique=True,
            ),
        ),
    ]
