# Backend release 2026-11-01 — uploads, emailed links, cohort date

Delta overlay only. Every file listed here is new or changed by this release;
nothing else in `/home/coqrpund/vaceup_api/` is touched.

**The 2026-10-31 curriculum overlay is already applied on the server and this
release builds on top of it.** No curriculum file is re-shipped here, so
`sync_curriculum`, `seed_curriculum` and `apps/courses/curriculum.py` keep
working exactly as they do now.

## What this release fixes

**1. "Service Unavailable" on every image upload** (course covers, founder and
team photos, event images). Measured on the running code before the fix: saving
a public image raised `ValueError: Invalid endpoint: `. The cause is in `.env`,
not in the app:

- `AWS_S3_ENDPOINT_URL` had no value of its own, so python-dotenv read the
  trailing text of the example line — `# Set for Cloudflare R2 ...` — as the
  endpoint. boto3 rejected it, and every storage call died.
- `AWS_STORAGE_BUCKET_NAME` carried a placeholder while both access keys were
  empty. A bucket name on its own is not a usable object store: without keys,
  uploads become anonymous S3 requests that fail.

The app now treats object storage as configured only when the bucket **and**
both keys are present, ignores an endpoint that is not a URL, and falls back to
local disk — which is what a server with no completed S3 block should do.

**2. The forgotten-password link opened a 404 page.** The link was built from
`FRONTEND_BASE_URL`, and on this deployment that value is the API origin, so the
email pointed at `https://api.vaceup.ng/reset-password/…`. That host is Django,
which has no such page and returns its own "Not Found". Measured live: the API
origin returns Django's Not Found page while `https://vaceup.ng/reset-password/`
returns 200. Emailed links are now always built on a real site origin, never the
API host, and always with the trailing slash the static frontend is served under.
The same builder fixes the certificate verification link and the live-class
reminder join hint.

**3. The homepage cohort date was hard-coded.** "New cohort starts 21 September
2026" was typed into the hero and the final call to action, so it could only be
changed by deploying the frontend. It now comes from Admin > Site Profile.

## What changed

### Backend

| File | Change |
| --- | --- |
| `config/settings.py` | `OBJECT_STORAGE_CONFIGURED` (bucket **and** both keys), `_endpoint_url()` rejects a value that is not an `http(s)` URL, `FRONTEND_LINK_BASE` repairs a missing or API-host `FRONTEND_BASE_URL`, `ACADEMY_SITE_URL`, `STORAGES` selects local disk when object storage is not configured. |
| `config/storages.py` | `public_media_storage()` returns local storage unless object storage is configured. |
| `config/urls.py` | `/media/public/…` is served again whenever object storage is off, so local public images load. |
| `apps/core/checks.py` | **New.** `manage.py check` now reports the two upload traps (`core.W001` bucket without keys, `core.W005` endpoint that is not a URL, `core.W002` media directory not writable) and the two link traps (`core.W003`/`core.W004` empty or API-host frontend base). |
| `apps/core/apps.py` | Registers those checks at startup. |
| `apps/accounts/emails.py` | `_frontend()` produces an absolute, trailing-slash link on the site origin; the reset copy now states the real 30-minute lifetime; support address updated. |
| `apps/accounts/outbox.py` | Live-class reminder join hint uses the repaired link base. |
| `apps/certificates/services.py`, `apps/certificates/views.py` | Verification link and redirect use the same builder and the trailing-slash path. |
| `apps/website/models.py`, `apps/website/serializers.py`, `apps/website/migrations/0004_academyprofile_next_cohort_start.py` | `AcademyProfile.next_cohort_start` (empty hides the homepage banner). |
| `apps/website/serializers.py` | `_image_url()` now prefers an **uploaded** image over a pasted URL, so a stale link can no longer shadow a new upload. |
| `.env.example` | The storage block's comments are on their own lines with blank defaults, so copying the example cannot reproduce the bad endpoint. |
| `apps/core/test_media_and_links.py` | **New** — 11 tests for the link repair, the storage fallback, the endpoint sanitiser and the checks. |
| `apps/certificates/test_launch_security.py` | Asserts the absolute trailing-slash verification link. |

### Frontend (auto-deploys from `master` through Cloudflare)

| File | Change |
| --- | --- |
| `lib/use-academy-profile.ts` | **New.** One shared profile read plus `formatCohortDate()` (`21 September 2026`). |
| `components/landing/Hero.tsx`, `components/homepage/FinalCTA.tsx` | The cohort banner and the closing line read the admin date; an empty date removes the banner. The sparkle glyph in the badge is gone. |
| `components/Dashboard/admin/WebsiteManager.tsx` | "Next cohort starts" date field; contact details (location, email, phone, socials) are shown but no longer editable here, which matches what the site actually publishes; the team drawer drops the LinkedIn and Instagram fields, labels the URL field "Or link a photo from another site", states that an upload wins over a link, and its button now reads "Save team profile". |
| `app/blog/page.tsx` | The search bar and category chips moved to the top of the page, above every article. The featured card now follows the active search, and its author line wraps cleanly on a phone. |
| `app/contact`, `app/privacy`, `app/terms`, `app/refund-policy`, `app/verify`, `app/payment/cancel`, `components/legal/LegalPage`, `lib/api-endpoints`, `lib/paystack`, `lib/site-config` | The published support address is `vaceupacademy@gmail.com`. |

## Verification (measured, not assumed)

- `python manage.py test --settings=config.settings_test` → `Ran 405 tests in
  27.047s` / `OK (skipped=3)`.
- `python manage.py check` on a copy of this `.env` shape → prints `core.W001`
  and `core.W005`, the two lines that describe the production upload failure.
