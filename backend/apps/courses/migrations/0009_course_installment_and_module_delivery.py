from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("courses", "0008_alter_course_thumbnail")]

    operations = [
        migrations.AddField(model_name="course", name="duration_months", field=models.PositiveSmallIntegerField(default=1)),
        migrations.AddField(model_name="course", name="installment_eligible", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="course", name="installment_first_amount", field=models.DecimalField(decimal_places=2, default=0, max_digits=10)),
        migrations.AddField(model_name="course", name="installment_final_amount", field=models.DecimalField(decimal_places=2, default=0, max_digits=10)),
        migrations.AddField(model_name="module", name="delivery_method", field=models.CharField(choices=[("google_meet", "Google Meet"), ("vaceup_live_room", "VaceUp Live Room")], default="google_meet", max_length=24)),
        migrations.AddField(model_name="module", name="live_room_url", field=models.URLField(blank=True, help_text="Private VaceUp Live Room join link for this module.")),
    ]
