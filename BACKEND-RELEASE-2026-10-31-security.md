# VaceUp backend release 2026-10-31 (security hardening overlay)

Django stays on TrueHost; the Next.js site stays on Cloudflare Pages. This package is
a delta overlay: it contains only files that changed or added relative to `fc8d421`,
the deployment this release replaces. Nothing else on the server is touched, so your
existing application files, `.env`, database, uploaded media and virtualenv stay
exactly where they are. There is no full-backend replacement here and no wholesale
`apps/` folder.

This package is cumulative from `fc8d421`, so it also contains the website content
API, the curriculum seed, the live teaching structure, the branded certificates and
the certificate signatures shipped by the earlier 2026-10-30 and 2026-10-31
overlays. Re-extracting over an installation that already has them is safe: the files
are byte-identical.

It replaces `vaceup-backend-2026-10-31.zip` and
`vaceup-backend-2026-10-31-signatures.zip`. Extract this one instead of both.

## Read this before you install

Three secrets were exposed in the repository history and must be rotated. Removing
the file from git does not remove it from history.

1. `SECRET_KEY`
2. `JWT_SIGNING_KEY`
3. `DB_PASSWORD`

Full detail, including the evidence for every change, is in
`SECURITY-HARDENING-2026-10-31.md` (shipped in this package).

## What this overlay changes

- **The leaked archive is gone.** `backend.zip` was tracked in git and contained the
  production `backend/.env`. It is untracked now, and `scripts/check_no_secrets.py`
  (shipped in this package) fails the build if a tracked file ever holds a live
  credential again.
- **Dependency floors moved above known advisories:** Django `>=5.2.17`,
  djangorestframework `>=3.18.2`, djangorestframework-simplejwt `>=5.5.1`,
  PyJWT `>=2.15.1`, Pillow `>=13.0.0`, PyMySQL `>=1.2.0`. `requirements.txt` is
  included in this overlay for that reason; this is the one release where it ships.
- **The proxy scheme header is only trusted from Cloudflare.** A client could
  previously set `X-Forwarded-Proto: https` and make Django believe the request was
  already encrypted, which skipped the HTTPS redirect and the CSRF referer check on
  the staff login. The new middleware also restores the visitor address from
  Cloudflare, so anonymous rate limits count people instead of edge addresses.
- **Certificate signatures fit the column that stores them.** Uploads are re-encoded
  and capped, so a large signature can no longer fail on save in MySQL.
- **Uploaded images must carry an image extension** (`jpg`, `jpeg`, `png`, `webp`).
- **The Paystack webhook is rate limited** on its own scope.
- **Changing a password retires outstanding verification and reset links**, and the
  password reset window dropped from 1 hour to 30 minutes.
- **Hardening headers and limits:** `CSRF_COOKIE_HTTPONLY`, a stricter referrer
  policy, environment-driven HSTS, explicit upload limits, and a configurable
  `ADMIN_URL` for the staff login.

## Migrations

Run these; `migrate` applies them in dependency order.

| App | Migrations |
|-----|-----------|
| accounts | `0004_tutorprofile_certificate_signature_and_more` |
| applications | `0002_application_city_application_country_and_more` |
| assignments | `0003_assessmentgradelog`, `0004_assignment_is_published` |
| certificates | `0003_branded_default_template`, `0004_certificate_tutor`, `0005_signature_placeholders` |
| courses | `0006_module_duration_minutes_module_meeting_url_and_more`, `0007_alter_course_thumbnail`, `0008_alter_course_thumbnail` |
| website | `0001_initial`, `0002_alter_event_cover_image_alter_teammember_photo`, `0003_alter_event_cover_image_alter_teammember_photo` |

All are additive. `makemigrations --check` reports no unmade migrations for this
tree.

## Install

1. Back up the current application files, `.env`, the database and `media/` with
   cPanel. Store the backups outside the public web directory. Do not delete anything.
2. Rotate the three secrets in `/home/coqrpund/vaceup_api/.env`. Generate values with
   `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing
   `SECRET_KEY` signs every user out and retires outstanding account links; changing
   the database password also means updating it in cPanel's MySQL section.
3. Upload `vaceup-backend-2026-10-31-security.zip` and extract it directly into
   `/home/coqrpund/vaceup_api/`. After extraction `apps/core/middleware.py` must sit at
   `/home/coqrpund/vaceup_api/apps/core/middleware.py`, not inside a nested `backend/`
   folder. Only the listed files are written; `manage.py` and `passenger_wsgi.py` are
   deliberately not included.
4. In cPanel Terminal:

```bash
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
cd /home/coqrpund/vaceup_api
python -V
pip install --upgrade -r requirements.txt
python manage.py migrate --plan
python manage.py migrate --noinput
python manage.py check
python manage.py check_release_routes
python manage.py collectstatic --noinput
```

   The `pip install --upgrade` step raises Django, DRF, PyJWT, Pillow and PyMySQL to
   the patched floors. Pillow 13 changes the image backend, so run the suite or
   upload a course cover and a signature once after the restart to confirm images
   still process.

5. Restart the Python application in cPanel (**Setup Python App** > the app rooted at
   `vaceup_api`, URL `api.vaceup.ng` > Restart). A terminal check does not reload the
   Passenger worker.

## Smoke checks after restart

```bash
curl -s -o /dev/null -w "health   %{http_code}\n" https://api.vaceup.ng/healthz/
curl -s -o /dev/null -w "courses  %{http_code}\n" https://api.vaceup.ng/api/v1/courses/
```

The health check must answer 200. The courses endpoint may answer 200 or 401; both
prove the app is serving. Then:

- Sign in as a student and confirm the dashboard loads (the new middleware must not
  cause a redirect loop or a 403 on the CSRF check).
- Sign in as an administrator and upload a course cover image; the upload must
  succeed.
- Upload a certificate signature as a tutor and issue a certificate; the download
  must open with both signatures.
- Send one test payment and confirm the webhook still enrols the student. If the
  webhook rate limit is ever hit, Paystack retries and the handler stays idempotent.

## Rollback

Restore the backed-up source files and `.env`, then restart the app. The new columns
and tables are additive; existing certificates, enrollments and payments are not
rewritten. Do not restore a database dump without confirming no learner data was
created after the backup.

## Rebuilding this package

The overlay is the diff against `fc8d421`, the deployment this release replaces:

```bash
python3 scripts/package_backend_release.py \
  --notes BACKEND-RELEASE-2026-10-31-security.md \
  --out vaceup-backend-2026-10-31-security.zip \
  --base fc8d421 \
  --include backend/requirements.txt
```

## Verification record for this build

Measured on this machine against `config.settings_test` (SQLite) and the local Node
toolchain:

- Backend suite: `Ran 373 tests in 12.207s` / `OK (skipped=3)`, exit 0.
- `python manage.py makemigrations --check --dry-run`: `No changes detected`.
- `python3 scripts/check_no_secrets.py`: `clean (970 tracked files scanned)`.
- Dependency floors checked against the GitHub Advisory Database on 2026-10-31;
  Pillow 13.0.0 installed locally and exercised by the suite.
- `npx tsc --noEmit`: exit 0. `npm run build`: exit 0.
