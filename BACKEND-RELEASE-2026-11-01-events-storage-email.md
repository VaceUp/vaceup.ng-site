# Backend release 2026-11-01 — events registration, storage tiering, TrueHost mail

Delta overlay only. Every file listed here is new or changed by this release;
nothing else in `/home/coqrpund/vaceup_api/` is touched.

**The 2026-11-01 uploads-and-links overlay is already applied on the server and
this release builds on top of it.** Nothing from that release is re-shipped
here, so the repaired emailed links and the local-disk upload fallback keep
working exactly as they do now.

## What this release does

**1. Events registration is finished.** Every event now has its own shareable
page, an RSVP form that records a phone number, a note and a marketing-consent
tick, a real confirmation email, a roster the admin can read, export as CSV and
trim, and a seat count that cannot be oversold.

**2. Public images and private files now have separate homes.** Public images
(course covers, team photos, event covers) go to Cloudinary when it is
configured, then to the public bucket, then to local disk. Private files
(lesson videos, recordings, certificates, submissions) stay on the
S3-compatible bucket — Cloudflare R2 or AWS — and are only ever handed out as a
pre-signed URL that expires in an hour.

**3. Mail leaves through TrueHost's own relay, not SMTP.** The bundled mail
server on the hosting account listens on `127.0.0.1:25`, needs no username or
password, and relays for domains hosted on the account. Selecting
`apps.accounts.local_smtp.EmailBackend` opts into it, and that backend refuses
any other host, port, TLS setting or credential, so it cannot quietly half-work
or send a password in the clear.

**4. The Django staff login is reachable again.** `https://api.vaceup.ng/admin/`
currently returns Django's "Not Found" while every API route keeps answering.
Measured before the fix: `reverse("admin:index")` produced `/%2Fadmin/`. The
configurable admin path was built with a leading slash, and a route for
`django.urls.path` never carries one, so the admin could not match at any
address. This is a regression from the 2026-10-31 hardening release and is
fixed here.

## What changed

### Backend

| File | Change |
| --- | --- |
| `apps/website/models.py` | `EventRegistration` gains `phone`, `note` and `consent_marketing`. |
| `apps/website/migrations/0005_eventregistration_consent_marketing.py` | **New.** Adds those three fields. All nullable or blank-allowed, so no existing row changes. |
| `apps/website/views.py` | Seats are counted under `select_for_update()` so two people cannot take the last one; a full event answers "This event is fully booked."; the confirmation mail is queued with `transaction.on_commit()` so a rolled-back sign-up never emails; **new** `GET …/registrations/export/` (CSV) and **new** `DELETE …/registrations/<id>/` (frees the seat), both admin-only. |
| `apps/website/emails.py` | **New.** The RSVP confirmation: what was booked, when, where, the seat count, and the consent sentence. The venue is named once, not twice. |
| `apps/website/roster.py` | **New.** `roster_csv()` — one row per registrant, UTF-8 so non-ASCII names survive Excel. |
| `apps/website/serializers.py` | The public event payload carries `seats_left` and `is_full`; registration accepts phone, note and consent. |
| `config/settings.py` | Cloudinary block (`CLOUDINARY_URL` or the three explicit variables, `_cloudinary_from_url()` rejects a value holding whitespace instead of guessing), `AWS_S3_CUSTOM_DOMAIN`, `SERVER_EMAIL` now defaults to `DEFAULT_FROM_EMAIL`, `_admin_url()` builds the staff path without a leading slash. |
| `config/storages.py` | **`CloudinaryStorage`** (public images, folder-prefixed public ids, real `exists()` so a repeated filename cannot overwrite another course), `public_media_storage()` chooses Cloudinary then bucket then disk, and `PrivateMediaStorage` pins `custom_domain` off so a public delivery hostname can never break a pre-signed link. |
| `apps/core/checks.py` | `core.W006` malformed `CLOUDINARY_URL`, `core.W007` partly configured, `core.W008` configured but the package is not installed, `core.W009` public images landing on a bucket whose endpoint refuses anonymous reads. |
| `apps/accounts/local_smtp.py` | The loopback relay backend: pins `127.0.0.1:25`, no TLS, no credentials, and re-checks before opening so `fail_silently` cannot hide a bad setting. |
| `apps/accounts/management/commands/diagnose_email_delivery.py` | Reports which domain the mail leaves as, and warns when `SERVER_EMAIL` uses a different one from `DEFAULT_FROM_EMAIL`. |
| `apps/core/management/commands/check_release_routes.py` | `GET /admin/login/` is now part of the pre-flight route check, so this class of regression is caught before a deploy instead of by the operator. |
| `requirements.txt` | `cloudinary>=1.29,<2`. |
| `.env.example` | Documented blocks for the local relay, Cloudinary and the bucket, each with comments on their own lines so copying a line cannot carry a note into the value. `ADMIN_URL=admin` is now listed. |
| `apps/website/tests.py` | +9 tests: consent captured, capacity refused under a race, export contents and headers, delete frees a seat, the venue named once, confirmation survives a mail outage. |
| `apps/accounts/tests/test_local_smtp.py` | +2 tests for the sender-domain reporting. |
| `apps/core/test_media_and_links.py` | +3 tests: the custom delivery domain reaches public images only, `core.W009`, the Cloudinary URL shapes. |
| `apps/core/test_security_hardening.py` | **New class** `StaffLoginRouteTests` pinning the admin path. |

