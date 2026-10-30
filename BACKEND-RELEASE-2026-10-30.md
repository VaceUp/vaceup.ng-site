# VaceUp backend release 2026-10-30 (manual cPanel overlay)

Django stays on TrueHost, the Next.js site stays on Cloudflare Pages. This package is a
delta overlay: it contains only files this release changed or added. Nothing else on the
server is touched, so your existing application files, `.env`, database, uploaded media
and virtualenv stay exactly where they are. There is no full-backend replacement here and
no wholesale `apps/` folder.

## What ships in this release

- Public website content API (`apps/website`): academy profile, team and founder
  profiles, events with registrations, and Blogger-mirrored blog posts, all editable
  from the admin dashboard without a developer.
- Course curriculum seed (`seed_curriculum`): 7 adult and 5 Kids Tech Academy courses
  written as unpublished drafts for admin review before publishing.
- Live teaching structure: module week and duration, per-lesson or per-module Google
  Meet link, and the removal of the redundant external video URL from lesson editing.
- Assignments and assessments: publishing flag, grading ledger, submission storage,
  and the tutor/admin workflows that use them.
- Certificates: branded HTML/CSS design, a seeded default landscape A4 template, a
  real server-rendered preview endpoint for the admin issue studio, and a ReportLab
  renderer that draws the brand design when WeasyPrint is unavailable.
- Applications: address fields so an application submitted from the marketing site
  carries the applicant's city and country.
- Media storage: course covers, team photos and event covers now fall back to local
  disk when no S3 bucket is configured, so direct image upload works on shared hosting.

## Migrations applied by this release

| App | Migration |
|-----|-----------|
| applications | `0002_application_city_application_country_and_more` |
| assignments | `0003_assessmentgradelog`, `0004_assignment_is_published` |
| certificates | `0003_branded_default_template` |
| courses | `0006_module_duration_minutes_module_meeting_url_and_more`, `0007_alter_course_thumbnail` |
| website | `0001_initial`, `0002_alter_event_cover_image_alter_teammember_photo` |

`0003_branded_default_template` inserts one global default certificate template only if
no global default exists yet. Existing certificates and templates are not modified.
`makemigrations --check` reports no unmade migrations for this tree.

## Environment variables

Nothing new is required. Two optional variables exist:

- `AWS_PUBLIC_STORAGE_BUCKET_NAME` (default empty): separate bucket for public assets.
  Empty means public assets use `AWS_STORAGE_BUCKET_NAME`.
- `BLOGGER_SYNC_SECONDS` (default 900): interval for the `website.sync_blogger_posts`
  Celery beat entry. Only used when `VACEUP_INFRASTRUCTURE=redis` and a beat worker
  actually runs.

The Blogger API key and blog address are stored in the database and edited in
Admin > Blog, never in `.env`. Keep every Paystack key server-side; do not move payment
secrets into admin settings.

## Behaviour on the TrueHost shared stack

- WeasyPrint is not in `requirements.txt`, so certificate PDFs are drawn by the
  ReportLab path in `apps/certificates/services.py`. That path renders the same brand
  layout (frame, gold rule, corner marks, seal, signature columns, verification footer)
  rather than a text dump.
- Without a configured bucket, `STORAGES["default"]` writes to `media/private/` and
  public images to `media/public/`. Only `media/public/` is served over HTTP, through
  the route added in `config/urls.py`. `media/private/` stays unsigned and unserved.
- On `VACEUP_INFRASTRUCTURE=database` there is no beat worker, so blog posts sync when
  an admin presses Sync now, or on a cPanel cron schedule (see below).

## Install

1. Back up the current application files, `.env`, the database and `media/` with
   cPanel. Store the backups outside the public web directory. Do not delete anything.
2. Upload `vaceup-backend-2026-10-30.zip` and extract it directly into
   `/home/coqrpund/vaceup_api/`. After extraction the new app must sit at
   `/home/coqrpund/vaceup_api/apps/website/views.py`, not inside a nested `backend/`
   folder. Only the listed files are written; `manage.py`, `passenger_wsgi.py` and
   `requirements.txt` are deliberately not included because this release does not
   change them, so nothing that already works on your server is replaced.
3. In cPanel Terminal:

```bash
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
cd /home/coqrpund/vaceup_api
python -V
python manage.py migrate --plan
python manage.py migrate --noinput
python manage.py check
python manage.py check_release_routes
python manage.py collectstatic --noinput
```

4. Seed the curriculum drafts. The command previews by default and writes nothing:

