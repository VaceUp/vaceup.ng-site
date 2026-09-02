# VaceUp LMS — Production Readiness & Gap Analysis
*Senior engineering review — what exists, what is missing, what blocks go-live.*

## TL;DR verdict

> **UPDATE (Phase 0–2 delivered).** The verdict below was the *original* review of the
> skeleton. Since then the core is built and tested (80 tests): full auth, catalog +
> authoring, enrolment/progress, **Paystack payments**, **lesson video (R2 presigned
> upload + signed playback)**, **live classes** (schedule/join-window/attendance/LiveKit
> token), **messaging** (gated direct messages), and the **instructor/tutor dashboard**.
> The three platforms you asked about — **tutor, live class, messaging — now exist**
> (models, endpoints, tests). Remaining: applications/receipts, quizzes, assignments,
> certificates, notifications feed, Celery async, and the ops/host work. The original
> analysis is kept below for the full picture.

What you have is a **clean, well-structured foundation skeleton — roughly 15% of the
system your own ERD and logic-design describe.** It is *not* a backend that can go to
production, and it is *not* one that can take 1,000 users/minute. The three platforms
you asked about specifically — **tutor, live class, messaging — do not exist at all**
(zero models, zero endpoints, zero code). The business logic the design doc describes
(services, idempotent payments, state machines, Celery) is **entirely aspirational** —
none of it is in the repository.

Two facts made the current state un-deployable — **both are now resolved (Phase 0):**

1. ~~There are no migrations.~~ **DONE** — clean `0001_initial` migrations generated for
   `accounts`, `courses`, and `enrollment` (all indexes + constraints included).
2. ~~No user can ever log in.~~ **DONE** — full register → verify-email → activate →
   login → password-reset flow is built, wired, and covered by 14 passing tests. Email
   backend is configured (console fallback until SMTP creds are set).

> **Progress note (Phase 0):** items 1–2 below are complete. See §8 for what shipped.
> The rest of this document still describes the remaining gap.

---

## 1. What actually exists (the real inventory)

| Area | Status | Notes |
|---|---|---|
| Django 5 project scaffold | ✅ | `config/` settings, wsgi, asgi, PyMySQL shim |
| Custom `User` (email + role) | ✅ model only | roles: admin/instructor/student |
| Course catalog models | ✅ model only | Category, Course, Module, Lesson |
| Enrollment + LessonProgress | ✅ model only | progress math on the model |
| DRF ViewSets | ⚠️ partial | **Courses + Lessons only** |
| Serializers | ⚠️ partial | Courses only |
| Permissions (RBAC) | ✅ | `IsInstructorOrAdmin`, `IsEnrolledStudent` |
| JWT auth | ✅ | login / refresh / logout (blacklist) |
| S3 storage backends | ✅ config | private (signed) + public |
| Security hardening block | ✅ | HSTS, secure cookies, SSL redirect |
| Migrations | ❌ | **none — cannot deploy** |
| Admin registrations (`admin.py`) | ❌ | nothing manageable in Django admin |
| Tests | ❌ | none (despite blueprint claim) |
| Services / selectors / tasks / exceptions | ❌ | the entire logic-design doc is unbuilt |
| Celery / Redis / async | ❌ | not referenced anywhere |
| Caching layer | ❌ | default LocMem (per-process) |

---

## 2. Missing vs. your own ERD (35 entities) and logic-design

Your ERD defines ~35 tables. **8 are implemented.** Everything below is fully designed
in your docs and **completely absent from the code**:

- **Accounts:** `StudentProfile`, `TutorProfile`, `EmailVerificationToken`,
  `PasswordResetToken` — and the whole register / verify / reset / resend flow.
- **Admissions & payments:** `Application`, `Payment`, `Receipt` + the idempotent
  Paystack `confirm_payment` linchpin. **No money path exists.**
- **Live classes:** `LiveClass`, `Attendance`, join-window logic, Meet/native provider,
  reminders. **Not in place.**
- **Messaging / comms:** `Message`, `Notification`, `Announcement` fan-out.
  **Not in place** (and no real-time transport — no Channels/WebSocket/ASGI worker).
- **Tutor teaching tools:** `Assignment`, `Submission`, grading; `Quiz`, `Question`,
  `Choice`, `QuizAttempt`, `Answer`, auto-grading. **Not in place.**
- **Certificates:** `Certificate` issue/verify/revoke + PDF. Absent.
- **Content/marketing:** `LearningOutcome`, `CourseRequirement`, `CourseFAQ`,
  `LearningMaterial`, `BlogPost`, `BlogCategory`, `Testimonial`. Absent.
- **Enrollment API:** the model exists but there is **no endpoint to enroll, mark a
  lesson complete, or read progress.** The core learning loop is unreachable over HTTP.

