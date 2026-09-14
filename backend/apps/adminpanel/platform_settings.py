"""Supported business settings. Infrastructure secrets stay in the environment."""
from apps.adminpanel.models import AdminSettings

DEFINITIONS = {
    "homepage_courses_limit": {
        "label": "Homepage course count", "default": 6, "type": "integer",
        "min": 1, "max": 20, "public": True,
        "description": "Maximum published courses shown on the homepage. The full catalogue remains available.",
    },
    "marketing_sending_enabled": {
        "label": "Allow marketing email delivery", "default": False, "type": "boolean", "public": False,
        "description": "Enable after reviewing recipients and SMTP limits. Turning this off pauses marketing delivery, not account email. A message already being sent may still complete.",
    },
}


def setting_value(key):
    row = AdminSettings.objects.filter(key=key).first()
    definition = DEFINITIONS[key]
    value = row.value if row else definition["default"]
    if definition["type"] == "boolean" and type(value) is not bool:
        return definition["default"]
    if definition["type"] == "integer" and (type(value) is not int or not definition["min"] <= value <= definition["max"]):
        return definition["default"]
    return value
