# VaceUp LMS — Go-Live Guide

*Everything you must do to take the Phase-0 backend from this zip to a running
production API. Ordered. The `.env` in this bundle already has real secrets — you
only fill in provider credentials where marked.*

---

## 0. What's in this bundle
A **complete, tested backend**: accounts (register/verify/login/reset), course
catalog + authoring, enrol → learn → progress, **Paystack payments** (checkout →
verify → auto-enrol + webhook), **lesson video** (R2 presigned upload + signed
playback), **live classes** (schedule/join-window/attendance/LiveKit), **messaging**
(gated direct messages), and the **instructor/tutor dashboard**. 80 automated tests
pass — **email + live-class reminders run async on Celery**. **Not included** (no
code yet): applications/receipts, quizzes, assignments, certificates, notifications
feed, real-time (WebSocket) messaging. See `FUNCTIONAL-SPEC.md`.

---

## 1. Before you deploy — decisions
1. **Host.** ⚠️ Shared cPanel/Truehost will *not* carry 1,000 users/min with
   video. Strongly prefer a VPS or PaaS (Render, Railway, Fly.io, DigitalOcean App
   Platform, or a plain Ubuntu VPS) behind **Cloudflare**. The app runs on either;
   these steps cover both (Gunicorn+Nginx, and cPanel/Passenger).
2. **Python 3.11 or 3.12** (3.13 works too). Create a **fresh virtualenv** — this
   guarantees you get the pinned **Django 5.0** and **DRF ≥3.15** from
   `requirements.txt` (the PyMySQL driver shim in `config/__init__.py` is tuned for
   Django 5.0; do not run this on Django 6.0).

---

## 2. Upload & install
```bash
# on the server, in the app directory
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```
System deps (Debian/Ubuntu, only if a wheel is missing): `sudo apt-get install -y python3-dev build-essential`.

---

## 3. Configure `.env`
The bundled `.env` has working secrets for the core app. **Fill these in before go-live:**

| Variable(s) | Why | Required? |
|---|---|---|
| `ALLOWED_HOSTS` | your real API host(s), comma-separated | **Yes** |
| `CORS_ALLOWED_ORIGINS` | your frontend origin(s) | **Yes** |
| `DB_NAME/USER/PASSWORD/HOST/PORT` | your MySQL | **Yes** |
| `EMAIL_HOST` + `EMAIL_HOST_USER/PASSWORD` | **verification/reset emails** — without these, students can't verify and can't log in (console-only) | **Yes for real users** |
| `REDIS_URL` | Upstash Redis → makes rate-limiting actually work across workers | **Yes for scale** |
| `SENTRY_DSN` | error monitoring | Recommended |
| `AWS_*` (or R2: `+ AWS_S3_ENDPOINT_URL`) | media storage for thumbnails/videos | Yes if using uploads |
| `SECURE_SSL_REDIRECT` | set `False` if Cloudflare/cPanel already forces HTTPS (prevents redirect loops) | Situational |
| `PAYSTACK_*`, `LIVEKIT_*`, `CLOUDINARY_*` | Phase 1–2 — inert until that code ships | No |

> **Rotate** `SECRET_KEY` and `JWT_SIGNING_KEY` if this bundle was ever sent over
> chat/email. Generate: `python -c "import secrets;print(secrets.token_urlsafe(64))"`.
> Never commit `.env` (a `.gitignore` is included).

---

## 4. Database, superuser, static
```bash
python manage.py migrate
python manage.py createsuperuser        # your admin login for /admin/
python manage.py collectstatic --noinput
python manage.py check --deploy         # should report no issues
```
MySQL must be InnoDB/utf8mb4 (the settings request this). Create the DB + user
first if your host doesn't auto-provision it.

---

## 5. Run the app

**VPS (recommended) — Gunicorn behind Nginx (TLS):**
```bash
gunicorn config.wsgi:application --workers 3 --bind 127.0.0.1:8000
```
- `--workers` ≈ `2 × vCPU + 1`. For heavier concurrency use
  `--worker-class gthread --threads 4`. Put Nginx in front terminating TLS; the
  settings already trust `X-Forwarded-Proto`.
- Point Nginx `/healthz/` (or your uptime monitor) at the health endpoint.

**cPanel / Truehost — "Setup Python App":**
- Startup file `passenger_wsgi.py` (already included) exposes `application`.
- Set the app's env vars in the cPanel UI **or** rely on the `.env` file.
- After every code change: **Restart** the app from cPanel.

---

