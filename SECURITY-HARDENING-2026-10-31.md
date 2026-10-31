# Security hardening 2026-10-31

A review of the VaceUp API (Django on TrueHost/cPanel) and the Next.js site
(Cloudflare Pages), followed by the fixes that were safe to ship without a
full regression cycle on the live site. Findings are grouped by severity.
Every "fixed" item below was verified by a test, not by inspection.

## Fixed in this release

### 1. A tracked archive carried the live `.env` (critical)

`backend.zip` was committed to the repository and still contains
`backend/.env` with the production `SECRET_KEY`, `JWT_SIGNING_KEY` and
`DB_PASSWORD`. `.gitignore` already listed the file, but a file stays tracked
until it is removed from the index, so the ignore rule never applied.

- The archive is untracked now (`git rm --cached backend.zip`); the file stays
  on disk, it is simply no longer in the repository.
- `scripts/check_no_secrets.py` fails the build when a tracked file is an
  archive, an environment file, or contains a live credential shape
  (Paystack/AWS/GitHub keys, private keys, `SECRET_KEY`, `DB_PASSWORD`,
  `JWT_SIGNING_KEY` values). It runs in
  `.github/workflows/backend-tests.yml` on every push.

**The operator must still rotate these three secrets.** Removing the file from
the repository does not remove it from git history, and anyone who cloned the
repository before this release still holds them. See "Operator actions" below.

### 2. Dependency floors allowed versions with known advisories (high)

Every floor was checked against the GitHub Advisory Database on 2026-10-31.

| Package | Old floor | Advisory | New floor |
|---------|-----------|----------|-----------|
| Django | `>=5.2.12` | `GHSA-wvqv-fj8w-qmhm` and others, `< 5.2.17` | `>=5.2.17` |
| djangorestframework | `>=3.15` | `GHSA-3547-9m27-7rxg` (JSONParser codec), `GHSA-33wh-fxxf-88vv` (Accept header DoS), `< 3.18.2` | `>=3.18.2` |
| djangorestframework-simplejwt | `>=5.3` | `GHSA-5vcc-86wm-547q`, `< 5.5.1` | `>=5.5.1` |
| PyJWT | not pinned | `GHSA-pxh4-856f-4h89` (empty HMAC key forgery), `<= 2.14.0` | `>=2.15.1` |
| Pillow | `>=10.0` | `GHSA-5x8w-8jj5-q52h` (critical, FPX heap overflow), `<= 12.3.0` | `>=13.0.0` |
| PyMySQL | `>=1.1` | `GHSA-v9hf-5j83-6xpp` (critical, SQL injection), `< 1.1.1` | `>=1.2.0` |

The suite was re-run against Pillow 13.0.0 (the only major bump): the image
paths in `apps/assignments/storage.py` and `apps/certificates/services.py` are
unchanged, and `Ran 373 tests ... OK (skipped=3)`.

### 3. A client could spoof the proxy's scheme header (high)

`SECURE_PROXY_SSL_HEADER` made Django believe any request carrying
`X-Forwarded-Proto: https` had arrived over TLS. The header is client
controlled, so a caller could skip `SECURE_SSL_REDIRECT` and the CSRF referer
check on the staff login.

`apps.core.middleware.TrustedProxySchemeMiddleware` now removes the header
unless the peer is Cloudflare or a host on the machine's own network. The same
middleware restores the visitor address from `CF-Connecting-IP` when the peer
is Cloudflare, so anonymous rate limits count people rather than Cloudflare
edge addresses — without that, every anonymous visitor shared one bucket.

### 4. Certificate signatures could overflow the column that stores them (high)

A signature is stored as a data URL in a `TextField`. MySQL caps `TEXT` at
65,535 bytes and base64 adds a third, so an uploaded image over roughly 48 KB
would have failed at save time on production while working in the SQLite
preview. Uploads are now re-encoded (resized, palette or JPEG fallback) and
capped at 44 KB of image, roughly 59 KB of stored data URL.

### 5. Uploaded images kept the extension the client sent (medium)

