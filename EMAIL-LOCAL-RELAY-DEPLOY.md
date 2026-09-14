# VaceUp local email relay patch

This is the email patch, separate from the admin dashboard ZIP. It enables the
same kind of local SMTP connection shown in the supplied Straep configuration.
It does not install a mail server or prove that TrueHost authorizes VaceUp's
sender. No passwords, private keys, database files or complete `.env` are bundled.

## 1. Upload the patch

Back up the existing application and `.env` first. Extract
`vaceup-email-local-relay-patch-20260914.zip` directly into:

```text
/home/coqrpund/vaceup_api/
```

Replace matching files. Do not create a nested `backend` folder. Files in this
patch belong at these relative paths:

- `apps/accounts/local_smtp.py`: new strictly local SMTP backend.
- `apps/accounts/mail_delivery.py`: recognizes the explicit local backend without weakening the existing remote SMTP checks.
- `apps/accounts/management/commands/diagnose_email_delivery.py`: offline checks, connection checks and an explicit single-email test.
- `apps/accounts/management/commands/mail_queue_status.py`: clear empty-queue guidance.
- `apps/accounts/tests/test_local_smtp.py`: regression tests; not run by the web application.

The ZIP also includes this guide and a file-hash manifest. This patch assumes the
database-mail release is already installed (`process_mail_queue` exists). It adds
no migration and needs no new Python dependency. The admin dashboard ZIP is not a
prerequisite, but this small patch does not contain those dashboard features.

## 2. Update only these entries in the existing .env

In cPanel File Manager, edit `/home/coqrpund/vaceup_api/.env`. Replace existing
entries with the following values; do not append conflicting duplicates and do
not replace the whole file. Leave `SECRET_KEY`, database/provider settings,
`DEFAULT_FROM_EMAIL` and `FRONTEND_BASE_URL` intact. The sender must be an
authorized VaceUp address, not Straep's address.

```dotenv
EMAIL_BACKEND=apps.accounts.local_smtp.EmailBackend
EMAIL_HOST=localhost
EMAIL_PORT=25
EMAIL_USE_TLS=False
EMAIL_USE_SSL=False
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_TIMEOUT=10

VACEUP_INFRASTRUCTURE=database
ACCOUNT_EMAIL_DELIVERY_MODE=database
WEBSOCKETS_ENABLED=False
```

Selecting this backend is the explicit local-relay opt-in; there is no additional
`EMAIL_ALLOW_LOCAL_RELAY` flag. It pins `localhost` to `127.0.0.1`, accepts only
`localhost`, `127.0.0.1` or `::1` on port 25, rejects credentials and rejects
TLS/SSL flags. Other hosts/ports fail before connecting. For remote SMTP, use
`django.core.mail.backends.smtp.EmailBackend` with the provider's encrypted
settings instead. There is no automatic fallback between the two.

Check cPanel's Python App environment variables for conflicting entries too:
pre-existing process variables can override `.env` values. Keep web and cron
settings consistent. Never execute `.env` as a shell command.

## 3. Check and restart

In cPanel Terminal:

```bash
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
cd /home/coqrpund/vaceup_api
python manage.py check
python manage.py diagnose_email_delivery --smtp
```

The diagnostic must show `Delivery mode: database`, both TLS flags false, and
`Local relay selected: loopback port 25 only; no SMTP authentication or TLS.`
Then it should report `SMTP connection accepted. No email was sent.`

If the old "require STARTTLS" error appears, check that both patched files and
the exact `EMAIL_BACKEND` value were installed. If port 25 refuses the connection,
ask TrueHost to confirm local SMTP relay access for this VaceUp application host.
The patch will not bypass a hosting restriction or switch to an external host.

Restart **VaceUp's** Python application using cPanel's Restart control. There is
no new migration or frontend build required for this email transport patch.
Do not restart or change the unrelated Straep app.

## 4. Send exactly one test message

```bash
python manage.py diagnose_email_delivery --send-test
```

When prompted, enter one email address you control. This sends one plain test
message immediately; it does not drain the queue, create an account or include a
verification/reset token. Without `--send-test`, the command never sends a test.

Check the real inbox and spam folder. "Accepted" only means the configured
backend/SMTP server accepted it. For an accepted message that does not arrive,
check cPanel > Track Delivery and the sender domain's Email Deliverability
settings (SPF/DKIM), or ask TrueHost to inspect its delivery log. Do not switch
off encryption for an external SMTP host.

## 5. Keep the mail queue running

In cPanel > Cron Jobs, keep **one** account-mail job running every minute. If it
already exists, update it rather than creating a duplicate:

```bash
/home/coqrpund/virtualenv/vaceup_api/3.12/bin/python /home/coqrpund/vaceup_api/manage.py process_mail_queue --limit 50 --max-seconds 45 >> /home/coqrpund/vaceup-mail-cron.log 2>&1
```

Entering the line in Terminal once does not install recurring cron. Redis and a
Celery worker are not required in database mode. This does not remove any Python
dependencies from the project. Marketing campaigns retain their separate cron.

For a queue test, request a new verification email for an inactive account, or a
password reset for a known active account. Then run:

```bash
python manage.py mail_queue_status
python manage.py process_mail_queue --limit 5
python manage.py mail_queue_status
```

The processing command can send up to five eligible queued messages, not just
your test. Run it only when ready to send those jobs. If the queue is still empty,
check account eligibility and whether the web request reaches this deployment
and database. A successful direct test plus a stuck queue points to the queue or
cron, not an SMTP password problem.

This patch does not silently retry previously failed messages. Request a fresh
link after configuration is repaired; old or superseded tokens may be skipped.
Status/diagnostic commands print safe codes, not private tokens or raw SMTP
replies. Share those codes if a failure remains; do not paste private keys.

## Separate known password-reset frontend gap

The current backend links to `/reset-password?token=...`, but the checked-in
frontend has no `/reset-password` page. The request-reset page exists at
`/forgot-password`; it does not implement the final password-entry step. This
transport patch can deliver reset emails, but completing a reset through the
website still needs that frontend page and a Cloudflare deployment. No claim is
made that this patch completes the entire reset user journey.

## Rollback

To return to the previous secure SMTP provider, restore its saved email settings
including `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, restore
the backed-up files if needed, and restart VaceUp. Do not use the standard SMTP
backend with the plaintext local-relay settings. Do not overwrite the database
or replace unrelated `.env` entries. No database rollback is required by this
patch itself.

## Local verification and limits

- Relay patch tests: 24/24 passed, including verification/reset delivery through the database queue and a real local SMTP capture socket. The capture server does not forward mail to real recipients.
- Full backend suite: 242 tests ran, 239 passed and three MySQL-specific tests were skipped. Tested in a secret-free snapshot excluding unrelated unfinished code.
- Migration drift check: no changes detected.
- Production-settings offline diagnostic with the documented environment: passed and identified the local relay. No live TrueHost connection was attempted.
- The repository-root UI accuracy command was also invoked as required by the workspace instructions: `RESULT: 1/37 checks passed`. It failed on missing example/harness files, the Windows `python3` alias and kit paths. This is not a passing whole-project gate; no frontend/UI code is changed or certified by this email patch.
- TrueHost sender authorization, inbox arrival, cron execution and live MySQL behavior remain deployment checks. The tests do not prove an end-to-end password reset through the missing frontend page.
