"""Package a tested, secret-free candidate for a manual cPanel source overlay."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path)
    args = parser.parse_args()
    candidate = args.candidate.resolve()
    staging = (ROOT / "artifacts" / "stabilization").resolve()
    if not candidate.is_relative_to(staging) or candidate.name != "backend":
        parser.error("Use a tested backend candidate inside artifacts/stabilization.")
    required = ["manage.py", "passenger_wsgi.py", "requirements.txt",
                "apps/adminpanel/enrollment_grants.py",
                "apps/adminpanel/migrations/0003_alter_adminactionlog_action_type.py",
                "apps/messaging/migrations/0003_messageblock_messagereport_alter_message_options_and_more.py",
                "apps/payments/migrations/0003_payment_pricing_version.py"]
    if any(not (candidate / name).is_file() for name in required):
        parser.error("Candidate is missing required release files.")
    files = {}
    for path in sorted(candidate.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(candidate)
        if rel.parts[0] not in {"apps", "config", "templates"} and rel.as_posix() not in required[:3]:
            continue
        if any(part.startswith(".") or part in {"__pycache__", "media", "staticfiles", "uploads"} for part in rel.parts):
            continue
        if rel.suffix not in {".py", ".html"} and rel.as_posix() != "requirements.txt":
            continue
        files[rel.as_posix()] = path.read_bytes()
    files["STABILIZATION-DEPLOYMENT.md"] = (ROOT / "STABILIZATION-DEPLOYMENT.md").read_bytes()
    files["RELEASE-MANIFEST.json"] = json.dumps({
        "release": "stabilization-2026-09-20",
        "deployment": "manual cPanel source overlay; no environment or database included",
        "sha256": {name: hashlib.sha256(data).hexdigest() for name, data in files.items()},
    }, indent=2).encode()
    archive = staging / "vaceup-backend-stabilization-2026-09-20.zip"
    if archive.exists():
        parser.error("Release archive already exists; do not overwrite a delivered package.")
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
        for name, data in files.items():
            bundle.writestr(name, data)
    with ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        assert set(bundle.namelist()) == set(files)
        for name, data in files.items():
            assert bundle.read(name) == data
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".zip.sha256").write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    print(f"Verified {len(files)} entries; no .env, database, media or virtualenv included.")
    print(f"{archive}\nSHA256 {digest}")


if __name__ == "__main__":
    main()
