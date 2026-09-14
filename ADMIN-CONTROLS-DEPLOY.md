# Admin controls release

## What this release adds

- Admin course management at Dashboard > Courses and `/dashboard/courses/`: drafts, categories, tutor assignment, price, description, duration, cover image upload/removal, publication, modules, lessons and existing R2 video controls.
- An Import homepage courses button. It imports missing original catalogue entries as drafts and preserves matching courses. Select an existing active tutor. These are catalogue records, not completed lesson content.
- Marketing draft creation/editing, audience review, admin test email, queue/schedule, pause/resume/cancel, and recipient delivery reports. Registered active accounts only; newsletter leads are not included.
- Platform settings with two implemented controls: homepage course count (1–20) and a marketing delivery switch. Provider credentials stay in `.env`.
- Permanent deletion from the user directory, with a read-only record preview, typed account email, administrator password, expiring confirmation and audit receipt.

## Deploy the backend through cPanel

The backend is NOT deployed by a GitHub push. Use the backend ZIP on your server. The frontend is deployed separately through GitHub/Cloudflare.

1. Download a database backup and a copy of the existing application before overwriting files. Keep the current `.env` and uploads private. This release does not erase or replace them.
2. Upload and extract the **patch ZIP directly into `/home/coqrpund/vaceup_api/`**, replacing matching files. `manage.py`, `apps/` and `config/` must be in that directory, not a nested `backend` folder. The full-backend ZIP is an alternative if you need the complete code tree; do not upload both.
3. Run:

```bash
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
cd /home/coqrpund/vaceup_api
python manage.py check
python manage.py migrate --plan
python manage.py migrate
python manage.py collectstatic --noinput
```

New migrations cover marketing delivery claims, the deletion audit action and the previously missing announcements tables. If migration reports that an announcements table already exists, stop and check the existing table structure before faking any migration. Do not use `--fake` blindly.

4. Restart **VaceUp's** Python application in cPanel. Restarting this app may briefly interrupt requests; you do not need to delete or take down the old backend first.
5. Keep the existing database-based infrastructure settings. Redis and Celery are not required for these features:

```dotenv
VACEUP_INFRASTRUCTURE=database
ACCOUNT_EMAIL_DELIVERY_MODE=database
WEBSOCKETS_ENABLED=False
```

No new secret is needed. The unsubscribe-link API origin defaults to `https://api.vaceup.ng`. Only if using another API domain, set `MARKETING_PUBLIC_API_URL` to its HTTPS origin, without `/api/v1`.

## Install marketing delivery cron

In cPanel > Cron Jobs, add a job **once every minute**:

```bash
/home/coqrpund/virtualenv/vaceup_api/3.12/bin/python /home/coqrpund/vaceup_api/manage.py process_marketing_queue --limit 10 --max-seconds 45 >> /home/coqrpund/vaceup-marketing-cron.log 2>&1
```

Running this line once in Terminal does not install a recurring cron job. Keep your existing `process_mail_queue` cron for registration, password-reset and reminder emails; marketing uses a separate queue. Check TrueHost's allowed sending volume and lower the limit if necessary. Do not schedule multiple marketing processors intentionally.

The delivery switch is OFF by default. First save a small draft and use **Send test to my email**. Check the actual inbox/spam folder. Then enable **Feature Flags > Allow marketing email delivery > Save setting**, review the intended audience, and confirm the campaign. A future schedule uses the administrator browser's local time and is sent to the API with its timezone.

Campaign status refreshes automatically while its screen is open; use Refresh campaigns for an immediate update. Due messages are processed on cron runs, not instantly inside the request. Sent means SMTP accepted, not guaranteed inbox delivery. Open/click tracking is deliberately disabled; no invented engagement statistics are displayed.

## Verify after deployment

- Frontend/Cloudflare: ensure the new commit is deployed, then reload the dashboard once to obtain the new bundle. Subsequent panel navigation should not require refreshes.
- Courses: import missing homepage courses using a real active tutor, select Drafts, edit the records, add curriculum and publish only when ready. Only published courses appear publicly.
- Settings: change homepage course count and open the homepage in a separate signed-out browser. Drafts must remain hidden.
- Marketing: test to the administrator address first, then explicitly confirm only a permitted audience. Check cron output and the recipient report. Never treat saving a draft as sending it.
- Users: test deletion with a disposable account. It must require its email and your administrator password. The deleted account must no longer log in.

## Important limits

- Administrators/staff, users with payment history, tutors owning protected teaching records, and accounts whose deletion would remove unknown/shared records are blocked from hard deletion. Use Disable or reassign eligible teaching records first. This is deliberate protection, not a broken button.
- Database account deletion does not erase backups, externally stored uploads or retained audit records. Personal messages and the listed dependent records are removed; certificates deleted with the account will no longer verify.
- Pause/cancel/the delivery switch cannot recall an email already in flight. SMTP does not offer exactly-once delivery guarantees. Interrupted claims are marked for investigation rather than automatically resent. Check provider logs before creating a replacement campaign.
- This release does not prove 1,000 users per minute on shared hosting. MySQL concurrency/load tests, real R2 upload/playback and inbox delivery require checks in the deployment environment.
- Password-reset email troubleshooting remains deferred at your request.

## Rollback

Turn off marketing delivery, disable its cron and restore the backed-up application if necessary. Do not reverse migrations or restore a database over new production activity without reviewing data loss. Keep the old `.env` and uploads. Preserve the release manifest so the deployed files can be identified.
