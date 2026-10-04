# Targeted admin deployment repair - 24 September 2026

This is a manual cPanel overlay, not a full backend or a GitHub deployment.
It restores the older admin/course files identified by the server diagnostic,
their required helpers, and the original migrations. No `.env`, database,
uploads, dependencies or frontend files are replaced.

## What the diagnostic established

- Admin settings definitions/public URLs resolve to a generic setting lookup.
- `apps/adminpanel/platform_settings.py` is absent.
- The homepage import URL does not resolve to the import action.
- Four installed migrations remain unapplied (adminpanel 0002/0003, messaging
  0003, payments 0003).
- Four announcement tables and two messaging tables are absent; message retry
  IDs and payment pricing-version columns are also absent.
- Announcements 0001 is not in the reported pending migrations. Its migration
  package may be missing; alternatively, recorded migration history may not
  match the database. Do not assume these are equivalent or fake migrations.

## Install

1. Export the application database in cPanel/phpMyAdmin and download that backup.
   Preserve copies of the existing files listed in `ADMIN-REPAIR-MANIFEST.json`.
   MySQL schema migrations may not roll back fully if interrupted.
2. Extract `vaceup-admin-deployment-repair-2026-09-24.zip` directly into
   `/home/coqrpund/vaceup_api/`, allowing replacement of the listed source files.
   `apps/` must merge with the existing `apps/` folder beside `manage.py`.
   Do not delete the existing backend, upload it into a nested backend folder,
   or replace `.env`. There is no automatic migration or restart in the ZIP.
3. In the already activated application terminal, run these commands separately:

```bash
python manage.py check
```

```bash
python manage.py migrate --plan
```

For the supplied report, the expected plan includes announcements 0001,
adminpanel 0002/0003, messaging 0003 and payments 0003. Stop on any error.
If announcements 0001 is absent from the plan while its tables are still missing,
send `python diagnose_admin_deployment.py` output before proceeding. That could
mean migration history says applied despite missing tables; this ZIP does not
rewrite that history. Likewise, stop if the plan includes unexpected destructive
operations or unrelated migrations.

Once that plan is confirmed, run:

```bash
python manage.py migrate
```

```bash
python manage.py check_release_routes
```

```bash
python diagnose_admin_deployment.py
```

Expected: all 14 release route checks pass; all five diagnostic route bindings
match; missing tables/columns and pending migrations are empty; announcements
0001 is both on disk and applied. Do not use `--fake`, `--fake-initial`, or
`makemigrations` to work around errors. If migration fails, stop and send the
error; do not blindly repeat schema changes on MySQL.

4. Restart the VaceUp Python application using cPanel > Setup Python App.
   Command-line checks do not restart the running web process.
5. Refresh the frontend. Check Platform Settings first, then refresh a test
   user's deletion preview. Review preview blockers; do not delete an account
   just to test whether the screen loads. Publish a course only when you intend
   it to become public. Importing the former homepage courses remains a separate
   admin action and preserves matching courses' existing edits.

## Safeguards and limits

- Existing course prices, categories, publication states and enrollments are not
  changed by this package. The included importer does not run on extraction or
  during migrations.
- Existing payment rows are retained. The original payments 0003 migration marks
  them with pricing_version=0 for reconciliation; it does not charge anyone or
  remove successful enrollments. Do not ask an already-charged learner to pay
  again because a historical pending transaction needs reconciliation.
- Deletion safety checks stay in place: the current admin account, protected
  accounts, payment history and shared teaching records can block deletion. A
  tutor owning courses is not disposable simply because it began as a test user.
- No Redis, SMTP, CORS or environment changes are needed for this repair.
- The publication request's exact exception was not supplied. Correcting these
  confirmed deployment gaps is necessary, but is not proof that its separate
  Failed to fetch error is resolved. If it remains after restart, capture the
  request time, browser Network status and corresponding Python stderr traceback.

See `STABILIZATION-WORKLOG.md` in the local repository for verification evidence.
