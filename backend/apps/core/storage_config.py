"""Pure storage URL helpers, safe to import before Django initializes."""
import ipaddress
import re
from urllib.parse import urlsplit, urlunsplit


def endpoint_url(raw):
    """Return a clean S3 service origin, or blank for absent/invalid input.

    Validation deliberately does not raise during settings import. Private
    storage distinguishes invalid nonempty input from a genuinely blank AWS
    endpoint and refuses the former before constructing a client.
    """
    value = str(raw or "").strip()
    if not value or any(character.isspace() or character in '<>"\\' for character in value):
        return ""
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        if (parsed.scheme not in {"http", "https"} or not host or parsed.username is not None
                or parsed.password is not None or parsed.path not in {"", "/"}
                or parsed.query or parsed.fragment or "?" in value or "#" in value):
            return ""
        # Accessing .port validates invalid ports and malformed IPv6 values.
        if parsed.port is not None and not 1 <= parsed.port <= 65535:
            return ""
        try:
            address = ipaddress.ip_address(host)
            local = address.is_loopback
        except ValueError:
            encoded = host.encode("idna").decode("ascii")
            if len(encoded) > 253 or any(not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label) for label in encoded.split(".")):
                return ""
            local = host.lower() == "localhost"
        # Browser publication from an HTTPS site cannot use an HTTP bucket.
        # Keep localhost HTTP usable for isolated S3-compatible test servers.
        if parsed.scheme == "http" and not local:
            return ""
        return urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
    except (ValueError, UnicodeError):
        return ""


def is_r2_endpoint(endpoint):
    host = (urlsplit(endpoint or "").hostname or "").lower()
    return host.endswith(".r2.cloudflarestorage.com")