## 5a. Run Celery (async email + reminders)
Email (verification, password reset) and pre-class reminders run off-request via
Celery, so you must run a **worker** (and a **beat** scheduler for reminders)
alongside the web app. They use `REDIS_URL` as the broker by default.
```bash
celery -A config worker -l info        # processes email/reminder tasks
celery -A config beat   -l info        # enqueues live-class reminders on a schedule
```
- Run each as its own long-lived process (systemd unit, supervisor, or a
  separate PaaS "worker"/"beat" process). On cPanel without background workers,
  set `CELERY_TASK_ALWAYS_EAGER=True` so tasks run inline (email will again block
  requests — acceptable only at low volume).
- Reminders fire for classes starting within `LIVE_CLASS_REMINDER_LEAD_MINUTES`
  (default 30). Without **beat**, scheduled reminders won't send (everything else
  still works).

## 5b. Configure Paystack (for paid courses)
1. In `.env` set `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` (live keys from your
   Paystack dashboard), and `PAYSTACK_CALLBACK_URL` = the **frontend** page that
   reads `?reference=` and calls `POST /payments/verify/`.
2. In the Paystack dashboard → **Settings → API Keys & Webhooks**, set the webhook
   URL to `https://<api-host>/api/v1/payments/webhook/`. Paystack signs it with
   your secret key; the endpoint verifies the signature and enrols idempotently.
3. Confirm `PAYMENT_CURRENCY` (default `NGN`).
4. Smoke test with Paystack **test** keys first (test card `4084 0840 8408 4081`):
   initialize → pay → verify → the student should be auto-enrolled.

> Free courses need none of this — they enrol directly via `POST /enrollments/`.

## 5c. Video & live classes
- **Lesson video** reuses the S3/R2 config from §3 (`AWS_*` + `AWS_S3_ENDPOINT_URL`
  for R2). Set a permissive-enough **CORS policy on the bucket** so the browser can
  `PUT` directly (allow `PUT`/`GET` from your frontend origin). No video keys →
  video endpoints return `503`; text/free courses still work.
- **Live classes** work out of the box with the **external** provider (instructors
  paste a Meet/Zoom link). For native video set `LIVEKIT_*` and run a LiveKit
  server; the API mints per-user join tokens.

## 6. Put Cloudflare in front
- Proxy the API host through Cloudflare (orange cloud) for CDN + WAF + DDoS.
- Enable "Always Use HTTPS". If Cloudflare already forces HTTPS end-to-end, set
  `SECURE_SSL_REDIRECT=False` in `.env` to avoid a redirect loop.
- Serve media (thumbnails/video) via Cloudflare/CDN, **never** through Django.

---

## 7. The specific changes to "go live" — checklist
- [ ] Fresh venv on **Django 5.0** (`pip install -r requirements.txt`).
- [ ] `.env`: real `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, DB creds.
- [ ] `.env`: **SMTP** filled in (or students can't verify email → can't log in).
- [ ] `.env`: **`REDIS_URL`** (Upstash) set — otherwise throttling is per-worker
      and effectively off.
- [ ] `.env`: `SENTRY_DSN` set (recommended).
- [ ] `.env`: Paystack keys + `PAYSTACK_CALLBACK_URL` set; webhook URL registered
      in the Paystack dashboard (only if selling paid courses).
- [ ] `migrate`, `createsuperuser`, `collectstatic` run.
- [ ] `python manage.py check --deploy` clean.
- [ ] Gunicorn/Passenger running; `/healthz/` returns 200; `/admin/` loads over HTTPS.
- [ ] Celery **worker** running (email/reminders); **beat** running (reminders) —
      or `CELERY_TASK_ALWAYS_EAGER=True` if you truly have no worker.
- [ ] Cloudflare proxying; HTTPS enforced; `SECURE_SSL_REDIRECT` set correctly.
- [ ] Automated MySQL backups enabled.
- [ ] Smoke test: register → verify (check inbox) → login → browse → enrol (free) →
      mark a lesson complete. If selling: buy a paid course with a Paystack test card
      → verify → confirm auto-enrolment.

---

## 8. Scale notes (toward 1,000 users/min)
- **Shared cache is mandatory** at scale — set `REDIS_URL`. Without it, throttling
  and any locking are per-process.
- **DB connections:** `CONN_MAX_AGE=60` × workers can exhaust MySQL's connection
  cap. Size workers to the cap or add a pooler (ProxySQL/RDS Proxy).
- **Async:** email + reminders run on **Celery** (§5a) — requests no longer block
  on SMTP. Just run the worker (and beat for reminders). Future heavy jobs (PDF
  certificates) can reuse the same worker.
- **Video:** offload to Cloudflare Stream / R2 / CloudFront; store only the URL.
- **Horizontal scale:** run multiple app instances behind the load balancer;
  the app is stateless (JWT), so this "just works" once the cache is shared.

---

## 9. Running the tests (any environment)
```bash
python manage.py test --settings=config.settings_test
```
Runs the full suite on SQLite — no MySQL/Redis/SMTP needed. Use this in CI.
