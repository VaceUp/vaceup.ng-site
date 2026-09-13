# Launch stabilization: first release

This release repairs account delivery, payment fulfillment, assessment access,
certificate issuance/verification, and server startup. It does not finish the
messaging UI, editor, whiteboard, native conferencing, marketing, or load testing.
No production credentials are included or replaced.

## cPanel upload

The patch ZIP paths are relative to `/home/coqrpund/vaceup_api/`.
Extract there, alongside `manage.py`, not inside an additional `backend` folder.
The accompanying full-backend ZIP is for a clean code deployment when your code
version is uncertain. Both exclude `.env`, user media, databases and local repairs.
Do not delete or overwrite `.env`, uploaded media, or your virtual environment.

Before uploading, pause new registrations/checkouts, back up the database and
application folder privately, and keep the old requirements file. This is a
schema-changing deployment: stop old web/worker processes during migration.
Use cPanel's Python App stop/restart controls; do not rely on frontend deployment.

In the existing server `.env`, update these settings (replace existing entries;
do not add duplicates). Also update matching cPanel application environment
variables, which take precedence over the file:

```dotenv
VACEUP_INFRASTRUCTURE=database
ACCOUNT_EMAIL_DELIVERY_MODE=database
WEBSOCKETS_ENABLED=False
```

Your existing database, SECRET_KEY, SMTP, R2 and other provider credentials stay
unchanged. Redis credentials may remain stored, but database mode does not use
Redis for cache, throttles or account mail. Stop the old Celery worker/Beat for
this mode; the cron below now schedules reminders as well as delivering mail.
Do not enable eager Celery mode as a production workaround.

After extracting the code, use the cPanel terminal:

```bash
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
cd /home/coqrpund/vaceup_api
python -m pip install -r requirements.txt
python manage.py migrate --plan
python manage.py migrate --noinput
python manage.py check
python manage.py diagnose_email_delivery --smtp
```

The requirements upgrade Django to the supported 5.2 series. Production MySQL
must meet Django's supported version requirements (MySQL 8.0.11+ or MariaDB 10.5+).
The cPanel PyMySQL compatibility shim is retained; real database compatibility
must be confirmed on staging/CI, not inferred from the SQLite tests.

The new cache table is created by migrations; no separate createcachetable step
is required. If the certificate migration detects duplicate default templates,
it stops without choosing/deleting templates. Keep the intended default per
course (and one global default), unset the others in Django admin, then retry.
Do not fake migrations to bypass an error. MySQL DDL cannot be rolled back like
an ordinary database transaction; retain the backup before starting.

## Mail cron (required for database mode)

In cPanel Cron Jobs, select **Once Per Minute** and enter this command:

```bash
/home/coqrpund/virtualenv/vaceup_api/3.12/bin/python /home/coqrpund/vaceup_api/manage.py process_mail_queue --limit 50 --max-seconds 45 >> /home/coqrpund/vaceup-mail-cron.log 2>&1
```

Keep the log outside public_html, restrict its permissions and configure log
rotation. Confirm Truehost permits this schedule and that the cron actually runs.
Never put SMTP passwords or Redis URLs in the cron command.

Restart the Python web application in cPanel. Register one controlled test
account, wait for cron, verify the email, log in, and complete password reset.
These checks must happen on your server; local mocks cannot prove SMTP delivery.

Safe troubleshooting commands:

```bash
python manage.py diagnose_email_delivery --smtp
python manage.py process_mail_queue --limit 5
python manage.py mail_queue_status
```

The SMTP diagnostic sends no email. The processing command sends queued account
mail/reminders to their intended users. `sent` means SMTP accepted the message,
not that it reached the inbox. Check your provider's delivery logs, SPF/DKIM/DMARC
and spam placement separately. A cron process is not a new service account.

After correcting a permanent error, users can request a fresh verification/reset
link. Support can retry one failed job with `python manage.py retry_mail_job ID`.
Existing valid failed jobs are listed through the database/admin tooling; expired,
superseded, cancelled or ineligible jobs are skipped at delivery time.

Unique enqueue keys and worker claims prevent ordinary duplicates. SMTP remains
at-least-once: a crash after SMTP acceptance but before recording success can
produce a duplicate email. Do not describe this as exactly-once delivery.

The default cron processes at most 50 jobs per invocation and stops starting new
attempts after 45 seconds. Actual throughput depends on SMTP latency. Monitor
old pending/failed jobs; a growing backlog requires more worker capacity and
provider quota, not larger promises about user capacity.

## Payment/certificate acceptance checks

- In Paystack test mode, buy two courses; both must appear even after the cart
  changes. Repeated verification/webhooks must not duplicate enrollment or undo
  a suspension. Missing keys must fail; fake payments are test-settings only.
- Reconcile historical cart payments separately. Earlier code may already have
  destroyed their order-item information. This release cannot reconstruct that
  lost information reliably; do not charge the student again as a repair.
- A certificate requires a completed enrollment with a completion date and an
  active applicable template. Activating a user does not complete their course.
- Test issuing twice, private PDF download, public verification, expiry and
  revocation. An issuance failure no longer reports success without a PDF.
- Tutors must not read/grade another course's work or edit its templates.
- Quiz start and submit are now separate endpoints. Short-answer quizzes remain
  awaiting manual marking; the complete manual-marking UI is not in this release.

## Deliberate limits and rollout

Collaborative WebSocket routes are disabled, rather than exposing room-name-only
access. In Redis deployments, explicitly enabled WebSockets expose only the
session-authenticated, account-scoped notification channel. JWT-based browser
WebSocket login and secure collaborative room membership remain future work.
Meet/Zoom links and ordinary dashboard APIs continue without WebSockets.

The GitHub workflow syntax is repaired and backend SQLite/MySQL regression jobs
are defined. This does not prove that Cloudflare's separate Git integration waits
for those checks, or that the remote jobs have passed. cPanel deployment remains
manual. Frontend type errors and unfinished pages remain outside this patch.

Rollback: keep maintenance mode enabled and restore the matching pre-deployment
code/environment/dependencies and database backup together. Do not blindly run
reverse migrations on a live database containing new outbox or payment records.
Verify a backup restoration on staging before opening paid enrollment.

Capacity for 1,000 users/minute is not established by this release. Staging needs
production-like MySQL, real SMTP/provider checks, realistic mixed load, queue
backlog monitoring, and measured latency/error rates before that claim is made.
