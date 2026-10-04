from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("courses", "0004_course_duration_course_image_url")]
    operations = [
        migrations.AddField(model_name="course", name="tagline", field=models.CharField(blank=True, max_length=300)),
        migrations.AddField(model_name="course", name="learning_outcomes", field=models.TextField(blank=True)),
        migrations.AddField(model_name="course", name="requirements", field=models.TextField(blank=True)),
        migrations.AddField(model_name="course", name="benefits", field=models.TextField(blank=True)),
        migrations.AddField(model_name="course", name="target_audience", field=models.CharField(blank=True, max_length=200)),
        migrations.AddField(model_name="course", name="outline", field=models.TextField(blank=True, help_text="Public syllabus, separate from enrolled lesson content.")),
    ]
