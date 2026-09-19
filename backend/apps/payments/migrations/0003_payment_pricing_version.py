from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("payments", "0002_payment_checkout_fingerprint_paymentitem")]

    operations = [
        # Old order snapshots may have accepted client-controlled discounts.
        # Preserve them for reconciliation; never infer historical catalogue prices.
        migrations.AddField(
            model_name="payment", name="pricing_version",
            field=models.PositiveSmallIntegerField(default=0),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="payment", name="pricing_version",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
