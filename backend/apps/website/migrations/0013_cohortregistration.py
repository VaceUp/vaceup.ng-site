from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0012_intake_capacity_and_waitlist"),
        ("courses", "0008_alter_course_thumbnail"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CohortRegistration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("full_name", models.CharField(max_length=150)),
                ("email", models.EmailField(max_length=254)),
                ("phone", models.CharField(max_length=40)),
                ("payment_preference", models.CharField(choices=[("pay_now", "Pay now"), ("pay_later", "Pay later")], default="pay_later", max_length=20)),
                ("status", models.CharField(choices=[("interested", "Interested"), ("payment_pending", "Payment pending"), ("paid", "Paid"), ("closed", "Closed")], db_index=True, default="interested", max_length=20)),
                ("consent_reminders", models.BooleanField(default=True)),
                ("registered_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("next_interest_reminder_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("last_class_reminder_on", models.DateField(blank=True, null=True)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="cohort_registrations", to="courses.course")),
                ("intake", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cohort_registrations", to="website.academyintake")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="cohort_registrations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-registered_at",)},
        ),
        migrations.AddConstraint(
            model_name="cohortregistration",
            constraint=models.UniqueConstraint(fields=("intake", "email", "course"), name="uq_cohort_registration_email_course"),
        ),
        migrations.AddIndex(
            model_name="cohortregistration",
            index=models.Index(fields=("intake", "status"), name="website_coh_intake__29dd26_idx"),
        ),
        migrations.AddIndex(
            model_name="cohortregistration",
            index=models.Index(fields=("course", "status"), name="website_coh_course__87bc01_idx"),
        ),
    ]
