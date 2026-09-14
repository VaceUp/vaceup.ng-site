"""Local relay policy, diagnostic safety and real loopback SMTP delivery tests."""
from contextlib import contextmanager
from io import StringIO
import smtplib
import socket
import socketserver
import threading
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMessage, get_connection
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings

from apps.accounts import services
from apps.accounts.local_smtp import EmailBackend, LocalRelayConfigurationError
from apps.accounts.mail_delivery import email_configuration_errors, send_account_message
from apps.accounts.models import EmailVerificationToken, MailJob, PasswordResetToken


LOCAL_SETTINGS = {
    "EMAIL_BACKEND": "apps.accounts.local_smtp.EmailBackend",
    "EMAIL_HOST": "localhost", "EMAIL_PORT": 25,
    "EMAIL_HOST_USER": "", "EMAIL_HOST_PASSWORD": "",
    "EMAIL_USE_TLS": False, "EMAIL_USE_SSL": False, "EMAIL_TIMEOUT": 5,
    "DEFAULT_FROM_EMAIL": "VaceUp <no-reply@example.org>",
    "FRONTEND_BASE_URL": "https://vaceup.ng", "ACCOUNT_EMAIL_DELIVERY_MODE": "database",
}


@override_settings(**LOCAL_SETTINGS)
class LocalRelayPolicyTests(SimpleTestCase):
    def test_localhost_is_pinned_without_dns_or_connecting(self):
        with patch("socket.getaddrinfo", side_effect=AssertionError("No DNS during validation")):
            self.assertEqual(email_configuration_errors(), [])
            self.assertEqual(get_connection().host, "127.0.0.1")

    def test_explicit_loopback_addresses_are_accepted(self):
        for host in ["127.0.0.1", "::1", "LOCALHOST"]:
            with self.subTest(host=host), override_settings(EMAIL_HOST=host):
                self.assertEqual(email_configuration_errors(), [])

    def test_non_loopback_and_ambiguous_hosts_are_rejected(self):
        for host in ["smtp.example.org", "localhost.example.org", "localhost.",
                     "192.168.1.2", "0.0.0.0", "127.0.0.2", "127.1", "2130706433",
                     "[::1]", "::ffff:127.0.0.1", "http://localhost", "localhost:25"]:
            with self.subTest(host=host), override_settings(EMAIL_HOST=host):
                with self.assertRaises(LocalRelayConfigurationError):
                    get_connection()
                self.assertTrue(email_configuration_errors())

    def test_constructor_cannot_override_destination(self):
        with self.assertRaises(LocalRelayConfigurationError):
            get_connection(host="smtp.example.org")

    def test_reused_connection_is_revalidated_before_opening(self):
        connection = get_connection()
        connection.host = "smtp.example.org"
        with patch("smtplib.SMTP") as smtp, self.assertRaises(LocalRelayConfigurationError):
            connection.open()
        smtp.assert_not_called()

    def test_only_port_25_is_accepted(self):
        for port in [465, 587, 1624, 0, "25"]:
            with self.subTest(port=port), override_settings(EMAIL_PORT=port):
                with self.assertRaises(LocalRelayConfigurationError):
                    get_connection()

    def test_credentials_are_rejected_even_if_both_are_present(self):
        for username, password in [("account", "secret"), ("account", ""), ("", "secret")]:
            with self.subTest(username=bool(username), password=bool(password)), override_settings(
                EMAIL_HOST_USER=username, EMAIL_HOST_PASSWORD=password,
            ):
                with self.assertRaises(LocalRelayConfigurationError):
                    get_connection()
                self.assertNotIn("secret", " ".join(email_configuration_errors()))

    def test_tls_flags_are_not_silently_overridden(self):
        for tls, ssl in [(True, False), (False, True), (True, True)]:
            with self.subTest(tls=tls, ssl=ssl), override_settings(EMAIL_USE_TLS=tls, EMAIL_USE_SSL=ssl):
                self.assertTrue(email_configuration_errors())

    def test_timeout_is_bounded(self):
        for timeout in [None, 0, -1, 61, float("inf"), float("nan"), True, "5"]:
            with self.subTest(timeout=timeout), override_settings(EMAIL_TIMEOUT=timeout):
                with self.assertRaises(LocalRelayConfigurationError):
                    get_connection()

    def test_silent_delivery_does_not_hide_invalid_configuration(self):
        with override_settings(EMAIL_HOST="smtp.example.org"), self.assertRaises(LocalRelayConfigurationError):
            get_connection(fail_silently=True)

    def test_standard_smtp_has_no_plaintext_exception(self):
        for host in ["localhost", "smtp.example.org"]:
            with self.subTest(host=host), override_settings(
                EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend", EMAIL_HOST=host,
            ):
                self.assertTrue(any("require STARTTLS" in error for error in email_configuration_errors()))
                with self.assertRaises(ImproperlyConfigured):
                    send_account_message(EmailMessage("Test", "Test", to=["learner@example.org"]))

    def test_remote_starttls_and_implicit_ssl_remain_valid(self):
        for port, tls, ssl in [(587, True, False), (465, False, True)]:
            with self.subTest(port=port), override_settings(
                EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend", EMAIL_HOST="smtp.example.org",
                EMAIL_PORT=port, EMAIL_USE_TLS=tls, EMAIL_USE_SSL=ssl,
                EMAIL_HOST_USER="account", EMAIL_HOST_PASSWORD="test-only-password",
            ):
                self.assertEqual(email_configuration_errors(), [])

    def test_connection_failure_is_not_silenced_or_redirected(self):
        with patch("smtplib.SMTP", side_effect=ConnectionRefusedError("offline")) as smtp:
            with self.assertRaises(ConnectionRefusedError):
                get_connection().open()
        self.assertEqual(smtp.call_count, 1)
        self.assertEqual(smtp.call_args.args[:2], ("127.0.0.1", 25))