- Upload path, before: `ValueError: Invalid endpoint: `. After: an
  admin-authenticated multipart `PATCH` returned 200, the file was written to
  `media/public/course/thumbnails/probe-cover.png` and `GET` returned 200,
  `image/png`, 485 bytes.
- Password reset, end to end: `POST /api/v1/auth/password-reset/` → 200, the
  captured email carries `https://vaceup.ng/reset-password/?token=<uuid>` and
  the words "30 minutes". Opening that exact shape in the browser rendered the
  "Set a new password" form, submitting it produced "Password updated", the
  token was removed from the address bar, and the console was clean.
- Blog: search input top edge 451px against the first article card at 586px
  (1440) and 461px against 696px (390); a search that excludes the featured
  article hides it; no matches shows the empty state; the Design chip filters to
  1 article; no horizontal overflow at either width.
- Homepage: banner reads "New cohort starts 21 September 2026" with no
  non-alphanumeric glyphs in the badge; the closing line reads "Next cohort
  starts 21 September 2026 · Limited seats per course"; with the admin date
  cleared the banner disappears and the line reads "Limited seats per course".
- Admin Site Profile at 1440 and 390: the date field holds `2026-09-21`, no
  contact field is editable, no LinkedIn or Instagram control exists, the team
  drawer has exactly one position field (a duplicate introduced while editing
  this screen was caught by the render check and removed), and nothing
  overflows.
- `npm run typecheck` → clean. `npx next build` → static export produced,
  `/blog/` and `/` present in `out/`.

## Apply on cPanel

1. Upload `vaceup-backend-2026-11-01-uploads-links.zip` to `/home/coqrpund/` and
   extract it over the application root:

   ```bash
   cd /home/coqrpund
   unzip -o vaceup-backend-2026-11-01-uploads-links.zip -d /home/coqrpund/vaceup_api
   ```

2. Activate the environment and confirm the code arrived:

   ```bash
   source /home/coqrpund/vaceup_api/venv/bin/activate
   cd /home/coqrpund/vaceup_api
   python --version
   python manage.py check
   ```

   `python --version` should report Python 3.12.x. Read what `check` prints:

   - `(core.W001)` and `(core.W005)` are the two settings that broke uploads.
     They are **warnings, not errors** — with them present the app runs on local
     disk and image uploads work.
   - `(core.W002)` means the media folder is not writable by the app user; the
     `chmod` in step 5 fixes it.
   - `(core.W003)` or `(core.W004)` means emailed links would go to the wrong
     place; step 4 fixes it.

3. Apply the one new database column:

   ```bash
   python manage.py migrate website
   ```

   Expected line: `Applying website.0004_academyprofile_next_cohort_start... OK`.
   It adds a nullable date, so nothing existing changes.

4. Choose what your `.env` should say. Open it in the cPanel file manager or:

   ```bash
   grep -n "AWS_\|FRONTEND_BASE_URL\|ACADEMY_SITE_URL" /home/coqrpund/vaceup_api/.env
   ```

   **If you do not have a real S3 / R2 / B2 bucket with access keys** — which is
   the case today — clear the block so nothing pretends otherwise. Put each
   comment on its own line:

   ```bash
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   AWS_STORAGE_BUCKET_NAME=
   AWS_S3_ENDPOINT_URL=
   ```

   Media is then stored on the server's own disk under
   `/home/coqrpund/vaceup_api/media/`, which is what the site has always served.

   **If you do have real credentials**, fill in all four values, keep every
   comment on its own line, and never put a comment on the same line as a value.

   Then make sure the site origin is set, so emailed links are correct:

   ```bash
   FRONTEND_BASE_URL=https://vaceup.ng
   ```

5. Make the media folder writable, then restart:

   ```bash
   mkdir -p /home/coqrpund/vaceup_api/media/public /home/coqrpund/vaceup_api/media/private
   chmod -R u+rwX /home/coqrpund/vaceup_api/media
   python manage.py collectstatic --noinput
   ```

   Restart the Python app in cPanel.

## Smoke checks after the restart

- Admin > Site Profile: set "Next cohort starts" to a date, save, then reload
  `https://vaceup.ng/` — the hero badge and the closing line both show it. Clear
  the date and both go back to no banner.
- Admin > Courses: open a course, upload a cover image, save. It must return to
  the list without an error, and the cover must appear on the site. This is the
  Priority 1 item.
- Admin > Site Profile > Founder and team: upload a photo for one profile. If a
  "link a photo from another site" URL is also stored, the uploaded photo is the
  one shown.
- Request a forgotten-password email on a real address. The link must start with
  `https://vaceup.ng/reset-password/?token=` and open the "Set a new password"
  form, not a 404 page.
- `https://vaceup.ng/blog/` — the search box and the category buttons are the
  first thing under the title, above every article.
- `GET /api/v1/courses/virtual-assistant/` — the curriculum from the previous
  overlay is untouched: 8 modules, first module 8 lessons.

## Still outstanding

- **Secret rotation.** `SECRET_KEY`, `JWT_SIGNING_KEY` and the database password
  were exposed in git history earlier and have not been rotated. Rotating
  `SECRET_KEY` invalidates every signed cookie and every outstanding password
  reset and verification token, so do it at a quiet moment and tell signed-in
  users to log in again.
- Any contact details saved **inside** the Academy profile row as
  `info@vaceup.ng` are database content, not code, and this release does not
  rewrite them. Check Admin > Site Profile and the About page contact strip.
- The remaining items in your corrections list — events registration and share
  links, the resources section, the certificate layout, messaging, secure code
  execution, student photos, the About redesign and the Kids Academy site — are
  not in this overlay.
