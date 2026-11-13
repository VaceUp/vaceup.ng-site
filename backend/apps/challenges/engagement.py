"""Counter evidence is attributed to its source; missing counts are never zero."""
from datetime import datetime
from decimal import Decimal, InvalidOperation, localcontext
from html.parser import HTMLParser
import http.client
import ipaddress
import json
import re
import socket
import ssl
from urllib.parse import unquote, urlsplit, urljoin

from django.conf import settings
from django.utils import timezone

METRICS = ("likes", "comments", "shares", "views")
MAX_COUNT = 10 ** 12
ALIASES = {"like": "likes", "likes": "likes", "reactions": "likes", "reaction": "likes",
           "comment": "comments", "comments": "comments", "share": "shares", "shares": "shares",
           "view": "views", "views": "views", "plays": "views"}


def canonicalize_post_url(value, platform=None):
    parsed = urlsplit(str(value or "").strip())
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Use a public HTTPS LinkedIn or Instagram post link without credentials.")
    host = (parsed.hostname or "").lower()
    path = unquote(parsed.path)
    if host in {"instagram.com", "www.instagram.com"}:
        match = re.fullmatch(r"/(p|reel|tv)/([A-Za-z0-9_-]{5,80})/?", path)
        if not match or platform not in (None, "", "instagram"):
            raise ValueError("Use the public Instagram post or reel URL.")
        return "instagram", f"instagram:{match[2]}", f"https://www.instagram.com/{match[1]}/{match[2]}/"
    if host in {"linkedin.com", "www.linkedin.com"}:
        match = re.fullmatch(r"/feed/update/urn:li:(activity|share|ugcPost):([0-9]{5,30})/?", path)
        if match:
            kind, identifier = match[1], match[2]
        else:
            match = re.fullmatch(r"/posts/[^/]*activity-([0-9]{5,30})(?:-[A-Za-z0-9_-]+)?/?", path)
            if not match:
                raise ValueError("Use a LinkedIn post URL, not a profile or company page.")
            kind, identifier = "activity", match[1]
        if platform not in (None, "", "linkedin"):
            raise ValueError("The selected platform does not match this post URL.")
        return "linkedin", f"linkedin:{kind}:{identifier}", f"https://www.linkedin.com/feed/update/urn:li:{kind}:{identifier}/"
    raise ValueError("Only public LinkedIn and Instagram post URLs are supported.")


def parse_count(value):
    if value is None or (isinstance(value, str) and value.strip().lower() in {"", "n/a", "na", "null", "none", "hidden", "unavailable", "-"}):
        return None
    if isinstance(value, bool):
        raise ValueError("A counter must be a non-negative whole number.")
    text = str(value).strip()
    if re.fullmatch(r"\d{1,3}(,\d{3})+", text):
        text = text.replace(",", "")
    if not re.fullmatch(r"\d+(?:\.\d+)?[kKmM]?", text):
        raise ValueError("A counter must be a non-negative whole number.")
    multiplier = 1000 if text[-1:].lower() == "k" else 1000000 if text[-1:].lower() == "m" else 1
    try:
        count = Decimal(text[:-1] if multiplier != 1 else text) * multiplier
    except InvalidOperation:
        raise ValueError("Invalid counter.")
    if count != count.to_integral_value() or not 0 <= count <= MAX_COUNT:
        raise ValueError("Counter is outside the supported whole-number range.")
    return int(count)


def parse_counts(mapping):
    if not isinstance(mapping, dict):
        raise ValueError("Counters must be an object.")
    return {metric: parse_count(mapping.get(metric)) for metric in METRICS}


def extract_counter_rows(rows):
    """Read explicit labelled counters from CSV/XLSX rows, not arbitrary numbers."""
    candidates = {metric: [] for metric in METRICS}
    flags = []
    rows = list(rows)[:500]
    for index, row in enumerate(rows):
        values = list(row)[:60]
        for column, value in enumerate(values):
            metric = ALIASES.get(str(value or "").strip().lower())
            if not metric:
                continue
            # Header row followed by values, or a two-column key/value table.
            options = []
            key_value = len(values) == 2 and column == 0
            if key_value:
                try:
                    parse_count(values[1])
                except ValueError:
                    key_value = False
            if key_value:
                options.append(values[1])
            elif index + 1 < len(rows) and column < len(rows[index + 1]):
                options.append(rows[index + 1][column])
            for raw in options:
                try:
                    count = parse_count(raw)
                except ValueError:
                    flags.append(f"invalid_{metric}_counter")
                    continue
                if count is not None:
                    candidates[metric].append(count)
                    if isinstance(raw, str) and raw.strip()[-1:].lower() in {"k", "m"}:
                        flags.append(f"rounded_{metric}_counter")
    result = {}
    for metric, values in candidates.items():
        unique = set(values)
        result[metric] = values[0] if len(unique) == 1 else None
        if len(unique) > 1:
            flags.append(f"conflicting_{metric}_counters")
    return {"counts": result, "flags": sorted(set(flags)), "source": "participant_supplied"}


def engagement_points(likes, comments, likes_target, comments_target):
    likes, comments = parse_count(likes), parse_count(comments)
    if likes is None or comments is None:
        return None
    if not likes_target or not comments_target:
        raise ValueError("Publish positive likes and comments targets before scoring engagement.")
    # Bounded, fixed targets: a missing metric never shrinks the denominator.
    with localcontext() as context:
        context.prec = 28
        like_points = min((Decimal(likes) + 1).ln() / (Decimal(likes_target) + 1).ln(), Decimal(1)) * 12
        comment_points = min((Decimal(comments) + 1).ln() / (Decimal(comments_target) + 1).ln(), Decimal(1)) * 8
        return (like_points + comment_points).quantize(Decimal("0.0001"))