@override_settings(**LOCAL_SETTINGS)
class DeliveryDiagnosticTests(SimpleTestCase):
    def test_default_diagnostic_is_offline_and_does_not_prompt(self):
        output = StringIO()
        with patch("smtplib.SMTP") as smtp, patch("builtins.input") as prompt:
            call_command("diagnose_email_delivery", stdout=output)
        smtp.assert_not_called()
        prompt.assert_not_called()
        self.assertIn("Local relay selected", output.getvalue())

    def test_smtp_diagnostic_connects_but_never_sends(self):
        output = StringIO()
        with patch.object(EmailBackend, "open", return_value=True) as opened, patch.object(EmailBackend, "send_messages") as send:
            call_command("diagnose_email_delivery", smtp=True, stdout=output)
        opened.assert_called_once()
        send.assert_not_called()
        self.assertIn("No email was sent", output.getvalue())

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_explicit_test_sends_one_token_free_message(self):
        output = StringIO()
        with patch("builtins.input", return_value="owner@example.org"):
            call_command("diagnose_email_delivery", send_test=True, stdout=output)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["owner@example.org"])
        self.assertNotIn("token=", mail.outbox[0].body)
        self.assertNotIn("owner@example.org", output.getvalue())

    def test_invalid_recipient_never_sends(self):
        for recipient in ["", "bad", "a@example.org,b@example.org", "owner@example.org\nBcc: x@example.org"]:
            with self.subTest(recipient=recipient), patch("builtins.input", return_value=recipient), patch.object(EmailBackend, "send_messages") as send:
                with self.assertRaises(CommandError):
                    call_command("diagnose_email_delivery", send_test=True, stdout=StringIO())
                send.assert_not_called()

    def test_cancelled_prompt_never_sends(self):
        for failure in [EOFError, KeyboardInterrupt]:
            with self.subTest(failure=failure), patch("builtins.input", side_effect=failure), patch.object(EmailBackend, "send_messages") as send:
                with self.assertRaisesMessage(CommandError, "No email was sent"):
                    call_command("diagnose_email_delivery", send_test=True, stdout=StringIO())
                send.assert_not_called()

    def test_test_failure_exposes_only_a_safe_code(self):
        with patch("builtins.input", return_value="owner@example.org"), patch.object(
            EmailBackend, "send_messages", side_effect=smtplib.SMTPDataError(550, b"private server details"),
        ):
            with self.assertRaises(CommandError) as error:
                call_command("diagnose_email_delivery", send_test=True, stdout=StringIO())
        self.assertIn("smtp_rejected", str(error.exception))
        self.assertNotIn("private", str(error.exception))
        self.assertIsNone(error.exception.__cause__)

    def test_invalid_configuration_prevents_prompt_and_send(self):
        with override_settings(EMAIL_HOST="smtp.example.org"), patch("builtins.input") as prompt:
            with self.assertRaisesMessage(CommandError, "requires EMAIL_HOST"):
                call_command("diagnose_email_delivery", send_test=True, stdout=StringIO())
        prompt.assert_not_called()


