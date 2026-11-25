from decimal import Decimal
from django.db import migrations


TERMS = {
    "excel": (1, Decimal("30000"), False, Decimal("30000"), Decimal("0")),
    "virtual assistance": (3, Decimal("60000"), True, Decimal("36000"), Decimal("24000")),
    "graphic design": (2, Decimal("60000"), True, Decimal("36000"), Decimal("24000")),
    "data analysis": (3, Decimal("70000"), True, Decimal("42000"), Decimal("28000")),
    "ui/ux": (3, Decimal("70000"), True, Decimal("42000"), Decimal("28000")),
    "web development": (3, Decimal("80000"), True, Decimal("48000"), Decimal("32000")),
}


def seed_terms(apps, schema_editor):
    Course = apps.get_model("courses", "Course")
    for course in Course.objects.all():
        title = course.title.casefold()
        match = next((key for key in TERMS if key in title), None)
        if not match:
            continue
        months, price, eligible, first, final = TERMS[match]
        course.duration_months = months
        course.price = price
        course.installment_eligible = eligible
        course.installment_first_amount = first
        course.installment_final_amount = final
        course.save(update_fields=["duration_months", "price", "installment_eligible", "installment_first_amount", "installment_final_amount", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [("courses", "0009_course_installment_and_module_delivery")]
    operations = [migrations.RunPython(seed_terms, migrations.RunPython.noop)]
