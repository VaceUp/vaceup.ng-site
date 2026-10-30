from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import apps.assignments.storage


class Migration(migrations.Migration):
    dependencies = [
        ("assignments", "0002_alter_answer_short_text_alter_submission_status_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.AlterField(
            model_name="submission", name="file",
            field=models.FileField(blank=True, null=True, storage=apps.assignments.storage.AssignmentStorage(), upload_to="assignment_submissions/"),
        ),
        migrations.CreateModel(
            name="AssessmentGradeLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("before", models.JSONField(default=dict)),
                ("after", models.JSONField(default=dict)),
                ("actor", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("attempt", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="grade_history", to="assignments.quizattempt")),
                ("submission", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="grade_history", to="assignments.submission")),
            ],
            options={"ordering": ("-created_at", "-pk")},
        ),
    ]
