"""Enforce one default per scope, including global templates, on MySQL.

The preflight deliberately runs before DDL because MySQL cannot roll DDL back.
Operators must resolve duplicate defaults explicitly; no records are deleted
or silently demoted by this migration.
"""
from django.db import migrations, models
from django.db.models.functions import Cast


def refuse_duplicate_defaults(apps, schema_editor):
    template = apps.get_model("certificates", "CertificateTemplate")
    defaults = template.objects.using(schema_editor.connection.alias).filter(is_default=True)
    duplicates = list(
        defaults.order_by().values("course_id").annotate(count=models.Count("pk"))
        .filter(count__gt=1).order_by("course_id")
    )
    if duplicates:
        scopes = []
        for group in duplicates:
            course_id = group["course_id"]
            ids = list(defaults.filter(course_id=course_id).order_by("pk").values_list("pk", flat=True))
            label = "global (course_id=NULL)" if course_id is None else f"course_id={course_id}"
            scopes.append(f"{label}: template IDs {ids}")
        raise RuntimeError(
            "Cannot enforce certificate template defaults: " + "; ".join(scopes)
            + ". Choose the intended default in each scope, explicitly unset is_default "
            "on the others, then retry. No template data has been changed."
        )


class Migration(migrations.Migration):
    # MySQL DDL is not transactional. Complete the read-only preflight first.
    atomic = False
    dependencies = [("certificates", "0001_initial")]

    operations = [
        migrations.RunPython(refuse_duplicate_defaults, migrations.RunPython.noop),
        migrations.AddField(
            model_name="certificatetemplate",
            name="default_scope",
            field=models.GeneratedField(
                expression=models.Case(
                    models.When(is_default=True, course_id__isnull=True, then=models.Value("global")),
                    models.When(is_default=True, then=Cast("course_id", models.CharField(max_length=20))),
                    default=models.Value(None),
                    output_field=models.CharField(max_length=20),
                ),
                output_field=models.CharField(max_length=20),
                db_persist=True,
                null=True,
                unique=True,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="certificatetemplate",
            name="unique_default_template_per_course",
        ),
    ]
