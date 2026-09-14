"""Package an explicitly staged backend release, never the dirty workspace.

Run from the repository root after staging/reviewing the intended patch.
Artifacts are local/ignored; deployment secrets and user files are excluded.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import zipfile


def git(*args):
    return subprocess.check_output(["git", *args])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--revision", help="Use a committed revision instead of the staged index")
    parser.add_argument("--base", default="b37b42d")
    parser.add_argument("--document", default="LAUNCH-STABILIZATION.md")
    parser.add_argument("--label", default="launch")
    options = parser.parse_args()
    root = Path(git("rev-parse", "--show-toplevel").decode().strip())
    tree = options.revision or git("write-tree").decode().strip()
    target = root / "artifacts" / "admin-auth-catalog"
    target.mkdir(parents=True, exist_ok=True)
    release = Path(tempfile.mkdtemp(prefix="launch-20260913-", dir=target))
    with tarfile.open(fileobj=io.BytesIO(git("archive", tree, "backend"))) as archive:
        archive.extractall(release / "release", filter="data")
    changed = git("diff", "--name-only", "--diff-filter=ACM", options.base, tree, "--", "backend").decode().splitlines()
    docs = git("show", f"{tree}:{options.document}")
    forbidden = {".env", "vaceup-production.env", "repair_vaceup_env.py"}

    def permitted(name):
        path = Path(name)
        return path.name not in forbidden and not path.name.startswith(".env") and not any(
            part in {"__pycache__", "media", "staticfiles", ".venv", ".git"} for part in path.parts
        ) and path.suffix not in {".sqlite3", ".log", ".pyc", ".zip"}

    manifests = {}
    for label, names in [
        ("patch", changed),
        ("full-backend", git("ls-tree", "-r", "--name-only", tree, "backend").decode().splitlines()),
    ]:
        output = release / f"vaceup-{options.label}-{label}-20260913.zip"
        manifest = {}
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("DEPLOY-LAUNCH.md", docs)
            for name in sorted(names):
                relative = str(Path(name).relative_to("backend")).replace("\\", "/")
                if not permitted(relative):
                    continue
                data = (release / "release" / name).read_bytes()
                archive.writestr(relative, data)
                manifest[relative] = hashlib.sha256(data).hexdigest()
            archive.writestr("RELEASE-MANIFEST.json", json.dumps({"tree": tree, "base": options.base, "files": manifest}, indent=2))
        manifests[label] = {"path": str(output), "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "files": len(manifest)}
    (release / "DEPLOY-LAUNCH.md").write_bytes(docs)
    (release / "package-manifests.json").write_text(json.dumps(manifests, indent=2), encoding="utf-8")
    print(json.dumps({"release": str(release), "tree": tree, "packages": manifests}, indent=2))


if __name__ == "__main__":
    main()