### Frontend (auto-deploys from `master` through Cloudflare)

| File | Change |
| --- | --- |
| `components/events/EventDetail.tsx`, `RegisterButton.tsx`, `RsvpModal.tsx` | **New.** The shareable event page, the register control, and the RSVP dialog with its success state. |
| `lib/calendar.ts` | **New.** `.ics` download for "Add to calendar". |
| `app/events/page.tsx` | Reads `?slug=` to decide list versus detail — a static export has no server render to fall back on, so the route sits inside a `Suspense` boundary. Seat counts refresh after every registration. |
| `components/Dashboard/admin/EventsManager.tsx` | The registrations drawer: roster, "Open to event emails" pill per person, **Export CSV**, and **Remove** with a confirmation that names the person and says a seat will be released. |
| `components/ui/Modal.tsx` | Two overlay defects that the RSVP form exposed: the backdrop closed the dialog on *any* click inside it — including ticking the consent box — because it was wired to `onClose` instead of the guard that checks the click actually landed on the backdrop; and the wrapper that holds the panel was marked `aria-hidden`, hiding the form from screen readers. The panel is now flex-centred instead of pinned to the left. |
| `lib/website-api.ts` | `registerForEvent()` sends phone, note and consent. |

## Verification (measured, not assumed)

- `python manage.py test --settings=config.settings_test` → `Ran 429 tests in
  12.407s` / `OK (skipped=3)`.
- `python manage.py makemigrations --check --dry-run` → `No changes detected`.
- `python manage.py check` → no errors; on this machine's `.env` it still prints
  `core.W001` and `core.W005`, which are the two leftover local lines described
  in the `.env` section below.
- `npx tsc --noEmit` → clean. `npx next build` → static export produced,
  `/events` still listed `○ Static`.
- `python scripts/check_no_secrets.py` → `clean (990 tracked files scanned)`.
  `python scripts/check_no_emoji.py` → `OK`.
- **Storage selection, measured in the running settings module.** With the
  current `.env` shape (no Cloudinary, no keys): `public_media_storage()` →
  `LocalPublicStorage`, default → `FileSystemStorage` — byte-for-byte today's
  behaviour, so applying this overlay cannot change how uploads work until the
  `.env` lines are pasted. With Cloudinary and an R2 bucket filled in:
  `CloudinaryStorage` for public images and `PrivateMediaStorage` for files.
- **Events flow, in a real browser at 1440, 390 and 280 px.** List → event
  title → `?slug=preview-open-day` detail → Register → RSVP dialog (name
  prefilled, email, phone, note, consent) → submit → "You are registered. A
  confirmation email is on its way." → seat count moved 3 of 30 to 4 of 30 →
  admin Events → roster showed 4 people, 2 consent pills, footer "Close /
  Export CSV" → Remove → "Bola Adeyemi (bola@example.com) will be deleted from
  "Preview Open Day" and one seat will be released." → confirmed → 3 people of
  30 seats. No horizontal overflow at any width.
- The settled dialog measured `x=528, width=384` inside a 1440 viewport (that is
  centred), full opacity, navy `rgb(0, 8, 138)` labels on white and a navy
  action on the gold `rgb(255, 199, 44)` button.
- **Live server, probed before this fix:** `healthz/` 200, `api/v1/auth/login/`
  405 (route present), `admin/` 404, `admin/login/` 404.
- The confirmation email was read from a captured outbox dump: subject, event
  name, date range, location, type, the reply-to-release-your-seat line, the
  consent sentence and one `https://vaceup.ng/events/?slug=…` link.

## Known, not fixed here

`https://api.vaceup.ng/api/schema/` returns 500, and `manage.py check --deploy`
reports `drf_spectacular.E001` on `AnnouncementViewSet`. It affects the
machine-readable API reference and the Swagger page only; no learner, tutor or
admin screen depends on it, and it does not block `migrate` (plain
`manage.py check` exits 0). Tracked separately.

## Apply on cPanel

Do these in order. Steps 1 to 4 change nothing visible until step 5's `.env`
lines are pasted, so you can apply the code now and switch storage and mail on
when you are ready.

1. Upload `vaceup-backend-2026-11-01-events-storage-email.zip` to
   `/home/coqrpund/` and extract it over the application root:

   ```bash
   cd /home/coqrpund
   unzip -o vaceup-backend-2026-11-01-events-storage-email.zip -d /home/coqrpund/vaceup_api
   ```

