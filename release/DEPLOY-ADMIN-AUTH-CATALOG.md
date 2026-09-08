# VaceUp registration, admin navigation and catalogue patch

This patch fixes the supplied repository. It has not been deployed to your live server, and it is not a certification that the entire LMS is production-ready or can serve 1,000 users per minute.

## Packages and destinations

| Package | Destination | Contents |
| --- | --- | --- |
| `backend-changed-files.zip` | `/home/coqrpund/vaceup_api/` | Changed Python files and new migrations, using paths relative to the application root |
| `frontend-static.zip` | The document root/deployment for `vaceup.ng`, NOT `api.vaceup.ng` | Complete generated static website, including `_next`, `course`, `verify-email`, and `dashboard` |
| `frontend-source-patch.zip` | Your existing frontend source repository | Changed source and tests; use this instead of the compiled package if your host builds from Git |

Each archive includes a file/checksum manifest. No environment file, database, uploaded media, private key, server log, or node_modules is included. Keep your existing backend `.env` and hosting configuration. Do not upload source code or the backend archive to the public website document root.

The backend destination comes from the correct `stderr (1).log`. The earlier log belonged to another application and was not used as a deployment target. Confirm cPanel's Application Root is still `vaceup_api` before uploading.

## What the evidence showed

- Registration traces failed while publishing a verification email to Celery: the broker refused the connection. A committed inactive account could remain after the failed request; retrying signup could then produce a duplicate-email HTTP 400. This explains a plausible sequence, not proof that every 400 has this cause.
- The frontend discarded Django REST Framework field errors and treated a successful registration as a login, even though registration returns no access token. There was no matching verification page for the link in the email.
- Admin links updated the Next.js query string, while the displayed tab listened only for browser history/hash events.
- The log contained missing admin settings/announcement tables, a missing `Payment` import, and a Passenger startup file recursively loading itself. These were historical log entries; current server state must be checked after deployment.
- The homepage and other public pages used different hardcoded course lists. Course creation also expected UUIDs although the provided database schema uses numeric primary keys, and the admin serializer referenced a nonexistent course `name` field.

## Deployment order

1. Take a restorable database backup and a backup of the existing backend files and frontend deployment. Keep them outside the public document root. Use a maintenance window for schema changes.
2. In cPanel, open the Python app for `api.vaceup.ng`. Activate its virtual environment using the exact command cPanel displays. Open a terminal at `/home/coqrpund/vaceup_api`.
3. Inspect `backend-changed-files.zip` and its manifest. Extract it into a temporary staging directory first. Compare the existing migrations and models with this patch. Stop if your live app has diverged (for example, UUID primary keys or a different migration with the same filename). Do not overwrite an independently modified migration.
4. Copy the archive's `apps/`, `config/settings.py`, and `passenger_wsgi.py` into their matching locations under `/home/coqrpund/vaceup_api/`. Preserve `.env`, media, virtualenv, and unrelated files. There must NOT be an extra `backend/` directory between the application root and `manage.py`.
5. Check the schema and apply migrations before restarting web or worker processes:

```sh
cd /home/coqrpund/vaceup_api
python -m pip check
python manage.py check
python manage.py showmigrations accounts adminpanel courses
python manage.py migrate --plan
```

New migrations in this patch:

- `accounts/0002_user_admin_guide_dismissed`: saves the guide preference on the user account.
- `adminpanel/0001_initial`: creates the existing admin action-log, settings and system-announcement tables.
- `courses/0004_course_duration_course_image_url`: stores public course duration and cover-image URL.

Check existing admin tables without reading user data:

```sh
python manage.py shell -c "from django.db import connection; print([t for t in connection.introspection.table_names() if t.startswith('adminpanel_')])"
```

