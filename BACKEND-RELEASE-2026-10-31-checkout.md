# VaceUp backend release 2026-10-31 (checkout and marketing overlay)

Django stays on TrueHost; the Next.js site stays on Cloudflare Pages. This package is
a delta overlay: it contains only the backend files that this release changes or that
the server is still missing. Nothing else on the server is touched, so your existing
application files, `.env`, database, uploaded media and virtualenv stay exactly where
they are. There is no full-backend replacement here and no wholesale `apps/` folder.

`manage.py` and `passenger_wsgi.py` are deliberately not included. `requirements.txt`
is not included either, because this release adds no dependency.

## Read this before you install

This overlay assumes the security hardening overlay
(`vaceup-backend-2026-10-31-security.zip`) is already installed, which is the
deployment it builds on. If you are not sure, run this first:

```bash
grep -c "Paystack" /home/coqrpund/vaceup_api/apps/payments/gateway.py
ls /home/coqrpund/vaceup_api/apps/core/middleware.py
```

`apps/core/middleware.py` must exist and the gateway must mention Paystack. If either
is missing, install the security overlay first, then this one.

The three secrets exposed in the repository history must still be rotated if you have
not done it yet: `SECRET_KEY`, `JWT_SIGNING_KEY` and `DB_PASSWORD`. Full detail is in
`SECURITY-HARDENING-2026-10-31.md`, shipped with the security overlay.

## What this overlay changes

### 1. Checkout is no longer rejected by the payment provider

Paystack sits behind Cloudflare, and Cloudflare refuses the default Python
`urllib` User-Agent with HTTP 403 (Cloudflare error 1010). Every checkout failed with
"Payment provider rejected the request (HTTP 403)" because the API never identified
itself.

- `apps/payments/gateway.py` now sends an explicit `User-Agent: VaceUp-API/1.0
  (+https://vaceup.ng)` on every request, so Paystack accepts the call.
- A rejected checkout now returns a readable reason instead of a bare status code. A
  401 means "Paystack rejected our credentials"; a 403 means "Paystack blocked the
  request".
- A provider failure that is not the buyer's fault (429, 5xx, network error) now
  returns 503 with "the payment provider is temporarily unavailable" rather than
  blaming the customer. Those cases are retried by the provider, not by the customer.
- The provider's raw response body is written to the server log only. It is never
  returned to the browser.

### 2. The campaign review screen can load its recipient list

The admin "Review and send" panel failed with "Request failed (HTTP 404)" and showed
"ELIGIBLE RECIPIENTS: Not available". The route
`GET /api/v1/marketing/campaigns/<id>/audience/` exists in the code but the server was
running an older copy of the marketing module that did not have it.

- The complete `apps/marketing/` app is shipped in this overlay: models, serializers,
  views, URLs, the OpenAPI schema, the services, the queue worker command and both
  migrations.
- The eligible-recipient count, the review panel and the "Confirm and queue" button
  now work. The send button stays disabled until the operator confirms the audience.

No other app is replaced or removed.

## Migrations

| App | Migration | What it does |
|-----|-----------|--------------|
| marketing | `0002_delivery_claims` | Adds the queue-claim columns to `marketing_emailrecipient` so two workers cannot send the same email twice |

`0001_initial` is shipped too, but it is only applied if the server has never run it.
All the columns are additive; no existing campaign, recipient or log row is rewritten.

`makemigrations --check` reports no unmade migrations for this tree.

## Install

1. Back up the current application files, `.env`, the database and `media/` with
   cPanel. Store the backups outside the public web directory. Do not delete anything.
2. Upload `vaceup-backend-2026-10-31-checkout.zip` and extract it directly into
   `/home/coqrpund/vaceup_api/`. After extraction `apps/marketing/views.py` must sit at
   `/home/coqrpund/vaceup_api/apps/marketing/views.py`, not inside a nested `backend/`
   folder. Only the listed files are written.
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

   `python -V` must print `Python 3.12.x`. No `pip install` step is needed for this
   release; nothing in `requirements.txt` changed.
4. Restart the Python application in cPanel (**Setup Python App** > the app rooted at
   `vaceup_api`, URL `api.vaceup.ng` > Restart). A terminal check does not reload the
   Passenger worker.
