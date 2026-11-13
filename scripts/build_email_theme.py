"""Resolve the app's shared brand tokens into literal values for email clients."""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend/src/app/globals.css"
TARGET = ROOT / "backend/apps/core/email_theme.json"
TOKENS = {
    "brand": "--color-navy-950", "accent": "--color-gold-brand",
    "surface": "--bg-primary", "page": "--bg-secondary",
    "text": "--color-ink", "muted": "--text-secondary", "line": "--border-color",
}

def main():
    css = SOURCE.read_text(encoding="utf-8")
    theme = {}
    for name, token in TOKENS.items():
        match = re.search(r"^\s*" + re.escape(token) + r":\s*(#[a-fA-F0-9]{6})\s*;", css, re.M)
        if not match:
            raise SystemExit(f"Email theme token is missing or unresolved: {token}")
        theme[name] = match.group(1)
    output = json.dumps({"source": "frontend/src/app/globals.css", "colors": theme}, indent=2) + "\n"
    if "--check" in sys.argv:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != output:
            raise SystemExit("Email theme has drifted. Run python scripts/build_email_theme.py.")
        print("Email theme matches the shared app tokens.")
    else:
        TARGET.write_text(output, encoding="utf-8")
        print(f"Generated {TARGET.relative_to(ROOT)} from shared brand tokens.")

if __name__ == "__main__":
    main()
