from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [("marketing", "0001_initial")]
    operations = [
        migrations.AddField(model_name="emailrecipient", name="attempts", field=models.PositiveSmallIntegerField(default=0)),
        migrations.AddField(model_name="emailrecipient", name="available_at", field=models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
        migrations.AddField(model_name="emailrecipient", name="claim_id", field=models.UUIDField(blank=True, null=True)),
        migrations.AddField(model_name="emailrecipient", name="claimed_at", field=models.DateTimeField(blank=True, null=True)),
    ]