5. Install the marketing delivery cron if it is not already in cPanel's cron table.
   Run it once per minute; it exits by itself well inside the one-minute window.

```bash
* * * * * /home/coqrpund/virtualenv/vaceup_api/3.12/bin/python /home/coqrpund/vaceup_api/manage.py process_marketing_queue --limit 10 --max-seconds 45 >> /home/coqrpund/vaceup-marketing-cron.log 2>&1
```

## Smoke checks after restart

```bash
curl -s -o /dev/null -w "health   %{http_code}\n" https://api.vaceup.ng/healthz/
curl -s -o /dev/null -w "courses  %{http_code}\n" https://api.vaceup.ng/api/v1/courses/
```

The health check must answer 200. Then:

- Open a paid course, choose a plan and press Pay. The checkout page must load without
  a 403. A successful initialisation redirects to Paystack; a declined card is reported
  as a declined card, not as a provider rejection.
- Sign in as an administrator, open Marketing, and press "Review and send" on a draft
  campaign. The eligible-recipient count must appear and no 404 may be shown.
- Send one test email to yourself and confirm it arrives. The delivery report must
  show the recipient as accepted by SMTP.

## Rollback

Restore the backed-up source files, then restart the app. The new marketing columns are
additive; existing campaigns, recipients and logs are not rewritten. Do not restore a
database dump without confirming no campaign activity happened after the backup.

## Rebuilding this package

The overlay is the diff against `a77aaba`, the deployment this release builds on, plus
the complete `apps/marketing/` app, which no earlier overlay shipped:

```bash
python3 scripts/package_backend_release.py \
  --notes BACKEND-RELEASE-2026-10-31-checkout.md \
  --out vaceup-backend-2026-10-31-checkout.zip \
  --base a77aaba \
  --include backend/apps/marketing/__init__.py \
  --include backend/apps/marketing/apps.py \
  --include backend/apps/marketing/management/__init__.py \
  --include backend/apps/marketing/management/commands/__init__.py \
  --include backend/apps/marketing/management/commands/process_marketing_queue.py \
  --include backend/apps/marketing/migrations/__init__.py \
  --include backend/apps/marketing/migrations/0001_initial.py \
  --include backend/apps/marketing/migrations/0002_delivery_claims.py \
  --include backend/apps/marketing/models.py \
  --include backend/apps/marketing/schema.py \
  --include backend/apps/marketing/serializers.py \
  --include backend/apps/marketing/services.py \
  --include backend/apps/marketing/test_delivery.py \
  --include backend/apps/marketing/urls.py \
  --include backend/apps/marketing/views.py
```

## Verification record for this build

Measured on this machine against `config.settings_test` (SQLite):

- Full backend suite: `Ran 381 tests in 19.498s` / `OK (skipped=3)`, exit 0.
- The changed apps alone: `apps.payments` and `apps.marketing`, `Ran 46 tests in 1.144s`
  / `OK`, exit 0.
- The overlay was extracted over a scratch copy of the application and the extracted
  tree was exercised, not just the repository: `manage.py check` reported no issues,
  `manage.py check_release_routes` printed `PASS` for every route, and
  `resolve('/api/v1/marketing/campaigns/3/audience/')` returned the
  `marketing-campaign-audience` route with `pk` `3`.
- The extracted `apps/payments/gateway.py` was driven against a stubbed transport. The
  request to `https://api.paystack.co/transaction/initialize` carried
  `User-Agent: VaceUp-API/1.0 (+https://vaceup.ng)` and
  `Authorization: Bearer <secret>`.
- `GET /api/v1/marketing/campaigns/3/audience/` on the local preview server answered
  HTTP 200 with the recipient count, and the admin review panel rendered the count
  with the send button disabled until the audience is confirmed.
- `python3 scripts/check_no_secrets.py`: `clean (981 tracked files scanned)`.
- The archive contains 19 entries and no `manage.py`, `passenger_wsgi.py` or
  `requirements.txt`. Its SHA-256 is written to
  `vaceup-backend-2026-10-31-checkout.zip.sha256`.
