"""Build the allowlisted cPanel repair; no environment or database is included."""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
BACKEND_FILES = (
    "apps/adminpanel/views.py",
    "apps/adminpanel/serializers.py",
    "apps/adminpanel/platform_settings.py",
    "apps/adminpanel/schema.py",
    "apps/courses/views.py",
    "apps/courses/serializers.py",
    "apps/courses/management/__init__.py",
    "apps/courses/management/commands/__init__.py",
    "apps/courses/management/commands/import_homepage_catalog.py",
    "apps/announcements/migrations/__init__.py",
    "apps/announcements/migrations/0001_initial.py",
    "apps/adminpanel/migrations/0002_alter_adminactionlog_action_type.py",
    "apps/adminpanel/migrations/0003_alter_adminactionlog_action_type.py",
    "apps/messaging/migrations/0003_messageblock_messagereport_alter_message_options_and_more.py",
    "apps/payments/migrations/0003_payment_pricing_version.py",
    "apps/core/management/commands/check_release_routes.py",
)


def main():
    files = {name: (ROOT / "backend" / name).read_bytes() for name in BACKEND_FILES}
    files["diagnose_admin_deployment.py"] = (ROOT / "scripts/diagnose_admin_deployment.py").read_bytes()
    guide = "ADMIN-DEPLOYMENT-REPAIR-2026-09-24.md"
    files[guide] = (ROOT / guide).read_bytes()
    files["ADMIN-REPAIR-MANIFEST.json"] = json.dumps({
        "release": "admin-deployment-repair-2026-09-24",
        "install_root": "/home/coqrpund/vaceup_api/",
        "scope": "Reported admin/course source gaps, required helpers and original migrations only",
        "sha256": {name: hashlib.sha256(data).hexdigest() for name, data in files.items()},
    }, indent=2).encode()
    destination = ROOT / "artifacts/stabilization/vaceup-admin-deployment-repair-2026-09-24.zip"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "x", compression=ZIP_DEFLATED) as bundle:
        for name, data in files.items():
            bundle.writestr(name, data)
    with ZipFile(destination) as bundle:
        assert bundle.testzip() is None
        assert set(bundle.namelist()) == set(files)
        for name, data in files.items():
            assert bundle.read(name) == data
    print(f"Verified {len(files)} archive entries; {len(BACKEND_FILES)} backend files.")
    print(destination)
    print("SHA256", hashlib.sha256(destination.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
