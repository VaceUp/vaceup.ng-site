# VaceUp backend release 2026-10-31 (manual cPanel overlay)

Django stays on TrueHost; the Next.js site stays on Cloudflare Pages. This package is a
delta overlay: it contains only files this release changed or added relative to
`fc8d421`, the last deployment it replaces. Nothing else on the server is touched, so
your existing application files, `.env`, database, uploaded media and virtualenv stay
exactly where they are. There is no full-backend replacement here and no wholesale
`apps/` folder.

This package supersedes `vaceup-backend-2026-10-30.zip` and is cumulative from
`fc8d421`. If you already extracted the 2026-10-30 overlay, only these three files are
new in this one:

- `apps/adminpanel/serializers.py`
- `apps/adminpanel/views.py`
- `apps/certificates/views.py`

Re-extracting is safe: every file shipped by the 2026-10-30 overlay is byte-identical
in this package.

## What this overlay changes

The rebuilt administrator dashboard is frontend work and reaches production through
Cloudflare. This overlay carries the two read-shape changes those screens need:

- **Payments:** the platform payments endpoint now returns the student name, student
  email, course title and line items, so a non-technical administrator can read the
  Payments screen without opening the Django admin.
- **Certificate preview:** the template preview endpoint now also returns the
  template's page size and orientation, so the admin issue studio previews a landscape
  A4 certificate at the right shape instead of guessing.

The overlay also includes everything in the 2026-10-30 release, because this package is
cumulative from `fc8d421`:

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
- Rate limiting no longer fails a request as `503 Service Unavailable` when the
  database reports ordinary lock contention. Contention is retried; a genuinely
  unavailable database still fails closed.

## Migrations

No new migrations were added after the 2026-10-30 overlay. These are the migrations
that release introduced; on a database that already ran them, `migrate --plan` will
show no work for them.

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

## Install

1. Back up the current application files, `.env`, the database and `media/` with
   cPanel. Store the backups outside the public web directory. Do not delete anything.
2. Upload `vaceup-backend-2026-10-31.zip` and extract it directly into
   `/home/coqrpund/vaceup_api/`. After extraction the admin serializer must sit at
   `/home/coqrpund/vaceup_api/apps/adminpanel/serializers.py`, not inside a nested
   `backend/` folder. Only the listed files are written; `manage.py`,
   `passenger_wsgi.py` and `requirements.txt` are deliberately not included.
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

4. If the curriculum drafts were not seeded by the previous overlay, preview first and
   then apply with a real tutor address:

```bash
python manage.py seed_curriculum
python manage.py seed_curriculum --apply --instructor-email TUTOR_EMAIL_HERE
```

   Every course it creates is unpublished; review prices, lesson notes, meeting links
   and schedules in Admin > Content, then publish.

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

The first three must answer 200. `python manage.py check_release_routes` also resolves
those three, the Blogger source route, event registration and the certificate preview
route, so it catches a half-installed overlay before the restart.

Then, signed in as an administrator, confirm:

- Admin > Payments lists a real payment with the student name, student email, course
  title and amount.
- Admin > Certificates renders the branded preview for a chosen student and course,
  and issuing that certificate downloads a PDF that opens with the brand layout.
- Admin > Assignments creates an assignment, publishes it, and the tutor can open it
  from the teaching workspace.
- Admin > Feature Flags saves the homepage course count and the marketing delivery
  setting.
- Admin > Site Profile saves and shows on the public About page.
- A learner dashboard loads Overview, My Courses, modules and lessons, scheduled
  classes, and the Meet or classroom link.

## Frontend release order

Install and restart the backend before the frontend reaches production. The new admin
Payments and Certificates screens read the fields added here, and the public dashboard
tabs call `/api/v1/website/...` and `/api/v1/certificates/templates/preview/`.
`deploy-cloudflare.yml` triggers only on a push to `master` or `main`, so pushing the
feature branch does not deploy the site; promoting the branch does. Do not let GitHub
replace the cPanel backend.

## Rollback

Restore the backed-up source files and `.env`, then restart the app. The new tables and
columns are additive; existing content, enrollments and payments are not rewritten. Do
not restore a database dump without confirming no learner data was created after the
backup.

## Rebuilding this package

The overlay is the diff against `fc8d421`, the deployment this release replaces:

```bash
python3 scripts/package_backend_release.py --notes BACKEND-RELEASE-2026-10-31.md --base fc8d421
```

Pass `--with-unchanged` only if you deliberately want to re-ship `manage.py`,
`passenger_wsgi.py` and `requirements.txt`.

## Verification record for this build

Measured on this machine against `config.settings_test` (SQLite) and the local Node
toolchain:

- Backend suite: `Ran 357 tests in 10.432s` / `OK (skipped=3)`, exit 0.
- `python manage.py check`: `System check identified no issues (0 silenced).`
- `python manage.py makemigrations --check --dry-run`: `No changes detected`.
- `npx tsc --noEmit`: exit 0.
- `npx eslint` on the changed workspace components: exit 0.
- `npm run build`: completed, static export produced.
- `python3 scripts/check_no_emoji.py`: `Scanned 216 file(s). OK: no emoji in UI output
  or taste files.`
- Administrator dashboard rendered against the local API in headless Chrome at 1440px
  and 390px: 32 screen runs across all 16 sections, no document or main overflow, no
  console errors, one h1 per screen, no unlabelled fields, no missing image alt text,
  no fake buttons and no negative tabindex. Loading skeletons, the humanised network
  error state with recovery, the empty filtered state, the campaign drawer focus trap,
  Escape-to-close, focus return, the guide dialog and the mobile section menu were
  exercised in the same run.
- Assignments and Feature Flags were exercised end to end: create an assignment draft
  and publish it, create a quiz draft, open both compact detail pages, save a platform
  setting, and the phone drawer spans the full 390px viewport.
- Payments stat tiles hold the largest reference (NGN 18,500,000) without overflow from
  280px to 1440px.
- Campaign delivery report and lifecycle verified locally: queue, report, Failed filter
  empty state, pause, resume, cancel, and report after cancel.

Not verified on this machine: live Google Meet links and Paystack charges against
production accounts; the rate limiter against a real MySQL server (the 1205/1213 paths
are covered by tests, not by a live InnoDB burst); the certificate PDF's pixel-level
appearance in a real WeasyPrint render (WeasyPrint is not installed locally, so the
ReportLab path and extracted text geometry were checked instead).
