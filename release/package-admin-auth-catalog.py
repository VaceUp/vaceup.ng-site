"""Create reviewable changed-file and static-site archives; never includes secrets."""
import hashlib
import json
from pathlib import Path
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
BASE = "808731d01fa8d3aa1dd508ea53082e07d6f39bf9"
DEST = ROOT / "artifacts" / "admin-auth-catalog" / "packages"


def make_zip(name, files):
    target = DEST / name
    manifest = []
    with ZipFile(target, "w", ZIP_DEFLATED) as archive:
        for source, destination in sorted(files, key=lambda item: item[1]):
            if any(part.startswith(".env") or part in ("node_modules", "__pycache__") for part in source.parts):
                raise RuntimeError(f"Refusing private/dependency file: {source.name}")
            if source.suffix.lower() in (".log", ".sqlite3", ".pem", ".key", ".pyc"):
                raise RuntimeError(f"Refusing sensitive/generated file: {source.name}")
            content = source.read_bytes()
            archive.writestr(destination, content)
            manifest.append({"path": destination, "sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content)})
        archive.writestr("PATCH-MANIFEST.json", json.dumps(manifest, indent=2))
    with ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("Archive integrity check failed")
    return {"file": name, "files": len(manifest), "bytes": target.stat().st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    # New files must be staged before packaging so the manifest includes them.
    paths = subprocess.check_output(["git", "diff", "--name-only", "--diff-filter=ACMRT", BASE, "--", "backend", "frontend"], cwd=ROOT, text=True).splitlines()
    backend = [(ROOT / item, item.removeprefix("backend/")) for item in paths if item.startswith("backend/")]
    frontend = [(ROOT / item, item.removeprefix("frontend/")) for item in paths if item.startswith("frontend/")]
    docs = [(ROOT / "release" / filename, filename) for filename in ("DEPLOY-ADMIN-AUTH-CATALOG.md", "ADMIN-GUIDE.md", "VERIFICATION.md")]
    if not backend or not frontend or not (ROOT / "frontend/out/course/index.html").exists():
        raise RuntimeError("Stage new source files and complete the frontend build before packaging.")
    static = [(item, item.relative_to(ROOT / "frontend/out").as_posix()) for item in (ROOT / "frontend/out").rglob("*") if item.is_file()]
    summaries = [make_zip("backend-changed-files.zip", backend + docs), make_zip("frontend-source-patch.zip", frontend + docs), make_zip("frontend-static.zip", static)]
    (DEST / "SHA256SUMS.json").write_text(json.dumps(summaries, indent=2), encoding="utf-8")
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    main()
