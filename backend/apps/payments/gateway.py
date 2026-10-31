"""Thin Paystack client (stdlib only — no extra dependency).

Isolated behind ``get_gateway()`` so services depend on an interface, not on
``requests`` or the network. Tests swap in a fake gateway.

Paystack amounts are in the **minor unit** (kobo): NGN 5,000.00 -> 500000.
Webhook signatures are HMAC-SHA512 of the raw body using your SECRET key
(Paystack does not issue a separate webhook secret).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from decimal import Decimal

from django.conf import settings

from apps.core.exceptions import PaymentFailed, PaymentProviderUnavailable

logger = logging.getLogger(__name__)

PAYSTACK_BASE = "https://api.paystack.co"
# Paystack sits behind Cloudflare, which refuses urllib's default
# "Python-urllib/x.y" User-Agent with HTTP 403 (Cloudflare error 1010).
# Every request must identify itself explicitly or the provider rejects it.
USER_AGENT = "VaceUp-API/1.0 (+https://vaceup.ng)"


def to_minor_unit(amount: Decimal) -> int:
    """Naira (Decimal) -> kobo (int)."""
    return int((Decimal(amount) * 100).to_integral_value())


def verify_signature(raw_body: bytes, signature: str | None) -> bool:
    """Validate the ``x-paystack-signature`` header against the raw body."""
    secret = getattr(settings, "PAYSTACK_SECRET_KEY", "") or ""
    if not secret or not signature:
        return False
    expected = hmac.new(
        secret.encode(), raw_body, hashlib.sha512
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _error_body(exc: urllib.error.HTTPError) -> str:
    """Read a provider error body for the server log, never for the user."""
    try:
        return exc.read().decode("utf-8", "replace").strip()[:500]
    except Exception:
        return ""


def _rejection_message(code: int) -> str:
    if code == 401:
        return "Payment provider rejected our credentials (HTTP 401). Contact support."
    if code == 403:
        return "Payment provider blocked the request (HTTP 403). Contact support."
    return f"Payment provider rejected the request (HTTP {code}). Contact support."


class PaystackGateway:
    """Real Paystack HTTP client."""

    def __init__(self, secret_key: str, timeout: int = 15):
        self.secret_key = secret_key
        self.timeout = timeout

    def _request(self, method: str, path: str, payload: dict | None = None):
        url = f"{PAYSTACK_BASE}{path}"
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.secret_key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", USER_AGENT)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:  # 4xx/5xx from Paystack
            # The provider's own body distinguishes "key rejected" from
            # "request blocked"; keep it in the server log, not in the message.
            logger.warning(
                "Paystack %s %s rejected: HTTP %s %s",
                method, path, exc.code, _error_body(exc),
            )
            if exc.code == 429 or exc.code >= 500:
                raise PaymentProviderUnavailable() from None
            raise PaymentFailed(_rejection_message(exc.code)) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, ValueError):
            raise PaymentProviderUnavailable() from None
        if not body.get("status"):
            raise PaymentFailed(body.get("message", "Paystack request failed."))
        return body["data"]

    def initialize(self, *, reference, amount, email, callback_url=None):
        payload = {
            "reference": reference,
            "amount": to_minor_unit(amount),
            "email": email,
            "currency": getattr(settings, "PAYMENT_CURRENCY", "NGN"),
        }
        if callback_url:
            payload["callback_url"] = callback_url
        return self._request("POST", "/transaction/initialize", payload)

    def verify(self, *, reference):
        return self._request("GET", f"/transaction/verify/{reference}")


class FakePaystackGateway:
    """Fake gateway for tests - returns successful responses without network calls."""

    def __init__(self):
        self.initialized = {}
        self.verified = {}

    def initialize(self, *, reference, amount, email, callback_url=None):
        self.initialized[reference] = {
            "reference": reference,
            "amount": amount,
            "email": email,
        }
        return {
            "authorization_url": f"https://checkout.paystack.com/fake/{reference}",
            "access_code": "fake_access_code",
        }

    def verify(self, *, reference):
        if reference in self.verified:
            return self.verified[reference]
        # Default successful verification
        return {
            "status": "success",
            "amount": 1000000,  # 10000 NGN in kobo
            "reference": reference,
            "currency": "NGN",
        }

    def set_verification_result(self, reference, result):
        """Set a custom verification result for testing."""
        self.verified[reference] = result


_fake_gateway = None


def get_gateway() -> PaystackGateway:
    """Factory used by services; patched in tests."""
    secret = getattr(settings, "PAYSTACK_SECRET_KEY", "")
    # Use fake gateway if secret is dummy/test value
    if getattr(settings, "PAYMENTS_ALLOW_FAKE", False) and secret == "sk_test_dummy":
        global _fake_gateway
        if _fake_gateway is None:
            _fake_gateway = FakePaystackGateway()
        return _fake_gateway
    if not secret or secret == "sk_test_dummy":
        raise PaymentFailed("Payments are not configured (missing Paystack key).")
    return PaystackGateway(secret)