def reconcile_counts(declared, extracted, publicly_observed=None):
    declared, extracted = parse_counts(declared or {}), parse_counts(extracted or {})
    flags = []
    for metric in METRICS:
        if declared[metric] is not None and extracted[metric] is not None and declared[metric] != extracted[metric]:
            flags.append(f"declared_{metric}_disagrees_with_evidence")
    if publicly_observed:
        public = parse_counts(publicly_observed)
        for metric in METRICS:
            if public[metric] is not None and extracted[metric] is not None and public[metric] != extracted[metric]:
                flags.append(f"public_{metric}_differs_check_observation_times")
    return flags


class _StructuredPostParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_json = False
        self.buffer = []
        self.documents = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("type", "").lower() == "application/ld+json":
            self.in_json = True
            self.buffer = []

    def handle_data(self, data):
        if self.in_json:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.in_json:
            self.in_json = False
            try:
                self.documents.append(json.loads("".join(self.buffer)))
            except (ValueError, RecursionError):
                pass


def parse_public_post_html(html, post_url):
    """Only count structured observations belonging to the requested post."""
    _, expected, _ = canonicalize_post_url(post_url)
    parser = _StructuredPostParser()
    parser.feed(html[:2 * 1024 * 1024])
    observed = {metric: None for metric in METRICS}
    flags = []

    def visit(node, depth=0):
        if depth > 12:
            return
        if isinstance(node, list):
            for item in node[:200]:
                visit(item, depth + 1)
        elif isinstance(node, dict):
            candidate = node.get("url") or node.get("@id")
            matches = False
            if isinstance(candidate, str):
                try:
                    matches = canonicalize_post_url(urljoin(post_url, candidate))[1] == expected
                except ValueError:
                    pass
            if matches:
                interactions = node.get("interactionStatistic", [])
                if isinstance(interactions, dict):
                    interactions = [interactions]
                if not isinstance(interactions, list):
                    interactions = []
                for interaction in interactions[:30]:
                    if not isinstance(interaction, dict):
                        continue
                    action = interaction.get("interactionType", "")
                    action = action.get("@type", "") if isinstance(action, dict) else action
                    action = str(action).rsplit("/", 1)[-1]
                    metric = {"LikeAction": "likes", "CommentAction": "comments", "ShareAction": "shares", "WatchAction": "views"}.get(action)
                    if metric:
                        try:
                            value = parse_count(interaction.get("userInteractionCount"))
                        except ValueError:
                            flags.append(f"invalid_public_{metric}")
                            continue
                        if observed[metric] is not None and observed[metric] != value:
                            flags.append(f"conflicting_public_{metric}")
                            observed[metric] = None
                        else:
                            observed[metric] = value
            for key in ("@graph", "mainEntity", "mainEntityOfPage"):
                if key in node:
                    visit(node[key], depth + 1)
    for document in parser.documents:
        visit(document)
    return {"counts": observed, "flags": sorted(set(flags)), "status": "needs_review" if flags else "observed" if any(value is not None for value in observed.values()) else "unavailable"}


def _read_public_page(url, *, redirects=0):
    """Pinned public DNS, HTTPS-only, bounded bytes; no login or browser bypass."""
    _, _, canonical = canonicalize_post_url(url)
    parsed = urlsplit(canonical)
    addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    public_ips = []
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("Post host resolved to a non-public address.")
        public_ips.append(str(ip))
    if not public_ips:
        raise ValueError("Post host could not be resolved.")
    connection = http.client.HTTPSConnection(parsed.hostname, timeout=10)
    try:
        socket_connection = socket.create_connection((public_ips[0], 443), timeout=10)
        connection.sock = ssl.create_default_context().wrap_socket(socket_connection, server_hostname=parsed.hostname)
        connection.request("GET", parsed.path, headers={"Host": parsed.hostname, "User-Agent": "VaceUpChallengeObservation/1.0", "Accept": "text/html", "Accept-Encoding": "identity"})
        response = connection.getresponse()
        if response.status in (301, 302, 303, 307, 308):
            if redirects >= 2:
                raise ValueError("Post redirected too many times.")
            return _read_public_page(urljoin(canonical, response.getheader("Location", "")), redirects=redirects + 1)
        if response.status != 200 or "text/html" not in response.getheader("Content-Type", ""):
            raise ValueError("Public post is unavailable without login or access permission.")
        body = response.read(2 * 1024 * 1024 + 1)
        if len(body) > 2 * 1024 * 1024:
            raise ValueError("Public post exceeds the observation size limit.")
        return body.decode("utf-8", errors="replace")
    finally:
        connection.close()


def collect_public_observation(post_url):
    _, _, canonical = canonicalize_post_url(post_url)
    result = {"source": "publicly_observed", "post_url": canonical, "observed_at": timezone.now().isoformat(),
              "counts": {metric: None for metric in METRICS}, "status": "unavailable", "flags": []}
    if getattr(settings, "CHALLENGE_PUBLIC_COUNTER_COLLECTOR", "disabled") != "permitted_public_html":
        result["flags"] = ["public_collector_not_enabled"]
        return result
    try:
        html = _read_public_page(canonical)
        result.update(parse_public_post_html(html, canonical))
        if result["status"] == "unavailable":
            result["flags"].append("public_counters_not_exposed")
    except (ValueError, OSError, http.client.HTTPException):
        result["flags"] = ["public_post_unavailable"]
    return result
