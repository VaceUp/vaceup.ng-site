from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("applications", "0002_application_city_application_country_and_more"), ("website", "0011_academyintake")]

    operations = [migrations.AddField(model_name="application", name="intake", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="applications", to="website.academyintake") )]