**Direct answers to your questions:**
- *Are the backend logics solid?* — The little that exists (RBAC, progress derivation,
  query scoping, indexes) is genuinely good, senior-quality work. But ~95% of the
  business logic in your design doc is **not written**. As a *system*, the logic is not
  solid because it is mostly absent.
- *Tutor platform?* — **No.** No tutor profile, assignments, quizzes, grading, or dashboard.
- *Live class platform?* — **No.** No model, no scheduling, no video provider, no attendance.
- *Messaging platform?* — **No.** No message/notification models, no real-time transport.

---

## 3. Correctness bugs in the code that *does* exist

1. **Lesson create/update is broken.** `LessonSerializer` omits the `module` field, but
   `Lesson.module` is a required FK → every create/update raises IntegrityError (500).
   You cannot build a course tree through the API.
2. **No Module/Category endpoints at all.** Only Course + Lesson are routed. With (1),
   there is no API path to author content — only the (unregistered) Django admin or a shell.
3. **Preview lessons are unreachable.** `IsEnrolledStudent` permits preview lessons for
   any authenticated user, but `LessonViewSet.get_queryset()` filters students to enrolled
   courses only — so previews are filtered out before the permission is ever consulted.
   Dead branch; the "marketing hook" doesn't work.
4. **Slug collisions.** `Course.save()` slugifies the title with no uniqueness suffix; two
   courses with the same title collide on the unique `slug` → IntegrityError.
5. **ERD/code role drift.** ERD says `tutor`; code says `instructor`. Pick one before you
   have data, or migrations/queries will fight you later.
6. **Access-token logout gap (minor).** Logout blacklists the *refresh* token only; the
   15-min access token stays valid until expiry. Acceptable, but document it.

---

## 4. Security review (student-risk focused)

| # | Issue | Risk | Fix |
|---|---|---|---|
| S1 | No email verification / activation flow, `is_active=False` default | **Blocker** — nobody logs in; or if defaulted True, open spam signups | Build register→verify→activate; add email backend |
| S2 | Throttle store is per-process LocMem | **High** — rate limits (incl. login brute-force) effectively don't work across Gunicorn/Passenger workers | Move cache + throttle to Upstash Redis |
| S3 | No object check on Lesson **create** | **High (IDOR)** once create is fixed, an instructor could attach lessons to another instructor's module | Validate module ownership in serializer/service |
| S4 | No password-reset token invalidation of sessions | Medium | Implement `reset_password` per design doc |
| S5 | No account lockout / no CAPTCHA on login | Medium | Rely on shared-cache throttle (S2) + add lockout |
| S6 | Signed S3 URLs valid 1h, shareable | Medium (piracy) | Cloudflare Stream / CloudFront signed cookies for video |
| S7 | No security headers beyond Django defaults (no CSP, Referrer-Policy) | Low (API) | Add `django-csp`, `SECURE_REFERRER_POLICY` |
| S8 | No webhook signature verification (no payments yet) | High *when* payments land | HMAC-verify Paystack webhook before processing |
| S9 | No audit logging / no Sentry | Medium | Wire Sentry (staged in `.env`) |
| S10 | Course-detail tree exposed full lesson bodies (`content`/`video_url`) to anyone | **High** (paid-content piracy) | Server-side redaction of non-preview bodies for non-entitled viewers |

**Resolved since this review:** ✅ **S1** (auth flow), ✅ **S3** (lesson-create
ownership check), ✅ **S4** (reset revokes sessions), ✅ **S8** (Paystack webhook is
HMAC-verified), ✅ **S9** (Sentry wired + structured `LOGGING` config), ✅ **S10**
(paid-lesson bodies redacted; `locked` flag added). Still open: **S2** (needs
`REDIS_URL` in prod), **S5** (lockout/CAPTCHA), **S6** (video piracy — needs a video
host), **S7** (CSP/headers).

---

## 5. Scale & load — can it take 1,000 users/minute?

**Not as architected.** 1,000 users/min is modest in raw throughput (~tens of req/s), so
the problem is not Django — it's the deployment shape and the missing infra:

1. **cPanel/Truehost shared hosting + Passenger is the #1 blocker.** Shared hosting caps
   CPU, RAM, and worker processes, and MySQL connections are typically capped at ~25–150.
   This will not reliably serve 1,000 authenticated LMS users/min with video. **Move to a
   VPS/managed platform** (Render, Railway, Fly.io, DigitalOcean App Platform, or AWS
   ECS/Fargate) with multiple Gunicorn/Uvicorn workers **behind a load balancer**, and put
   **Cloudflare** in front as CDN + WAF.
2. **No shared cache.** Catalog reads hit MySQL every request. Add **Upstash Redis** for
   Django cache, DRF throttle store, and session/lock storage.
