"""Upgrade the seeded certificate design so stored awards can print signatures."""
from django.db import migrations

TEMPLATE_NAME = "VaceUp Certificate"


def add_signature_placeholders(apps, schema_editor):
    from apps.certificates.services import DEFAULT_CERTIFICATE_HTML

    template_model = apps.get_model("certificates", "CertificateTemplate")
    template_model.objects.using(schema_editor.connection.alias).filter(
        name=TEMPLATE_NAME, html_template__contains="cert-signatures",
    ).exclude(html_template__contains="tutor_signature").update(
        html_template=DEFAULT_CERTIFICATE_HTML,
    )


class Migration(migrations.Migration):
    dependencies = [("certificates", "0004_certificate_tutor")]
    operations = [migrations.RunPython(add_signature_placeholders, migrations.RunPython.noop)]