class _SMTPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        self.connection.settimeout(5)
        self.wfile.write(b"220 local test capture\r\n")
        while True:
            line = self.rfile.readline(65536)
            if not line:
                return
            command = line.split(b" ", 1)[0].strip().upper()
            self.server.commands.append(command)
            if command in {b"EHLO", b"HELO"}:
                self.wfile.write(b"250-local capture\r\n250 SIZE 1048576\r\n")
            elif command in {b"MAIL", b"RCPT", b"RSET"}:
                self.wfile.write(b"250 OK\r\n")
            elif command == b"DATA":
                self.wfile.write(b"354 Send message\r\n")
                data = []
                while True:
                    content = self.rfile.readline(65536)
                    if not content:
                        return
                    if content == b".\r\n":
                        break
                    data.append(content)
                self.server.messages.append(b"".join(data))
                self.wfile.write(b"250 Captured locally; not relayed\r\n")
            elif command == b"QUIT":
                self.wfile.write(b"221 Bye\r\n")
                return
            else:
                self.wfile.write(b"502 Unsupported\r\n")


@contextmanager
def local_smtp_capture():
    """Use a real loopback socket without binding production/privileged port 25."""
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), _SMTPHandler)
    server.daemon_threads = True
    server.commands, server.messages = [], []
    worker = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.02}, daemon=True)
    worker.start()
    connect = socket.create_connection

    def connect_to_capture(address, *args, **kwargs):
        if address != ("127.0.0.1", 25):
            raise AssertionError("Only the pinned loopback destination is allowed in this test")
        return connect(server.server_address, *args, **kwargs)

    try:
        with patch("smtplib.socket.create_connection", side_effect=connect_to_capture):
            yield server
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)


@override_settings(**LOCAL_SETTINGS)
class LocalRelayQueueTests(TestCase):
    def test_verification_and_reset_traverse_database_queue_and_real_smtp(self):
        with local_smtp_capture() as capture, patch("redis.Redis.execute_command", side_effect=AssertionError("No Redis")), patch(
            "apps.accounts.tasks.send_verification_email.apply_async", side_effect=AssertionError("No Celery"),
        ), patch("apps.accounts.tasks.send_password_reset_email.apply_async", side_effect=AssertionError("No Celery")):
            user = services.register_user(email="learner@example.org", full_name="Learner", password="Test-password-42")
            self.assertEqual(MailJob.objects.get().status, "pending")
            self.assertEqual(len(capture.messages), 0)
            call_command("process_mail_queue", limit=1, stdout=StringIO())
            self.assertEqual(MailJob.objects.get().status, "sent")
            self.assertIn(b"Subject: Verify your VaceUp account", capture.messages[0])
            self.assertIn(str(EmailVerificationToken.objects.get().token).encode(), capture.messages[0])
            # Activate for the reset eligibility check without triggering a
            # welcome message. The relay patch does not change activation rules.
            user.is_active = True
            user.save(update_fields=["is_active"])
            services.request_password_reset(email=user.email)
            call_command("process_mail_queue", limit=1, stdout=StringIO())
            self.assertEqual(MailJob.objects.filter(status="sent").count(), 2)
            self.assertIn(b"Subject: Reset your VaceUp password", capture.messages[1])
            self.assertIn(str(PasswordResetToken.objects.get().token).encode(), capture.messages[1])
            self.assertNotIn(b"AUTH", capture.commands)
            self.assertNotIn(b"STARTTLS", capture.commands)

    def test_direct_diagnostic_reaches_capture_without_processing_pending_jobs(self):
        services.register_user(email="learner@example.org", full_name="Learner", password="Test-password-42")
        with local_smtp_capture() as capture, patch("builtins.input", return_value="owner@example.org"):
            call_command("diagnose_email_delivery", send_test=True, stdout=StringIO())
            self.assertEqual(len(capture.messages), 1)
            self.assertIn(b"Subject: VaceUp email delivery test", capture.messages[0])
            self.assertEqual(MailJob.objects.get().status, "pending")

    def test_empty_queue_has_explicit_safe_guidance(self):
        output = StringIO()
        call_command("mail_queue_status", stdout=output)
        self.assertIn("Mail queue is empty in this database", output.getvalue())

    def test_nonempty_queue_still_reports_safe_counts(self):
        services.register_user(email="learner@example.org", full_name="Learner", password="Test-password-42")
        output = StringIO()
        call_command("mail_queue_status", stdout=output)
        self.assertIn("pending code=- count=1", output.getvalue())
        self.assertNotIn("learner@example.org", output.getvalue())
