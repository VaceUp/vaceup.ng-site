"""Build an isolated, secret-free backend candidate; never copy live state."""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--include-messaging", action="store_true")
    parser.parse_args()  # Keep the old flag compatible; always package the current source.
    parent = ROOT / "artifacts" / "stabilization"
    parent.mkdir(parents=True, exist_ok=True)
    target = Path(tempfile.mkdtemp(prefix="candidate-", dir=parent)) / "backend"
    names = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "--", "backend"], cwd=ROOT, text=True).splitlines()
    for name in sorted(set(names)):
        rel = Path(name).relative_to("backend")
        if rel.suffix not in {".py", ".txt", ".md", ".html"} or any(part in {"media", "staticfiles", "__pycache__", "uploads"} for part in rel.parts):
            continue
        if rel.suffix == ".txt" and rel.name != "requirements.txt":
            continue
        source = ROOT / name
        if not source.is_file():
            continue
        destination = target / rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    print(target)


if __name__ == "__main__":
    main()
