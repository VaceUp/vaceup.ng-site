from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("website", "0011_academyintake"), ("courses", "0008_alter_course_thumbnail")]

    operations = [
        migrations.AddField(model_name="academyintake", name="capacity_per_course", field=models.PositiveIntegerField(default=30)),
        migrations.CreateModel(
            name="IntakeWaitlistEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("full_name", models.CharField(max_length=150)),
                ("email", models.EmailField(max_length=254)),
                ("phone", models.CharField(blank=True, max_length=40)),
                ("status", models.CharField(choices=[("active", "Active"), ("contacted", "Contacted"), ("closed", "Closed")], default="active", max_length=20)),
                ("intake", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="waitlist_entries", to="website.academyintake")),
                ("preferred_course", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="intake_waitlist_entries", to="courses.course")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddConstraint(model_name="intakewaitlistentry", constraint=models.UniqueConstraint(fields=("intake", "email", "preferred_course"), name="uq_intake_waitlist_email_course")),
    ]
