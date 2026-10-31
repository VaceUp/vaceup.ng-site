# VaceUp backend release 2026-10-31 (certificate signatures and approved applications)

Django stays on TrueHost; the Next.js site stays on Cloudflare Pages. This package is a
delta overlay: it contains only files this release changed or added relative to
`3e6727f`, the deployment it replaces. Nothing else on the server is touched, so your
existing application files, `.env`, database, uploaded media and virtualenv stay
exactly where they are. There is no full-backend replacement here and no wholesale
`apps/` folder.

This package is separate from `vaceup-backend-2026-10-31.zip` (the admin dashboard
overlay). Install both overlays if that one has not been applied yet; their file sets do
not conflict.

## What this overlay changes

- **Approved applications reach the student.** The workspace overview now returns
  `approved_applications` (course id, title, slug, price, review date) and a new
  `GET /api/v1/dashboard/applications/` endpoint lists the same data. An application
  disappears from the list only after an enrollment exists, so an approved paid course
  stays visible with a path to checkout until the student pays.
- **Certificate signatories.** Administrators store the academy's management signature
  (name, title and image) in the existing admin settings record. Tutors store their own
  signature on their tutor profile. Both are validated as PNG/JPEG/WebP uploads (minimum
  40x16, maximum 2400x1200, 400 KB) and saved as data URLs.
- **Tutor-aware certificates.** `POST /api/v1/certificates/issue/` and the admin
  `certificates/issue/` endpoint accept an optional `tutor_id`; the issued certificate
  records the signing tutor and prints both the management and tutor signatures.
  Certificate preview accepts an optional `tutor` parameter; non-admins may only preview
  with their own profile.
- **Signature endpoints.** `GET/POST/DELETE /api/v1/certificates/signature/` for the
  signed-in tutor and `GET/POST/DELETE /api/v1/certificates/management-signature/` for
  academy administrators.
- **Template upgrade.** `0005_signature_placeholders` refreshes the seeded
  "VaceUp Certificate" template only when it still lacks the tutor signature block.
  Administrators' customised templates are left untouched.

## Files in this overlay

- `apps/accounts/models.py`
- `apps/accounts/migrations/0004_tutorprofile_certificate_signature_and_more.py`
- `apps/adminpanel/views.py`
- `apps/certificates/models.py`
- `apps/certificates/serializers.py`
- `apps/certificates/services.py`
- `apps/certificates/urls.py`
- `apps/certificates/views.py`
- `apps/certificates/migrations/0004_certificate_tutor.py`
- `apps/certificates/migrations/0005_signature_placeholders.py`
- `apps/dashboard/member_views.py`
- `apps/dashboard/urls.py`
- `apps/dashboard/test_workspace.py`
- `apps/certificates/test_launch_security.py`
- this release note and `RELEASE-MANIFEST.json`

`manage.py`, `passenger_wsgi.py` and `requirements.txt` are deliberately not included.
No new Python packages are required.

## Migrations

Run these three, in order; `migrate` handles the order from the dependency graph:

| App | Migration |
|-----|-----------|
| accounts | `0004_tutorprofile_certificate_signature_and_more` |
| certificates | `0004_certificate_tutor` |
| certificates | `0005_signature_placeholders` |

All are additive. `0004_certificate_tutor` adds a nullable tutor link to existing
certificates (existing awards keep printing with the management signature only).
`0005_signature_placeholders` only touches the seeded default template described above.
`makemigrations --check` reports no unmade migrations for this tree.

## Install

1. Back up the current application files, `.env`, the database and `media/` with cPanel.
   Store the backups outside the public web directory. Do not delete anything.
2. Upload `vaceup-backend-2026-10-31-signatures.zip` and extract it directly into
   `/home/coqrpund/vaceup_api/`. After extraction the dashboard file must sit at
   `/home/coqrpund/vaceup_api/apps/dashboard/member_views.py`, not inside a nested
   `backend/` folder. Only the listed files are written.
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

4. Restart the Python application in cPanel (**Setup Python App** > the app rooted at
   `vaceup_api`, URL `api.vaceup.ng` > Restart). A terminal check does not reload the
   Passenger worker.

## Smoke checks after restart

```bash
curl -s -o /dev/null -w "health   %{http_code}\n" https://api.vaceup.ng/healthz/
curl -s -o /dev/null -w "apps     %{http_code}\n" https://api.vaceup.ng/api/v1/dashboard/applications/
```

The health check must answer 200. The applications route answers 401 without a bearer
token; 401 is the correct unauthenticated answer and proves the route exists.

Then, signed in:

- As an academy administrator, open Admin > Certificates, upload the management
  signature with a name and title, then issue a certificate selecting student, course
  and signing tutor. Download the PDF and confirm both signatures print.
- As a tutor, open the teaching workspace > Certificates, upload your own signature and
  confirm the preview shows it for your courses.
- As a student with an approved paid application, open the dashboard. The accepted
  course appears with "Pay and enroll" and reaches checkout.

## Frontend release order

Install and restart the backend before the frontend reaches production. The new
dashboard, explore and certificate screens read the fields added here. The frontend
deploys through Cloudflare on a push to `master`; do not let GitHub replace the cPanel
backend.

## Rollback

Restore the backed-up source files and `.env`, then restart the app. The new columns and
tables are additive; existing certificates, enrollments and payments are not rewritten.
Do not restore a database dump without confirming no learner data was created after the
backup.

## Rebuilding this package

The overlay is the diff against `3e6727f`, the deployment this release replaces:

```bash
python3 scripts/package_backend_release.py \
  --notes BACKEND-RELEASE-2026-10-31-signatures.md \
  --out vaceup-backend-2026-10-31-signatures.zip \
  --base 3e6727f
```

Pass `--with-unchanged` only if you deliberately want to re-ship `manage.py`,
`passenger_wsgi.py` and `requirements.txt`.

## Verification record for this build

Measured on this machine against `config.settings_test` (SQLite) and the local Node
toolchain:

- Backend suite: `Ran 361 tests in 7.205s` / `OK (skipped=3)`, exit 0.
- `python manage.py makemigrations --check --dry-run`: `No changes detected`.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0; `/team` and `/dashboard/explore` are in the static output.