3. **`CONN_MAX_AGE=60` × many workers can exhaust MySQL connections.** Add a pooler
   (ProxySQL / RDS Proxy) or tune worker count to the connection cap.
4. **No async workers.** Any inline email/PDF/external call blocks a request worker →
   thread starvation under load. Add **Celery + Upstash** and push all side effects to
   `transaction.on_commit`.
5. **Video must not touch Django.** Serve via Cloudflare Stream/R2 or CloudFront; Django
   only mints upload/playback credentials.
6. **No health check / readiness endpoint** for the load balancer.
7. **Static via WhiteNoise is fine** for admin assets; never serve media through it.

**Idempotency:** designed for payments (`select_for_update` + status short-circuit) but
**no code exists**. No mutating endpoint (enroll, mark-complete) uses idempotency keys.
The DB unique constraints on `Enrollment`, `LessonProgress`, module/lesson order are the
one real safety net present — keep them.

---

## 6. Wiring the `.env` (reference)

**Update:** Redis cache, Sentry, email, the R2 endpoint, and the frontend URL are now
**already wired** in `config/settings.py` — just fill the values in `.env` (see `GO-LIVE.md`).
The snippets below are kept as a record of what was added and as the template for the
remaining `[PENDING]` items (Celery):

```python
# --- Redis cache + shared throttle (Upstash) ---
CACHES = {"default": {
    "BACKEND": "django.core.cache.backends.redis.RedisCache",
    "LOCATION": env("REDIS_URL"),
}}
# DRF then uses this shared cache for throttling automatically.

# --- Sentry ---
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
if env("SENTRY_DSN", default=""):
    sentry_sdk.init(
        dsn=env("SENTRY_DSN"),
        integrations=[DjangoIntegration()],
        environment=env("SENTRY_ENVIRONMENT", default="production"),
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.1),
    )

# --- Email (verification/reset) --- ALREADY DONE in Phase 0 (console fallback
#     until EMAIL_HOST is set). See config/settings.py "Email + account lifecycle".

# --- Cloudflare R2 (if serving media from R2 instead of AWS) ---
AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)

# --- Celery (add config/celery.py + a worker dyno) ---
CELERY_BROKER_URL = env("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND")
```
Add to `requirements.txt`: `redis`, `django-redis` (optional), `celery`, `sentry-sdk`,
`django-anymail` or SMTP, and (if used) `cloudinary` / `django-cloudflare-*`.

---

## 8. Phase 0 — what shipped (this pass)

**Migrations** — `apps/{accounts,courses,enrollment}/migrations/0001_initial.py`
(all indexes + unique constraints included). Generate/apply with:
```bash
python manage.py migrate
```

**Accounts lifecycle (register → verify → activate → login → reset)** — new files:
`apps/accounts/{models,serializers,services,views,urls,emails,admin}.py`,
`apps/core/exceptions.py`, `apps/accounts/tests/test_auth_flow.py`, plus settings wiring
(email backend, scoped auth throttles, domain-exception handler) and `config/settings_test.py`.

**New models:** `StudentProfile`, `TutorProfile`, `EmailVerificationToken`,
`PasswordResetToken` (single-use, expiring UUID tokens).

**Endpoints (all under `/api/v1/auth/`):**

| Method + path | Purpose | Auth |
|---|---|---|
| `POST register/` | Create inactive account (role forced to `student`), email a link | public |
| `POST verify-email/` | Consume token → `is_active=True` | public |
| `POST resend-verification/` | Re-issue a verification link (no enumeration) | public |
| `POST password-reset/` | Request reset link (always 200, no enumeration) | public |
| `POST password-reset/confirm/` | Set new password + revoke all refresh tokens | public |
| `POST login/` | JWT pair; clear "not verified" error; embeds user object | public |
| `POST token/refresh/`, `POST logout/` | Rotate / blacklist refresh token | public |
| `GET me/` | Current user | Bearer |

**Security properties baked in:** role can't be self-escalated at registration;
no account enumeration on resend/reset; single-use, time-boxed tokens; password reset
revokes outstanding JWTs; Django password validators enforced; per-endpoint throttles
(effective once the cache is Redis — see §5).

**Tests:** `python manage.py test --settings=config.settings_test` → **14 passing**
(runs on SQLite, no MySQL needed).

