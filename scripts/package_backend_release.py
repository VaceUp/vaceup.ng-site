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


def changed_files(base):
    paths = set()
    if base:
        committed = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=ACMR", f"{base}..HEAD", "--", "backend"],
            cwd=ROOT, capture_output=True, text=True, check=True,
        )
        paths.update(line for line in committed.stdout.splitlines() if line)
    uncommitted = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all", "backend"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    for line in uncommitted.stdout.splitlines():
        status, raw = line[:2], line[3:].strip().strip('"')
        if "D" in status or "->" in raw:
            continue
        paths.add(raw)
    return sorted(paths)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--notes", default=f"BACKEND-RELEASE-{date.today().isoformat()}.md")
    parser.add_argument("--out", default="")
    parser.add_argument(
        "--base", default="HEAD~1",
        help="Git revision the release diffs against. Empty means only uncommitted files.",
    )
    parser.add_argument(
        "--with-unchanged", action="store_true",
        help="Also include manage.py, passenger_wsgi.py and requirements.txt.",
    )
    parser.add_argument(
        "--include", action="append", default=[], metavar="PATH",
        help="Ship one extra repository file that the diff does not cover "
             "(for example backend/requirements.txt). Repeatable.",
    )
    args = parser.parse_args()

    notes = ROOT / args.notes
    if not notes.is_file():
        parser.error(f"Release notes are missing: {notes.name}")
    archive = Path(args.out).resolve() if args.out else ROOT / f"vaceup-backend-{date.today().isoformat()}.zip"
    if archive.exists():
        parser.error("Release archive already exists; do not overwrite a delivered package.")

    files = {}
    sources = ([f"backend/{name}" for name in ALWAYS] if args.with_unchanged else []) + changed_files(args.base)
    for source in args.include:
        candidate = (ROOT / source).resolve()
        if not candidate.is_file():
            parser.error(f"Extra file not found: {source}")
        if candidate.suffix in SKIP_SUFFIXES:
            parser.error(f"Extra file is not shippable: {source}")
        sources.append(source)
    for source in sources:
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
        "deployment": "delta overlay: only files changed or added by this release are "
                      "included; extract over the existing application root",
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
