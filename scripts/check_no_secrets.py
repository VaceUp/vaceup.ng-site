"""Fail the build when a tracked file carries a live secret.

Guards the repository against the failure that already happened once: a
deployable archive containing ``backend/.env`` was committed and stayed in
history, so the production SECRET_KEY, JWT signing key and database password
were readable by anyone with repository access.

Usage:
    python3 scripts/check_no_secrets.py            # scan tracked files
    python3 scripts/check_no_secrets.py --paths a b

Exit codes: 0 = clean, 1 = findings, 2 = git was unavailable.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Files that legitimately carry example or placeholder values.
ALLOWED_NAME_PARTS = ("example", ".sample", "settings_test", "settings_test_mysql")
ALLOWED_SUFFIXES = (".md", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".svg", ".pdf", ".zip")
ALLOWED_PREFIXES = (".github/workflows/", "scripts/")

# High-confidence live credential shapes.
SECRET_PATTERNS = (
    (re.compile(r"sk_live_[A-Za-z0-9]{16,}"), "Paystack live secret key"),
    (re.compile(r"sk_test_[A-Za-z0-9]{16,}"), "Paystack test secret key"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS access key id"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "private key block"),
    (re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"), "GitHub token"),
    (re.compile(r"AIza[0-9A-Za-z_\-]{30,}"), "Google API key"),
    (re.compile(r"xox[baprs]-[A-Za-z0-9\-]{10,}"), "Slack token"),
    (re.compile(r"(?m)^\s*DB_PASSWORD\s*=\s*(?!$|[\"']?$|ci-|<|changeme|placeholder|xxx)\S{8,}"),
     "database password"),
    (re.compile(r"(?m)^\s*JWT_SIGNING_KEY\s*=\s*\S{16,}"), "JWT signing key"),
    (re.compile(r"(?m)^\s*SECRET_KEY\s*=\s*(?!$|[\"']?$|ci-|<|changeme|placeholder|xxx)\S{32,}"),
     "Django secret key"),
)

# Text files worth scanning.
TEXT_SUFFIXES = (
    ".py", ".txt", ".json", ".yml", ".yaml", ".toml", ".cfg", ".ini", ".env",
    ".js", ".mjs", ".ts", ".tsx", ".sh", ".html", ".css", "",
)


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("check_no_secrets: git ls-files failed", file=sys.stderr)
        raise SystemExit(2)
    return [line for line in result.stdout.split("\0") if line]


def is_exempt(path: str) -> bool:
    name = Path(path).name
    if any(part in name for part in ALLOWED_NAME_PARTS):
        return True
    if path.startswith(ALLOWED_PREFIXES):
        return True
    return Path(path).suffix.lower() in ALLOWED_SUFFIXES


def scan(paths: list[str]) -> list[str]:
    findings: list[str] = []
    for rel in paths:
        if is_exempt(rel):
            continue
        target = ROOT / rel
        if not target.is_file():
            continue
        if target.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            content = target.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for pattern, label in SECRET_PATTERNS:
            for match in pattern.finditer(content):
                line = content.count("\n", 0, match.start()) + 1
                findings.append(f"{rel}:{line}: {label}")
    return findings


def main(argv: list[str]) -> int:
    paths = argv[1:]
    if not paths:
        paths = tracked_files()

    findings: list[str] = []

    # 1. No archives and no environment files may be tracked at all.
    for rel in paths:
        name = Path(rel).name
        if name.endswith((".zip", ".tar", ".tar.gz", ".tgz")):
            findings.append(f"{rel}: deployable archive is tracked (may contain .env)")
        if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
            findings.append(f"{rel}: environment file is tracked")

    # 2. No tracked file may carry a live credential.
    findings.extend(scan(paths))

    if findings:
        print("check_no_secrets: FAILED")
        for finding in findings:
            print(f"  {finding}")
        print("Rotate any exposed credential, then commit only sanitised files.")
        return 1

    print(f"check_no_secrets: clean ({len(paths)} tracked files scanned)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