`Course.thumbnail`, `TeamMember.photo` and `Event.cover_image` accepted any
extension the client supplied. They now carry a
`FileExtensionValidator` limited to `jpg`, `jpeg`, `png` and `webp`
(migrations `courses/0008`, `website/0003`).

### 6. The payment webhook had no rate limit (medium)

The Paystack webhook ran with `throttle_classes([])`. It now uses a dedicated
`payment_webhook` scope (600/min per source) so it cannot be used to flood the
app, while staying far above Paystack's real retry volume.

### 7. Account links stayed valid after a password change (medium)

Changing a password revoked every session but left any outstanding verification
or reset link usable. Both are now retired with the password change, and the
password-reset window dropped from 1 hour to 30 minutes.

### 8. Hardening headers and limits (medium)

- `CSRF_COOKIE_HTTPONLY = True`.
- `SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"`.
- `SECURE_HSTS_SECONDS`, `SECURE_HSTS_INCLUDE_SUBDOMAINS` and
  `SECURE_HSTS_PRELOAD` are environment-driven.
- `FILE_UPLOAD_MAX_MEMORY_SIZE`, `DATA_UPLOAD_MAX_MEMORY_SIZE` and
  `DATA_UPLOAD_MAX_NUMBER_FIELDS` are set explicitly.
- The Django admin path is configurable with `ADMIN_URL` in `.env`.
- The public verification page now sends `Referrer-Policy: no-referrer`, so a
  verification code in the URL cannot leak to a third-party script.

## Accepted risks, deliberately kept

- **Registration reveals that an address is taken.** GitHub, Google and most
  SaaS do the same. Removing it would replace a clear message ("an account
  already exists, sign in") with a vague one, which costs support time for
  students and tutors. Login, password reset and resend-verification never
  reveal it, and registration is throttled to 5 attempts per minute.
- **The API access and refresh tokens live in `localStorage`.** Moving the
  refresh token into an `HttpOnly` cookie means cross-site cookies between
  `vaceup.ng` and `api.vaceup.ng`, which needs a deployment change to the
  shared host and a rewrite of the session handling. The tokens are short
  lived (15 minutes for access), rotated and blacklisted on logout, and the
  site already sends a strict Content-Security-Policy.
- **The database holds the raw verification and reset tokens.** Hashing them
  would only work if the raw link never had to be stored, and the durable
  outbox exists precisely so a queued email survives a broker outage. The
  links are single use, expire, and are retired by a password change.
- **`/media/public/` is served by Django.** The application directory on
  cPanel is not publicly served, so this is the only way uploaded covers and
  team photos reach the browser. Moving it to the web server is a hosting
  change, not a code change.
- **Public certificate verification returns the student name, course and
  instructor.** That is the purpose of a verification page.

## Operator actions

1. **Rotate the three exposed secrets.** Edit `/home/coqrpund/vaceup_api/.env`:

   ```
   SECRET_KEY=<new 50+ character random value>
   JWT_SIGNING_KEY=<new 50+ character random value>
   DB_PASSWORD=<new database password>
   ```

   Generate them with `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.
   Changing `SECRET_KEY` invalidates every session and every outstanding
   account link; users register or request a new link again. Changing the
   database password means updating it in cPanel's MySQL section as well.

2. **Install the raised dependency floors** before the restart:

   ```bash
   source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
   pip install --upgrade -r /home/coqrpund/vaceup_api/requirements.txt
   ```

3. **Purge the archive from history** (optional, rewrites `master`):

   ```bash
   git filter-repo --path backend.zip --invert-paths
   git push --force origin master
   ```

   Only do this when nobody else has work based on the current history; the
   rotation in step 1 is what actually protects the accounts.

## Verification record for this build

Measured on this machine against `config.settings_test` (SQLite):

- Backend suite: `Ran 373 tests in 12.207s` / `OK (skipped=3)`, exit 0.
- `python manage.py makemigrations --check --dry-run`: `No changes detected`.
- `python3 scripts/check_no_secrets.py`: `clean (970 tracked files scanned)`.
- Advisory floors verified against the GitHub Advisory Database on
  2026-10-31; Pillow 13.0.0 installed and exercised by the suite.
- `npx tsc --noEmit` and `npm run build`: exit 0.