2. Activate the environment and confirm the code arrived:

   ```bash
   source /home/coqrpund/vaceup_api/venv/bin/activate
   cd /home/coqrpund/vaceup_api
   python --version
   pip install -r requirements.txt
   ```

   `python --version` should report Python 3.12.x. `pip install` adds the
   `cloudinary` package; without it `manage.py check` prints `core.W008`.

3. Add the consent, phone and note columns:

   ```bash
   python manage.py migrate website
   ```

   Expected line: `Applying website.0005_eventregistration_consent_marketing... OK`.

4. Confirm the routes and the mail path:

   ```bash
   python manage.py check
   python manage.py check_release_routes
   python manage.py diagnose_email_delivery
   ```

   `check_release_routes` must end with `PASS GET /admin/login/`.
   `diagnose_email_delivery` should print `Mail leaves as the domain vaceup.ng`.
   Until you paste the `.env` block, it reports the dummy backend — that is the
   reason no mail arrives today.

5. Edit `.env` in `/home/coqrpund/vaceup_api/` and add this block. Everything
   after `=` is read as the value, so put no comment on these lines:

   ```
   ADMIN_URL=admin

   EMAIL_BACKEND=apps.accounts.local_smtp.EmailBackend
   EMAIL_HOST=localhost
   EMAIL_PORT=25
   EMAIL_USE_TLS=False
   EMAIL_USE_SSL=False
   EMAIL_HOST_USER=
   EMAIL_HOST_PASSWORD=
   EMAIL_TIMEOUT=10
   DEFAULT_FROM_EMAIL=VaceUp <no-reply@vaceup.ng>
   SERVER_EMAIL=VaceUp <no-reply@vaceup.ng>
   VACEUP_INFRASTRUCTURE=database
   ACCOUNT_EMAIL_DELIVERY_MODE=database
   ```

   Three of those lines replace what you have now, and they are the whole mail
   fix: `EMAIL_BACKEND` is unset, which with an empty `EMAIL_HOST` selects the
   dummy backend that accepts mail and discards it; `EMAIL_PORT` is `587` and
   `EMAIL_USE_TLS` is `True`, which the loopback relay refuses.
   `DEFAULT_FROM_EMAIL` is already correct — leave it. The sender must be a real
   mailbox on the hosting account, so if `no-reply@vaceup.ng` does not exist in
   cPanel → *Email Accounts*, create it or the relay will refuse the message.

6. Restart the Python app (cPanel → *Setup Python app* → **Restart**), then open
   `https://api.vaceup.ng/admin/`. It should show the login form.

7. Queue the mail drain, because cPanel runs no persistent worker. cPanel →
   *Cron Jobs*, every five minutes:

   ```
   */5 * * * * /home/coqrpund/vaceup_api/venv/bin/python /home/coqrpund/vaceup_api/manage.py process_mail_queue >> /home/coqrpund/vaceup_mail.log 2>&1
   ```

## Switching on Cloudinary and the bucket

Add these when you have the credentials, then restart and re-run
`python manage.py check`.

```
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
CLOUDINARY_FOLDER=vaceup
CLOUDINARY_SECURE_DISTRIBUTION=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_REGION_NAME=auto
AWS_S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
AWS_S3_CUSTOM_DOMAIN=
```

- `<cloud_name>` is the third value, not the API key. It is in
  console.cloudinary.com → *Account details*, and looks like `dxxxxxxxxxxxxxxx`.
- Cloudinary alone is enough for public images. Leave the `AWS_*` lines empty
  and private files stay on disk, which is what happens now.
- The bucket is **R2**, not Stream. Stream hosts video and nothing in this
  backend reads its credentials yet; R2 is the S3-compatible file bucket these
  variables expect.
- Set the bucket name and both keys together. A bucket without keys is the
  exact condition that broke image uploads before, and `core.W001` reports it.
- `AWS_S3_ENDPOINT_URL` and `AWS_S3_CUSTOM_DOMAIN` must be blank or a real
  value — never a comment. `core.W005` exists because a copied example line
  once became the endpoint.
- If you skip Cloudinary and put public images on the bucket, `core.W009` warns
  that the bucket's own hostname refuses anonymous reads; that is the case
  `AWS_S3_CUSTOM_DOMAIN` fixes.

## Rollback

The only database change is `website.0005`, which adds three columns and drops
nothing:

```bash
python manage.py migrate website 0004
```

Then restore the previous overlay:

```bash
unzip -o vaceup-backend-2026-11-01-uploads-links.zip -d /home/coqrpund/vaceup_api
```

and restart the app. If you roll back, also delete the `EMAIL_*` lines from
step 5: the old code would keep the loopback relay selected with port 25 and TLS
off, which is not what a remote SMTP setup expects.