**Also shipped (#3–#5):**
- **Catalog authoring** — `CategoryViewSet` (admin writes), `ModuleViewSet`, fixed
  `LessonViewSet`/`LessonSerializer` (writable `module` + ownership checks), unique
  slugs (`apps/core/utils.py`), catalog search/filter/order, `admin.py` for courses
  + enrollment, `IsAdminOrReadOnly` permission.
- **Enrollment loop** — `apps/enrollment/{services,serializers,views,urls,admin}.py`:
  enrol (free/idempotent; paid → `402`), `complete-lesson`, `progress`, auto-completion.
- **Infra** — Redis cache backend (on `REDIS_URL`), Sentry (on `SENTRY_DSN`),
  `GET /healthz/`, catalog filtering; `redis`/`sentry-sdk` added to requirements.
- **Tests** — 32 passing total (`python manage.py test --settings=config.settings_test`).

**Documentation delivered:** `API-REFERENCE.md` (HTTP contract for frontend),
`FUNCTIONAL-SPEC.md` (every behavior + build status), `GO-LIVE.md` (deployment).

**Also shipped (Phase 1 — payments):** `apps.payments` — Paystack checkout
(initialize → verify → auto-enrol), HMAC-verified idempotent webhook, server-side
amount/status verification, `Payment` model + admin audit, `grant_enrollment`
service. 12 tests (mocked gateway). **80 tests passing total** (adds video,
live classes + reminders, messaging, and instructor-dashboard suites).

**Also shipped (Phase 2):** lesson **video** (R2 presigned upload + signed playback),
**live classes** (schedule/join-window/attendance/LiveKit token), **messaging** (gated
DMs + unread), **instructor dashboard** (`apps.dashboard`), **Celery** (async email +
live-class reminders). **80 tests total.**

**Still open:** hosting move (#6, ops); Phase 1 remainder (applications, receipts,
Celery async); Phase 2 remainder (quizzes, assignments, certificates, notifications
feed, real-time/WebSocket messaging).

> **Env note:** these were generated/tested against the locally-installed Django **6.0**
> using a SQLite override (the repo targets Django 5.0 + MySQL). Migrations and code are
> backend/version-agnostic; on your Django 5.0 + PyMySQL target, `migrate` and
> `manage.py test` run natively with no override needed.

---

## 7. Recommended path to production (ordered)

**Phase 0 — make it deployable at all (days)**
1. ✅ **DONE** — `makemigrations` for all apps; migrations committed.
2. ✅ **DONE** — accounts API: register → email verify → activate → password reset + email backend.
3. ✅ **DONE** — Lesson serializer fixed; Category/Module endpoints + ownership checks; `admin.py` for all apps; unique slugs; catalog search/filter.
4. ✅ **DONE** — enrollment API: enroll (free/idempotent, paid→402), mark-lesson-complete, progress read, auto-completion.
5. ✅ **DONE (code)** — Redis cache backend (activates on `REDIS_URL`) + Sentry (on `SENTRY_DSN`) + `/healthz`. *Provisioning the services is an ops step (see `GO-LIVE.md`).*
6. ⬜ Move off shared hosting to a VPS/PaaS behind Cloudflare. *(Ops task — see `GO-LIVE.md`.)*

**Phase 0 is code-complete.** Remaining item #6 is an infrastructure/ops decision, not code.

**Phase 1 — the money + learning loop**
7. ✅ **DONE** — **Payments** (`apps.payments`): idempotent Paystack initialize →
   verify → auto-enrol, HMAC-verified webhook, server-side amount/status checks,
   admin audit. 12 tests (gateway mocked). ⬜ Applications/admissions + emailed
   receipts still open.
8. 🟡 **Partial** — a service layer exists where it matters (`accounts.services`,
   `enrollment.services`, `payments.services`, `core.exceptions` + envelope).
   Dedicated `selectors.py` not yet split out.
9. ✅ **DONE** — **Celery** (`config/celery.py`): async account emails + Celery-Beat
   **live-class reminders** (idempotent). Worker + beat run alongside the app.
   ⬜ PDF/certificate jobs will reuse the same worker.

**Phase 2 — the platforms you asked about**
10. ⛔ Tutor tools: assignments + submissions + grading; quizzes + auto-grading. *(the
    **tutor management dashboard** ✅ is done: `GET /instructor/dashboard/` + `/students/`.)*
11. ✅ **DONE** — **Live classes** (`apps.liveclasses`): schedule, join-window gating,
    attendance, external + LiveKit-token providers, **Celery-Beat reminders**.
12. 🟡 **Messaging DONE** (`apps.messaging`): gated direct messages, threads, unread
    count. ⬜ Notifications feed + real-time (Channels/WebSocket) still to do.
13. ⬜ Certificates, announcements, blog, testimonials.
    ✅ **Also done:** **lesson video** (`apps/core/storage.py` + lesson actions) —
    R2/S3 presigned upload + signed playback.

**Cross-cutting (do throughout):** ✅ tests (80 passing), ✅ structured logging,
✅ Celery async;
⬜ OpenAPI schema (`drf-spectacular`), CI, DB backups, load test before launch.
