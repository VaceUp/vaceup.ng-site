"""Changed files plus known missing dependencies; never package server secrets."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from package_admin_deployment_repair import BACKEND_FILES

ROOT = Path(__file__).resolve().parents[1]
EXTRA = (
    'apps/core/schema.py',
    'apps/core/throttling.py',
    'apps/adminpanel/services.py',
    'apps/adminpanel/user_deletion.py', 'apps/courses/models.py',
    'apps/courses/catalog.py', 'apps/courses/original_catalog.json',
    'apps/courses/migrations/0004_course_duration_course_image_url.py',
    'apps/courses/migrations/0005_course_public_details.py',
    'apps/announcements/views.py', 'apps/announcements/services.py',
    'apps/announcements/serializers.py', 'apps/announcements/access.py', 'apps/announcements/schema.py',
    'apps/accounts/outbox.py', 'apps/accounts/management/commands/process_mail_queue.py',
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tested-backend', type=Path, required=True)
    options = parser.parse_args()
    names = sorted(set(BACKEND_FILES + EXTRA))
    files = {}
    for name in names:
        assert not name.startswith('config/') and '.env' not in Path(name).parts, f'Configuration must not be packaged: {name}'
        data = (ROOT / 'backend' / name).read_bytes()
        assert data == (options.tested_backend / name).read_bytes(), f'Untested source: {name}'
        files[name] = data
    guide = 'COURSE-CONTROL-DEPLOYMENT-2026-09-29.md'
    files[guide] = (ROOT / guide).read_bytes()
    files['diagnose_admin_deployment.py'] = (ROOT / 'scripts/diagnose_admin_deployment.py').read_bytes()
    files['COURSE-CONTROL-MANIFEST.json'] = json.dumps({
        'release': 'course-controls-2026-10-04', 'install_root': '/home/coqrpund/vaceup_api/',
        'scope': 'Changed backend files and known missing baseline dependencies only',
        'sha256': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()},
    }, indent=2).encode()
    target = ROOT / 'artifacts/stabilization/vaceup-course-controls-patch-2026-10-04-v2.zip'
    with ZipFile(target, 'x', compression=ZIP_DEFLATED) as bundle:
        for name, data in files.items():
            bundle.writestr(name, data)
    with ZipFile(target) as bundle:
        assert bundle.testzip() is None and set(bundle.namelist()) == set(files)
        assert all(bundle.read(name) == data for name, data in files.items())
    print(f'Verified {len(names)} backend files; {len(files)} archive entries.')
    print(target)
    print('SHA256', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
