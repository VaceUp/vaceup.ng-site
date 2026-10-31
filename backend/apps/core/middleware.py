"""Only trust the proxy's scheme header when a real proxy sent it.

``SECURE_PROXY_SSL_HEADER`` makes Django believe a request arrived over TLS
whenever ``X-Forwarded-Proto: https`` is present. That header is client
controlled, so any caller could set it and skip ``SECURE_SSL_REDIRECT`` and the
CSRF referer check.

The API sits behind Cloudflare, which overwrites the header on the way in. This
middleware drops the header when the request did not come from Cloudflare (or
from the host itself), so the header only carries weight where it is genuine.
"""
from __future__ import annotations

import ipaddress

from django.conf import settings

# Cloudflare's published edge ranges (https://www.cloudflare.com/ips/).
# Refresh this list when Cloudflare announces a change.
CLOUDFLARE_NETWORKS = tuple(
    ipaddress.ip_network(cidr)
    for cidr in (
        # IPv4
        "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
        "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
        "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
        "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
        # IPv6
        "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
        "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
    )
)

# Networks that can only be reached from inside the host or its private LAN.
LOCAL_NETWORKS = tuple(
    ipaddress.ip_network(cidr)
    for cidr in (
        "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
        "::1/128", "fc00::/7", "fe80::/10",
    )
)

HEADER = "HTTP_X_FORWARDED_PROTO"


def _address(value: str | None):
    if not value:
        return None
    try:
        return ipaddress.ip_address(value.strip())
    except ValueError:
        return None


def is_trusted_proxy(address: str | None) -> bool:
    """True when the peer is Cloudflare or a host on this machine's network."""
    ip = _address(address)
    if ip is None:
        return False
    if any(ip in network for network in LOCAL_NETWORKS):
        return True
    return is_cloudflare_edge(address)


def is_cloudflare_edge(address: str | None) -> bool:
    """True when the peer address belongs to Cloudflare's edge."""
    ip = _address(address)
    if ip is None:
        return False
    return any(ip in network for network in CLOUDFLARE_NETWORKS)


class TrustedProxySchemeMiddleware:
    """Trust the proxy's scheme header only when a real proxy sent it."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        peer = request.META.get("REMOTE_ADDR")
        if is_cloudflare_edge(peer):
            # Cloudflare overwrites both headers, so both are genuine here.
            # Restoring the visitor address keeps anonymous rate limits
            # per person instead of per Cloudflare edge.
            client_ip = _address(request.META.get("HTTP_CF_CONNECTING_IP"))
            if client_ip is not None:
                request.META["REMOTE_ADDR"] = str(client_ip)
        elif request.META.get(HEADER):
            request.META.pop(HEADER, None)
        return self.get_response(request)
