"""Seed the branded certificate design when the academy has no global default.

Academies that already authored a default template keep it: this migration only
fills the gap where certificates were being rendered with the generic frame.
"""
from django.db import migrations

# Imported rather than duplicated so the seeded markup cannot drift from the
# renderer that issues certificates.
from apps.certificates.services import DEFAULT_CERTIFICATE_HTML

TEMPLATE_NAME = "VaceUp Certificate"


def seed_branded_template(apps, schema_editor):
    template_model = apps.get_model("certificates", "CertificateTemplate")
    alias = schema_editor.connection.alias
    if template_model.objects.using(alias).filter(course__isnull=True, is_default=True).exists():
        return
    template_model.objects.using(alias).create(
        name=TEMPLATE_NAME,
        course=None,
        html_template=DEFAULT_CERTIFICATE_HTML,
        css_styles="",
        page_size="A4",
        orientation="landscape",
        is_active=True,
        is_default=True,
    )


def remove_seeded_template(apps, schema_editor):
    template_model = apps.get_model("certificates", "CertificateTemplate")
    template_model.objects.using(schema_editor.connection.alias).filter(
        name=TEMPLATE_NAME, course__isnull=True, html_template=DEFAULT_CERTIFICATE_HTML,
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("certificates", "0002_default_template_scope")]

    operations = [migrations.RunPython(seed_branded_template, remove_seeded_template)]
