"""Tests for the real Paystack HTTP client (network stubbed, never called)."""
import io
import json
import urllib.error
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.core.exceptions import PaymentFailed, PaymentProviderUnavailable
from apps.payments.gateway import PaystackGateway, to_minor_unit


class _Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


def _http_error(code, body=b"error code: 1010"):
    return urllib.error.HTTPError(
        url="https://api.paystack.co/transaction/initialize",
        code=code,
        msg="Forbidden",
        hdrs=None,
        fp=io.BytesIO(body),
    )


class PaystackGatewayTests(SimpleTestCase):
    def setUp(self):
        self.gateway = PaystackGateway("sk_test_secret")

    def _captured_request(self):
        return self.captured

    def test_requests_identify_themselves_with_a_real_user_agent(self):
        """Cloudflare blocks urllib's default UA with HTTP 403 (error 1010)."""
        with patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value = _Response(json.dumps({"status": True, "data": {"authorization_url": "u"}}).encode())
            self.gateway.initialize(reference="ref-1", amount="30000.00", email="s@example.org")
        request = urlopen.call_args.args[0]
        agent = request.get_header("User-agent")
        self.assertTrue(agent, "the Paystack request must carry a User-Agent header")
        self.assertNotIn("Python-urllib", agent)

    def test_authorization_header_carries_the_secret_key(self):
        with patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value = _Response(json.dumps({"status": True, "data": {}}).encode())
            self.gateway.initialize(reference="ref-2", amount="100.00", email="s@example.org")
        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_header("Authorization"), "Bearer sk_test_secret")

    def test_amount_is_sent_in_kobo(self):
        with patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value = _Response(json.dumps({"status": True, "data": {}}).encode())
            self.gateway.initialize(reference="ref-3", amount="30000.00", email="s@example.org")
        payload = json.loads(urlopen.call_args.args[0].data)
        self.assertEqual(payload["amount"], 3000000)
        self.assertEqual(payload["currency"], "NGN")

    def test_blocked_request_reports_a_blocked_payment_provider(self):
        with patch("urllib.request.urlopen", side_effect=_http_error(403)):
            with self.assertRaises(PaymentFailed) as caught:
                self.gateway.initialize(reference="ref-4", amount="100.00", email="s@example.org")
        self.assertIn("403", str(caught.exception))
        self.assertIn("blocked", str(caught.exception).lower())

    def test_rejected_credentials_are_named_as_such(self):
        with patch("urllib.request.urlopen", side_effect=_http_error(401, b'{"message":"Invalid key"}')):
            with self.assertRaises(PaymentFailed) as caught:
                self.gateway.initialize(reference="ref-5", amount="100.00", email="s@example.org")
        self.assertIn("401", str(caught.exception))

    def test_rate_limiting_and_server_faults_are_temporary(self):
        for code in (429, 500, 503):
            with self.subTest(code=code):
                with patch("urllib.request.urlopen", side_effect=_http_error(code)):
                    with self.assertRaises(PaymentProviderUnavailable):
                        self.gateway.initialize(reference=f"ref-{code}", amount="100.00", email="s@example.org")

    def test_network_failures_are_temporary(self):
        with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("offline")):
            with self.assertRaises(PaymentProviderUnavailable):
                self.gateway.verify(reference="ref-6")

    def test_to_minor_unit_converts_naira_to_kobo(self):
        self.assertEqual(to_minor_unit("30000.00"), 3000000)
        self.assertEqual(to_minor_unit("5000.50"), 500050)
