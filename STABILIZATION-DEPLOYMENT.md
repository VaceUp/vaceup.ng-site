# VaceUp stabilization release: manual cPanel deployment

This release keeps Django on TrueHost and the frontend on Cloudflare. GitHub backend jobs are tests, not deployments. Install the backend before promoting the matching frontend branch. The whole project is not yet production-certified; see STABILIZATION-WORKLOG.md for verified results and remaining gates.

## What is in the ZIP

The backend ZIP is a complete source overlay, not a database backup. Its root contains `manage.py`, `passenger_wsgi.py`, `requirements.txt`, `apps/` and `config/`. It deliberately excludes `.env`, credentials, databases, uploads, collected static files and virtual environments. A manifest records each included file's SHA-256 hash.

It includes manual enrollment for previously paid students; payment integrity fixes; announcement audience restrictions; messaging/notification integration and migration; deployment route diagnostics; and the existing deletion and homepage-import routes missing from the observed live deployment. The password-reset page itself belongs to the frontend release.

## Install on cPanel

1. Back up the current application files, private `.env`, database and uploaded media using cPanel. Keep backups outside the publicly served directory. Do not delete the existing backend or database.
2. Schedule a short maintenance window for checkout and account changes during migrations. Upload the supplied ZIP and extract its contents directly into `/home/coqrpund/vaceup_api/`. The result must be `/home/coqrpund/vaceup_api/manage.py`, not an extra nested `backend/` folder. Overwrite source files only; preserve `.env`, media and database.
3. In cPanel Terminal run:

```bash
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
cd /home/coqrpund/vaceup_api
python -m pip install -r requirements.txt
python manage.py migrate --plan
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py check
python manage.py check_release_routes
```

4. In **Setup Python App**, restart the application whose root is `vaceup_api` and URL is `api.vaceup.ng`. A successful terminal check alone does not reload Passenger's web process.
5. After backend installation and passing CI, promote `codex/production-stabilization` into the production frontend branch through your existing GitHub/Cloudflare workflow. Pushing this release branch alone does not prove a production deployment. Do not configure GitHub to replace the backend on cPanel.

The three new migrations cover payment pricing versions, message blocks/reports/idempotency, and the manual-enrollment audit action. Existing course progress and successful purchases are retained.

## Activate a student who paid outside the platform

In **Admin > Enrollments > Activate previously paid student**:

1. Find the active student by name or email and choose the published course.
2. Select an existing paid student or a payment received outside the platform.
3. Enter the receipt/reference if available and a note describing the payment record you verified.
4. Confirm the named student/course and select **Activate course access**.

Only an active administrator can grant access. The action is audited and retry-safe. It does not create a Paystack transaction, increase collected platform revenue, reset progress, reactivate a suspended enrollment, or activate an unverified account. Ordinary approval of a paid-course application still requires payment. Existing enrollments are left unchanged.

## Existing payments and temporary restrictions

- Historical successful purchases and their existing access are preserved. Pre-upgrade pending/failed orders require support reconciliation before access can be granted. Check the provider record and original approved amount; never ask an already-debited student to pay again merely because the platform cannot auto-confirm an old order.
- Shared code-editor and whiteboard HTTP APIs are temporarily denied because classroom membership controls are incomplete. External-meeting live-class scheduling is not disabled. Secure collaborative classroom functionality remains a separate task.
- Deleting a user still requires the protected preview/confirmation flow. It does not erase backups, external uploads or retained audit records. Do not test it on a real learner.

## Email: preserve the working local-relay setup

No Redis connection is needed in database infrastructure mode. Keep the same values in your private `.env` and cPanel application's environment-variable settings; process-level settings can override `.env`.

```dotenv
VACEUP_INFRASTRUCTURE=database
WEBSOCKETS_ENABLED=False
ACCOUNT_EMAIL_DELIVERY_MODE=database
EMAIL_BACKEND=apps.accounts.local_smtp.EmailBackend
EMAIL_HOST=localhost
EMAIL_PORT=25
EMAIL_USE_TLS=False
EMAIL_USE_SSL=False
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_TIMEOUT=20
```

Keep your verified VaceUp sender, frontend URL, secret key, database and provider credentials unchanged. Do not copy Straep's sender or secrets. Restart the Python app after changing cPanel environment settings. From a fresh terminal, run:

```bash
python manage.py diagnose_email_delivery --smtp
python manage.py mail_queue_status
```

In **cPanel > Cron Jobs**, use **Once Per Minute** (`* * * * *`) and this command:

```bash
/home/coqrpund/virtualenv/vaceup_api/3.12/bin/python /home/coqrpund/vaceup_api/manage.py process_mail_queue --limit 50 --max-seconds 45 >> /home/coqrpund/vaceup-mail-cron.log 2>&1
```

Cron does not inherit exports typed into a previous terminal session. If a fresh diagnostic still says TLS is true, correct the persistent environment/file before relying on cron. The worker must pass its local-relay checks, not bypass them. This release has not verified live inbox delivery.

## Verify the deployed release

- Open `/reset-password/` directly: it must render a helpful missing-link state, not a 404. Request a fresh reset for your own existing account, confirm cron drains the queue, open the emailed link, reset once, and verify that reuse fails.
- Sign in as admin. Open a disposable test user's deletion preview without deleting the user. A persistent preview 404 after a successful route check means the web process, application root or deployed host still differs from the terminal process.
- Open Courses > Import homepage courses. Review before importing: existing courses must not be overwritten. New records remain drafts until an admin publishes them.
- Use a dedicated test student to verify manual access and unchanged progress. The frontend action should report active access without a new payment record.
- Check messaging between enrolled classmates and a tutor; test blocking and explicit read acknowledgments. This release uses bounded HTTP polling, not WebSocket presence.
- Complete provider test-mode payment verification and workload testing on a staging environment before claiming 1,000 users/minute. Do not load-test the shared live server without coordination.

## Recovery

If installation checks fail, keep the previous frontend version and pause affected writes. Preserve logs without publishing credentials. Restore a compatible application backup with its matching database backup if a rollback is needed; restoring the database loses writes made after the backup. Do not blindly reverse migrations or delete new audit/payment/message records. The ZIP itself contains no user data and cannot restore the database.
