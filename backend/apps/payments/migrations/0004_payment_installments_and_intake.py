from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("payments", "0003_payment_pricing_version"), ("website", "0011_academyintake")]

    operations = [
        migrations.AddField(model_name="payment", name="intake", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="payments", to="website.academyintake")),
        migrations.AddField(model_name="payment", name="installment_number", field=models.PositiveSmallIntegerField(default=1)),
        migrations.AddField(model_name="payment", name="installment_total", field=models.PositiveSmallIntegerField(default=1)),
    ]
