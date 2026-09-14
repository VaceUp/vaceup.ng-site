"""Prepare a secret-free test snapshot, excluding unrelated unfinished work."""
import io
from pathlib import Path
import subprocess
import tarfile
import tempfile
import shutil

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {"backend/apps/messaging/models.py", "backend/apps/messaging/services.py",
            "backend/apps/announcements/serializers.py", "backend/apps/announcements/views.py"}
EXTRA = ["apps/adminpanel/migrations/0002_alter_adminactionlog_action_type.py",
         "apps/adminpanel/platform_settings.py", "apps/adminpanel/schema.py", "apps/core/schema.py",
         "apps/adminpanel/user_deletion.py", "apps/adminpanel/test_user_deletion.py",
         "apps/adminpanel/test_admin_controls.py", "apps/courses/test_authoring.py",
         "apps/marketing/test_delivery.py", "apps/marketing/management", "apps/marketing/migrations",
         "apps/announcements/migrations"]


def main():
    parent = ROOT / "artifacts" / "admin-controls"
    parent.mkdir(parents=True, exist_ok=True)
    target = Path(tempfile.mkdtemp(prefix="release-", dir=parent))
    raw = subprocess.check_output(["git", "archive", "HEAD", "backend"], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        archive.extractall(target, filter="data")
    changed = subprocess.check_output(["git", "diff", "HEAD", "--name-only", "--", "backend"], cwd=ROOT).decode().splitlines()
    for name in [n for n in changed if n not in EXCLUDED] + ["backend/" + n for n in EXTRA]:
        source = ROOT / name
        if not source.exists():
            continue
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.is_dir():
            shutil.copytree(source, destination, dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        else:
            shutil.copy2(source, destination)
    print(target / "backend")


if __name__ == "__main__":
    main()
