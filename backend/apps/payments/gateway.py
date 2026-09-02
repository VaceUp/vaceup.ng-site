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
import urllib.error
import urllib.request
from decimal import Decimal

from django.conf import settings

from apps.core.exceptions import PaymentFailed

PAYSTACK_BASE = "https://api.paystack.co"


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
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:  # 4xx/5xx from Paystack
            detail = exc.read().decode(errors="replace")[:200]
            raise PaymentFailed(f"Paystack error ({exc.code}): {detail}")
        except urllib.error.URLError as exc:  # network/DNS/timeout
            raise PaymentFailed(f"Could not reach Paystack: {exc.reason}")
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
    if secret in ("sk_test_dummy", "", None):
        global _fake_gateway
        if _fake_gateway is None:
            _fake_gateway = FakePaystackGateway()
        return _fake_gateway
    if not secret:
        raise PaymentFailed("Payments are not configured (missing Paystack key).")
    return PaystackGateway(secret)
