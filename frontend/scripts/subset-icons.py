"""Rebuild the Bootstrap Icons subset the site ships.

The full package carries 2078 glyphs (87 KB CSS + 131 KB woff2). The site uses
a few hundred, so this script scans src/, keeps the matching rules, and writes a
subset font next to a trimmed stylesheet.

Run after adding an icon class:
    pip install fonttools brotli
    python scripts/subset-icons.py
"""

import json
import re
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[1]
FONT_PKG = FRONTEND / "node_modules" / "bootstrap-icons" / "font"
OUT_CSS = FRONTEND / "src" / "app" / "bootstrap-icons.css"
OUT_FONT = FRONTEND / "src" / "app" / "fonts" / "bootstrap-icons-subset.woff2"

names = json.loads((FONT_PKG / "bootstrap-icons.json").read_text(encoding="utf-8"))
valid = set(names)

CHUNKS = []
for path in (FRONTEND / "src").rglob("*"):
    if path.is_file() and path.suffix in {".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".mdx"}:
        CHUNKS.append(path.read_text(encoding="utf-8", errors="ignore"))
text = "\n".join(CHUNKS)

used = set()
for name in valid:
    if f"'{name}'" in text or f'"{name}"' in text or f"`{name}`" in text:
        used.add(name)
used.update(m for m in re.findall(r"\bbi-([a-z0-9-]+)\b", text) if m in valid)

source_css = (FONT_PKG / "bootstrap-icons.css").read_text(encoding="utf-8")
rule = re.compile(r'^\.bi-([a-z0-9-]+)::before \{ content: "\\([0-9a-f]+)"; \}$', re.M)
found = {m.group(1): m.group(2) for m in rule.finditer(source_css)}
missing = used - set(found)
if missing:
    raise SystemExit(f"No glyph found for: {sorted(missing)}")

base = re.search(
    r'\.bi::before,\n\[class\^="bi-"\]::before,\n\[class\*=" bi-"\]::before \{[^}]+\}',
    source_css,
)
if not base:
    raise SystemExit("Base ::before rule block not found in bootstrap-icons.css")

header = """/*!
 * Bootstrap Icons v1.13.1 (https://icons.getbootstrap.com/)
 * Copyright 2019-2024 The Bootstrap Authors
 * Licensed under MIT (https://github.com/twbs/icons/blob/main/LICENSE)
 *
 * Subset build: only the glyphs this site uses are included, so the font
 * arrives at a fraction of the 2078-glyph original. Regenerate with
 * `python scripts/subset-icons.py` after adding a new icon class.
 */
@font-face {
  font-display: block;
  font-family: "bootstrap-icons";
  src: url("./fonts/bootstrap-icons-subset.woff2") format("woff2");
}

"""

OUT_CSS.parent.mkdir(parents=True, exist_ok=True)
OUT_FONT.parent.mkdir(parents=True, exist_ok=True)
OUT_CSS.write_text(
    header + base.group(0) + "\n\n"
    + "".join(f'.bi-{name}::before {{ content: "\\{found[name]}"; }}\n' for name in sorted(used)),
    encoding="utf-8",
)

from fontTools import subset  # noqa: E402

subset.main([
    str(FONT_PKG / "fonts" / "bootstrap-icons.woff2"),
    "--unicodes=" + ",".join(f"U+{int(names[n]):04X}" for n in sorted(used)),
    f"--output-file={OUT_FONT}",
    "--flavor=woff2",
    "--layout-features=*",
    "--no-hinting",
    "--desubroutinize",
])

print(f"{len(used)} glyphs, css {OUT_CSS.stat().st_size} B, font {OUT_FONT.stat().st_size} B")
