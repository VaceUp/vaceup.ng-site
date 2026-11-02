"""Mark which registrants an academy note has already reached.

A bulk send walks the roster in batches so one request cannot outlast the
server's timeout, and a batch is only honest about where it stopped if each row
carries the time it was mailed.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("website", "0008_event_jitsi_room_secret"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventregistration",
            name="broadcast_sent_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
    ]