If the admin migration is unapplied and NONE of its three tables exist, run the normal migration. If all tables already exist, have your technical operator compare their columns, constraints and indexes with the migration first. Only an exact existing schema is a candidate for `migrate adminpanel --fake-initial`. If only some tables exist, stop and reconcile the partial schema; do not fake the migration or delete tables to force it through. Django's `--fake-initial` checks table presence, not full schema equivalence. See [Django's migration guidance](https://docs.djangoproject.com/en/5.2/topics/migrations/#initial-migrations).

```sh
python manage.py migrate --noinput
python manage.py showmigrations accounts adminpanel courses
python manage.py collectstatic --noinput
python manage.py check --deploy
```

Do not run `makemigrations` on the live server. Review every pending operation shown by `migrate --plan`, including migrations from earlier deployments.

## Restore email delivery: the keys alone are not sufficient

Keep your real credentials in `/home/coqrpund/vaceup_api/.env` or the Python app's private environment, never in the public frontend.

Check these existing settings:

| Variable | Required live value/meaning |
| --- | --- |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | Must include `api.vaceup.ng` |
| `FRONTEND_BASE_URL` | `https://vaceup.ng` |
| `CORS_ALLOWED_ORIGINS` | Include the actual HTTPS frontend origins; no wildcard |
| `REDIS_URL` | Working Redis/Upstash TCP connection URL; NOT the Upstash REST URL |
| `CELERY_BROKER_URL` | Working broker URL, or leave blank to inherit `REDIS_URL` |
| `CELERY_RESULT_BACKEND` | Working result backend, or leave blank to inherit the broker |
| `CELERY_TASK_ALWAYS_EAGER` | `False` for production async delivery |
| `EMAIL_HOST`, `EMAIL_PORT` | Actual SMTP endpoint and port; this app uses STARTTLS on 587 by default |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | Actual SMTP credentials |
| `EMAIL_USE_TLS` | Match your SMTP provider's STARTTLS setting |
| `DEFAULT_FROM_EMAIL` | A sender verified with your provider |

Do not leave `EMAIL_HOST` blank: the existing configuration falls back to console email, which writes the verification link to logs instead of delivering it. Do not enable synchronous/eager email to mask a broken queue. A successful queue submission also does not prove SMTP delivery; verify receipt in a controlled smoke test.

The patch bounds Celery publish connection/retry settings and requires certificate verification for `rediss://` defaults. Do not add `ssl_cert_reqs=none` to a Redis URL. Check provider TCP access and TLS requirements; a Redis REST credential cannot substitute for a broker connection. See [Celery's Redis TLS settings](https://docs.celeryq.dev/en/stable/userguide/configuration.html#broker-use-ssl).

Configure a process supervisor supported by your host to keep these running from the application root, inside the same virtual environment and environment settings:

```sh
celery -A config worker --loglevel=INFO
celery -A config beat --loglevel=INFO
```

Run only ONE beat scheduler for this deployment. A terminal command that dies when you log out is not a production worker setup. If your cPanel plan cannot supervise background workers, move the worker to a suitable host/VPS connected to the same database and broker. Do not start a worker inside Passenger's startup file.

Restart the Python app using cPanel's Restart control, and restart the supervised worker/beat after deploying the Python changes. The startup file must be `passenger_wsgi.py` and the callable `application`; it imports `config.wsgi` directly.

Read-only worker check:

```sh
celery -A config inspect ping --timeout=5
```

The log also showed the Passenger/LSAPI process ceiling being reached. Ask the host to review process limits, memory and CPU after the startup and queue faults are fixed. Increasing worker counts without capacity measurements can overload the database or exhaust RAM.

## Bring the existing homepage courses into the backend

The import contains the FIVE courses from the actual homepage component, not the separate unused marketing catalogue. It preserves the homepage's displayed prices, descriptions and durations; it does not invent ratings, learner counts, lessons or tutor accounts.

| Course | Category | Existing homepage price (NGN) |
| --- | --- | ---: |
| Virtual Assistant | Professional Skills | 80,000 |
| Data Analysis | Data & Analytics | 150,000 |
| UI/UX Design | Design | 120,000 |
| Graphic Design | Design | 100,000 |
| Web Development | Development | 180,000 |

Preview first (no writes):

```sh
python manage.py import_homepage_catalog
```

Then supply the email of an existing ACTIVE tutor in your backend. This command prompts for it instead of embedding a made-up email:

```sh
read -r -p 'Existing active tutor email: ' CATALOG_TUTOR_EMAIL
python manage.py import_homepage_catalog --apply --instructor-email "$CATALOG_TUTOR_EMAIL"
```

The import creates only missing records as DRAFTS, matches existing courses by slug or case-insensitive title, and never overwrites existing course prices, tutors, categories or publication state. It runs transactionally. Re-running it does not duplicate its courses in normal sequential operation; do not run multiple imports concurrently.

In Admin > Courses:

1. Review the four category definitions. Add or rename categories as needed.
2. Open each course's Edit details section. Review title, description, category, actual tutor, duration and cover URL. An existing uploaded thumbnail has priority over the cover URL.
3. Review the price with Change price. Assign the correct tutor per course rather than leaving all courses with the initial import tutor if different people teach them.
4. Prepare modules/lessons in Content. The import is not a teaching-content migration.
5. Publish only courses you are ready to offer. Only published records are shown publicly. Until then an empty public catalogue is expected.

Categories cannot be deleted from the new UI, avoiding accidental disruption to courses that reference them. The existing Kids Academy promotional section is separate and was not imported as adult course records.

## Deploy the frontend

Deploy the complete `frontend-static.zip` contents to the hosting project/document root for `vaceup.ng`. Keep the `_next/` folder and each route directory in their original structure. If using a Git-based Cloudflare build, apply `frontend-source-patch.zip` instead, build with `NEXT_PUBLIC_API_URL=https://api.vaceup.ng`, and publish `frontend/out`.

Do not upload only individual changed HTML files: they reference matching compiled chunks. Prefer a new atomic hosting deployment that can be rolled back. Keep old immutable `_next/static` assets temporarily if performing an in-place upload so existing browser sessions can finish loading. Invalidate cached HTML after deployment, not just the homepage.

The compiled package targets `https://api.vaceup.ng`. New detail links use `/course?slug=...`, which works with static hosting even for courses created after the build. The old `/courses/1` through `/courses/5` URLs point to the corresponding course slugs. API calls bypass static HTML course-data snapshots; backend catalogue changes appear on the next page load.

Review your host's existing headers/CSP separately. The existing Cloudflare `_headers` configuration is not a verified production-security policy and this patch does not certify it. cPanel does not apply Cloudflare `_headers` files automatically.

## Live smoke test after deployment

- Register one controlled test address. Expect a clear validation error or 201 with a verification notice, NOT immediate dashboard access.
- Confirm the worker sends the email. Open `/verify-email?token=...`, select Verify email address, then sign in. A verification link must work only once.
- If an earlier attempt already created an inactive account, use `/verify-email` to resend its link. Do NOT delete the account or bypass verification by changing `is_active`.
- Verify registration with an already-used email displays the actual field error instead of just HTTP 400. Confirm unrelated tokens are not sent on public registration requests.
- Sign in as an administrator. Click every sidebar destination, use Back/Forward, and open a direct `/dashboard?tab=courses` link. No full refresh should be needed.
- Close the guide without opting out, sign out and sign in again: it should appear again. Tick Never show again, close it, then sign in from another session: it should stay dismissed. Guide & site map always reopens it; uncheck and close to re-enable it.
- Create/rename a category, assign it to a draft, review and publish a course, then check the homepage, catalogue and detail page show its real category and price. Unpublish it and verify anonymous access is removed.
- Check new server logs for missing tables, recursion, SMTP errors and queue failures. Do not send full logs with secrets or learner details to third parties.

## Rollback and remaining production work

If smoke testing fails, roll back the frontend deployment and restore the backed-up Python files. The new database fields/tables are additive; do not reverse migrations or drop the new tables as a routine rollback. Keep the backup and migration history for a technical review.

This patch is limited to registration, the reported admin navigation problem, admin guidance, and public catalogue/category consistency. It does NOT prove live SMTP/Redis connectivity, payment settlement, live-class media, messaging, disaster recovery, cross-worker idempotency, or load capacity. The wider repository still contains TypeScript/design-gate failures and older admin actions with inconsistent ID assumptions that need a separate audit. Complete staging integration/security tests and a representative load test before calling the entire LMS production-ready.

See `ADMIN-GUIDE.md` for the administrator's section-by-section map and `VERIFICATION.md` for the measured checks and limitations.
