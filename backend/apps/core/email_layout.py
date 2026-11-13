"""Safe, shared HTML email adapter for clients that require literal inline styles."""
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import escape, urlize

THEME = json.loads(Path(__file__).with_name("email_theme.json").read_text(encoding="utf-8"))["colors"]


def safe_link(value):
    value = str(value or "").strip()
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme in ("http", "https") and parsed.hostname and not parsed.username and not parsed.password else ""
    except ValueError:
        return ""


def _inline(text):
    # Escape first. Dashboard authors may format text, never inject email HTML.
    value = str(urlize(escape(text), nofollow=True, autoescape=True))
    value = re.sub(r"\*\*([^*\n]+)\*\*", r"<strong>\1</strong>", value)
    # Mail clients commonly strip head styles, so link styles must be inline too.
    return value.replace("<a ", f'<a style="color:{THEME["brand"]};text-decoration:underline;word-break:break-word;" ')


def format_email_text(text):
    """Preserve paragraphs and line breaks; support readable headings and lists."""
    lines = str(text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    output, paragraph, items = [], [], []
    list_kind = None

    def flush_paragraph():
        if paragraph:
            output.append('<p style="margin:0 0 20px;line-height:1.75;">' + "<br>".join(_inline(line) for line in paragraph) + "</p>")
            paragraph.clear()

    def flush_list():
        if items:
            output.append(f'<{list_kind} style="margin:0 0 20px;padding-left:24px;">' + "".join(f'<li style="padding:0 0 8px;line-height:1.75;">{_inline(item)}</li>' for item in items) + f'</{list_kind}>')
            items.clear()

    for line in lines:
        if not line.strip():
            flush_paragraph(); flush_list(); continue
        heading = re.match(r"^\s*#{1,6}\s+(.+)$", line)
        item = re.match(r"^\s*(?:([-*])\s+|\d+[.)]\s+)(.+)$", line)
        if heading:
            flush_paragraph(); flush_list()
            output.append(f'<h2 style="margin:28px 0 12px;font-size:20px;line-height:1.4;color:{THEME["brand"]};">{_inline(heading[1])}</h2>')
        elif item:
            flush_paragraph()
            kind = "ul" if item[1] else "ol"
            if kind != list_kind:
                flush_list()
            list_kind = kind
            items.append(item[2])
        else:
            flush_list(); paragraph.append(line)
    flush_paragraph(); flush_list()
    return "".join(output)


def render_email(*, title, text, category="Academy update", details=(), cta_label="", cta_url="", unsubscribe_url="", footer="", preview=False, secondary_label="", secondary_url=""):
    """Only the formatter's escaped output crosses the template's safe boundary."""
    return render_to_string("email/base.html", {
        "theme": THEME, "title": title, "category": category,
        "preheader": re.sub(r"\s+", " ", text).strip()[:150],
        "message_html": format_email_text(text), "details": details,
        "cta_label": cta_label, "cta_url": safe_link(cta_url),
        "secondary_label": secondary_label, "secondary_url": safe_link(secondary_url),
        "unsubscribe_url": safe_link(unsubscribe_url), "footer": footer,
        "preview": preview, "site_url": safe_link(settings.FRONTEND_LINK_BASE),
    })
