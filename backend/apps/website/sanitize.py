"""Allowlist HTML sanitizer for third-party blog content.

Blogger posts are authored outside our admin, so their HTML is untrusted.
The sanitizer keeps formatting tags and safe links/images, and drops
scripts, styles, event handlers and unknown tags (keeping their text).
"""

from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit

ALLOWED_TAGS = {
    "p", "br", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "pre", "code", "ul", "ol", "li", "hr", "figure",
    "figcaption", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "strong", "b", "em", "i", "u", "s", "strike", "a", "img", "iframe",
}
VOID_TAGS = {"br", "hr", "img"}
DROP_CONTENT_TAGS = {"script", "style", "noscript", "template"}
ALLOWED_IFRAME_HOSTS = {"www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"}


def _safe_url(value, *, allow_mailto=False):
    value = (value or "").strip()
    if not value:
        return ""
    if value.startswith("//"):
        value = "https:" + value
    parts = urlsplit(value)
    schemes = {"http", "https"} | ({"mailto"} if allow_mailto else set())
    if parts.scheme.lower() not in schemes:
        return ""
    return value


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.drop_depth = 0
        self.open_tags = []

    def handle_starttag(self, tag, attrs):
        if tag in DROP_CONTENT_TAGS:
            self.drop_depth += 1
            return
        if self.drop_depth or tag not in ALLOWED_TAGS:
            return
        clean = self._clean_attrs(tag, dict(attrs))
        if clean is None:
            return
        rendered = "".join(f' {key}="{escape(value, quote=True)}"' for key, value in clean.items())
        self.parts.append(f"<{tag}{rendered}>")
        if tag not in VOID_TAGS:
            self.open_tags.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in DROP_CONTENT_TAGS:
            self.drop_depth = max(0, self.drop_depth - 1)
            return
        if self.drop_depth or tag not in ALLOWED_TAGS or tag in VOID_TAGS:
            return
        if tag not in self.open_tags:
            return
        self.open_tags.reverse()
        self.open_tags.remove(tag)
        self.open_tags.reverse()
        self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.drop_depth:
            self.parts.append(escape(data, quote=False))

    def _clean_attrs(self, tag, attrs):
        if tag == "a":
            href = _safe_url(attrs.get("href"), allow_mailto=True)
            if not href:
                return None
            return {"href": href, "target": "_blank", "rel": "noopener noreferrer nofollow"}
        if tag == "img":
            src = _safe_url(attrs.get("src"))
            if not src:
                return None
            clean = {"src": src, "loading": "lazy", "alt": (attrs.get("alt") or "")[:300]}
            return clean
        if tag == "iframe":
            src = _safe_url(attrs.get("src"))
            host = urlsplit(src).hostname if src else ""
            if not src or host not in ALLOWED_IFRAME_HOSTS:
                return None
            return {
                "src": src,
                "width": (attrs.get("width") or "560")[:10],
                "height": (attrs.get("height") or "315")[:10],
                "loading": "lazy",
                "allowfullscreen": "allowfullscreen",
                "title": (attrs.get("title") or "Embedded video")[:200],
            }
        return {}


def sanitize_html(value):
    parser = _Sanitizer()
    parser.feed(value or "")
    parser.close()
    return "".join(parser.parts)
