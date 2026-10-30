"""Package the changed backend files as a secret-free cPanel source overlay."""
import argparse
import hashlib
import json
import subprocess
from datetime import date
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
ALWAYS = ["manage.py", "passenger_wsgi.py", "requirements.txt"]
SKIP_PARTS = {"__pycache__", "media", "staticfiles", "uploads", ".git"}
SKIP_NAMES = {".env", "db.sqlite3", ".DS_Store"}
SKIP_SUFFIXES = {".pyc", ".pdf", ".log"}


def changed_files():
    result = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all", "backend"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    paths = []
    for line in result.stdout.splitlines():
        status, raw = line[:2], line[3:].strip().strip('"')
        if "D" in status or "->" in raw:
            continue
        paths.append(raw)
    return sorted(set(paths))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--notes", default=f"BACKEND-RELEASE-{date.today().isoformat()}.md")
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    notes = ROOT / args.notes
    if not notes.is_file():
        parser.error(f"Release notes are missing: {notes.name}")
    archive = Path(args.out).resolve() if args.out else ROOT / f"vaceup-backend-{date.today().isoformat()}.zip"
    if archive.exists():
        parser.error("Release archive already exists; do not overwrite a delivered package.")

    files = {}
    for source in [f"backend/{name}" for name in ALWAYS] + changed_files():
        path = ROOT / source
        rel = path.relative_to(BACKEND)
        if not path.is_file():
            continue
        if SKIP_PARTS & set(rel.parts) or rel.name in SKIP_NAMES or rel.suffix in SKIP_SUFFIXES:
            continue
        if any(part.startswith(".") for part in rel.parts):
            continue
        files[rel.as_posix()] = path.read_bytes()
    files[notes.name] = notes.read_bytes()
    files["RELEASE-MANIFEST.json"] = json.dumps({
        "release": archive.stem,
        "deployment": "manual cPanel source overlay over the existing application root; "
                      "no environment, database, media or virtualenv included",
        "python": "3.12",
        "sha256": {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())},
    }, indent=2).encode()

    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
        for name, data in sorted(files.items()):
            bundle.writestr(name, data)
    with ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        assert set(bundle.namelist()) == set(files)
        for name, data in files.items():
            assert bundle.read(name) == data
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".zip.sha256").write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    print(f"Packaged {len(files)} entries into {archive}")
    for name in sorted(files):
        print(" ", name)
    print(f"SHA256 {digest}")


if __name__ == "__main__":
    main()
