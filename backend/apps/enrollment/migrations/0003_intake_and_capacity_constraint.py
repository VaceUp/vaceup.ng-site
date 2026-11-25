from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("enrollment", "0002_enrollment_last_progress_reminder_at"), ("website", "0011_academyintake")]

    operations = [
        migrations.AddField(model_name="enrollment", name="intake", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="enrollments", to="website.academyintake")),
        migrations.RemoveConstraint(model_name="enrollment", name="uq_enrollment_student_course"),
        migrations.AddConstraint(model_name="enrollment", constraint=models.UniqueConstraint(fields=("student", "course", "intake"), name="uq_enrollment_student_course_intake")),
    ]