```bash
python manage.py seed_curriculum
python manage.py seed_curriculum --apply --instructor-email TUTOR_EMAIL_HERE
```

   Pass an active tutor's real address. Every course it creates is unpublished; review
   prices, lesson notes, meeting links and schedules in Admin > Content, then publish.
5. Optional, once the Blogger source is filled in under Admin > Blog:

```bash
python manage.py sync_blogger
```

   To keep posts fresh without Redis, add a cPanel cron job every 15 minutes:

```
*/15 * * * * cd /home/coqrpund/vaceup_api && /home/coqrpund/virtualenv/vaceup_api/3.12/bin/python manage.py sync_blogger >> /home/coqrpund/logs/blogger-sync.log 2>&1
```

6. Restart the Python application in cPanel (**Setup Python App** > the app rooted at
   `vaceup_api`, URL `api.vaceup.ng` > Restart). A terminal check does not reload the
   Passenger worker.

## Smoke checks after restart

```bash
curl -s -o /dev/null -w "profile  %{http_code}\n" https://api.vaceup.ng/api/v1/website/profile/
curl -s -o /dev/null -w "events   %{http_code}\n" https://api.vaceup.ng/api/v1/website/events/
curl -s -o /dev/null -w "posts    %{http_code}\n" https://api.vaceup.ng/api/v1/website/posts/
curl -s -o /dev/null -w "health   %{http_code}\n" https://api.vaceup.ng/healthz/
```

The first three must answer 200. `python manage.py check_release_routes` now also
resolves those three, the Blogger source route, event registration and the certificate
preview route, so it catches a half-installed overlay before the restart. Then, signed
in as an administrator, confirm:
Admin > Site Profile saves and shows on the public About page; Admin > Events creates a
draft and publishes it; Admin > Blog syncs and lists posts; Admin > Certificates shows
the branded preview for a chosen student and course; issuing that certificate downloads
a PDF that opens with the brand layout; a student dashboard loads Overview, My Courses,
modules and lessons, scheduled classes, and the Meet or classroom link.

## Frontend release order

Install and restart the backend before the frontend reaches production. The new
dashboard tabs call `/api/v1/website/...` and
`/api/v1/certificates/templates/preview/`, which 404 until this overlay and its
migrations are live. `deploy-cloudflare.yml` triggers only on a push to `master` or
`main`, so pushing the feature branch does not deploy the site; promoting the branch
does. Do not let GitHub replace the cPanel backend.

## Rollback

Restore the backed-up source files and `.env`, then restart the app. The new tables and
columns are additive; existing content, enrollments and payments are not rewritten. Do
not restore a database dump without confirming no learner data was created after the
backup.

## Rebuilding this package

The overlay is the diff against `fc8d421`, the deployment this release replaces:

```bash
python3 scripts/package_backend_release.py --base fc8d421
```

Pass `--with-unchanged` only if you deliberately want to re-ship `manage.py`,
`passenger_wsgi.py` and `requirements.txt`.

## Verification record for this build

Measured on this machine against `config.settings_test` (SQLite) and the local
Node toolchain:

- Backend suite: `Ran 355 tests in 11.636s` / `OK (skipped=3)`, exit 0.
- Certificates app alone: 11 tests, including the preview authorization tests and the
  no-WeasyPrint PDF render, `OK`.
- `python manage.py check`: `System check identified no issues (0 silenced).`
- `python manage.py makemigrations --check --dry-run`: `No changes detected`.
- `npx tsc --noEmit --incremental false`: exit 0.
- `npx next build`: exit 0, static export completed.
- `python3 scripts/check_no_emoji.py`: `Scanned 216 file(s). OK: no emoji in UI output or taste files.`
- Certificate text colours measured with `scripts/contrast.py`: `#00088A` on white
  17.28:1, `#007878` 5.31:1, `#8a6508` 5.32:1, remaining body tones 7.50:1 and above.
  The earlier `#008B8B` (4.15:1) and `#b8860b` (3.25:1) were replaced.
- Generated PDF geometry checked with pypdf text extraction: page size, centred
  signature names, seal position and the two footer lines are placed as intended.

Not verified yet on this machine: the certificate PDF's pixel-level appearance (no
rasterizer is installed here, so layout was confirmed by extracted text coordinates and
contrast math, not by looking at an image), the CSS design in a real WeasyPrint render
(WeasyPrint is not installed locally either), live Google Meet links and Paystack
charges against production accounts, and the `scripts/accuracy_report.mjs` /
`scripts/verify_responsive.mjs` gates against the dashboard screens.
