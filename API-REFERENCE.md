# VaceUp LMS — API Reference (Frontend Handover)

**Base URL:** `https://api.vaceup.ng`  ·  **API prefix:** `/api/v1/`
**Auth:** JWT Bearer tokens (djangorestframework-simplejwt)
**Content-Type:** `application/json` for all request bodies (except file uploads → `multipart/form-data`)

> This document is the source of truth for the HTTP contract. For *what each
> feature is supposed to do* (behavior, screens, status), see `FUNCTIONAL-SPEC.md`.
> Kept in sync as the backend changes — last updated for Phase 0 (#1–#5),
> Phase 1 payments (§8), and Phase 2: video (§6), live classes (§9), messaging
> (§10), instructor dashboard (§11).

---

## 1. Conventions

### 1.1 Authentication
Send the access token on every protected request:
```
Authorization: Bearer <access_token>
```
- **Access token** lifetime: **15 minutes**. **Refresh token**: **7 days**.
- Refresh tokens **rotate**: each successful refresh returns a *new* refresh
  token and blacklists the old one. **The client must store the new refresh
  token returned by `/auth/token/refresh/`** and discard the previous one.
- On `401` with an expired access token, call `/auth/token/refresh/`; if that
  also fails, send the user back to login.

### 1.2 Pagination
List endpoints use page-number pagination (**page size 20**):
```json
{ "count": 57, "next": "https://.../?page=3", "previous": "https://.../?page=1",
  "results": [ ... ] }
```
Query param: `?page=<n>`.

### 1.3 Filtering / search / ordering
Where supported (see each endpoint): `?search=`, `?ordering=field` (prefix `-`
for descending), and exact-match filters like `?category=3&level=beginner`.

### 1.4 Error envelopes
There are **three** error shapes — handle all three:

| Source | HTTP | Body shape |
|---|---|---|
| Field validation (serializer) | 400 | `{"field": ["message", …], …}` or `{"detail": "…"}` |
| Auth / permission (DRF) | 401 / 403 | `{"detail": "…", "code"?: "…"}` |
| **Domain error (business rule)** | 400/402/403/409 | `{"error": {"code": "…", "detail": "…"}}` |

Domain `code` values you will encounter: `already_exists`, `invalid_token`,
`not_enrolled`, `payment_required`, `payment_failed`, `course_free`,
`not_available`, `illegal_transition`.

Throttled requests return **429** `{"detail": "Request was throttled. Expected available in N seconds."}`.

### 1.5 CORS
Only origins in the server's `CORS_ALLOWED_ORIGINS` may call the API from a
browser. Give the ops team every frontend origin (prod + staging).

---

## 2. Auth & Accounts  `/api/v1/auth/`

### `POST /auth/register/`  — public · throttle 5/min
Create a **student** account (inactive until email-verified). Role is forced to
`student` server-side; any `role`/`is_staff` sent by the client is ignored.
```json
// request
{ "email": "ada@example.com", "full_name": "Ada Lovelace", "password": "S3cure-pass!" }
// 201
{ "detail": "Account created. Check your email to verify your address before logging in." }
```
Errors: `400` weak/invalid password or email; `400` `{"email":["An account with this email already exists."]}`.

### `POST /auth/verify-email/`  — public · throttle 10/min
```json
{ "token": "0f8e…-uuid-from-the-emailed-link" }   // → 200 {"detail":"Email verified. You can now log in."}
```
Errors: `400 {"error":{"code":"invalid_token", …}}` if missing/used/expired.

### `POST /auth/resend-verification/`  — public · throttle 3/min
```json
{ "email": "ada@example.com" }   // → 200 always (never reveals if the account exists)
```

### `POST /auth/password-reset/`  — public · throttle 5/min
```json
{ "email": "ada@example.com" }   // → 200 always (no account enumeration)
```

### `POST /auth/password-reset/confirm/`  — public · throttle 5/min
```json
{ "token": "uuid", "new_password": "N3w-pass!" }   // → 200
```
Side effect: **all** the user's existing refresh tokens are revoked (any other
logged-in sessions are killed). Errors: `400` invalid token / weak password.

### `POST /auth/login/`  — public · throttle 10/min
```json
// request
{ "email": "ada@example.com", "password": "S3cure-pass!" }
// 200
{ "access": "<jwt>", "refresh": "<jwt>",
  "user": { "id": 1, "email": "ada@example.com", "full_name": "Ada Lovelace",
            "role": "student", "is_active": true, "date_joined": "2026-08-23T10:00:00Z" } }
```
Errors: `401 {"detail":"…","code":"email_not_verified"}` when the password is
correct but the account is unverified; `401` generic for bad credentials.

### `POST /auth/token/refresh/`  — public
```json
{ "refresh": "<jwt>" }   // → 200 { "access": "<new>", "refresh": "<new>" }
```
**Store the new refresh token.** Errors: `401` if the refresh token is expired/blacklisted.

### `POST /auth/logout/`  — public (send the refresh token to blacklist it)
```json
{ "refresh": "<jwt>" }   // → 200 {}
```
Note: this blacklists the **refresh** token. The current **access** token stays
valid until it expires (≤15 min) — the frontend should also drop it locally.

### `GET /auth/me/`  — Bearer
```json
// 200
{ "id": 1, "email": "ada@example.com", "full_name": "Ada Lovelace",
  "role": "student", "is_active": true, "date_joined": "2026-08-23T10:00:00Z" }
```

---

## 3. Categories  `/api/v1/categories/`
Public read; **admin-only** write. Lookup by `slug`.

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | `/categories/` | public | → paginated `[{id, name, slug}]` |
| GET | `/categories/{slug}/` | public | → `{id, name, slug}` |
| POST | `/categories/` | admin | `{name}` → 201 `{id, name, slug}` (slug auto-generated) |
| PATCH/PUT | `/categories/{slug}/` | admin | `{name}` → 200 |
| DELETE | `/categories/{slug}/` | admin | → 204 |

---

## 4. Courses  `/api/v1/courses/`
Public read (published only, unless you are the owning instructor/admin);
**instructor/admin** write. Lookup by `slug`.

**Filtering:** `?category=<id>`, `?level=beginner|intermediate|advanced`,
`?is_published=true|false`, `?search=<text>` (title+description),
`?ordering=price|created_at|title` (prefix `-` for desc).

### `GET /courses/` — list (lightweight)
```json
{ "count": 12, "next": null, "previous": null, "results": [
  { "id": 3, "title": "Django Basics", "slug": "django-basics",
    "category": "Programming", "instructor_name": "Jane Doe",
    "level": "beginner", "price": "0.00", "thumbnail": "https://…signed…",
    "is_published": true } ] }
```

### `GET /courses/{slug}/` — detail (full tree)
```json
{ "id": 3, "title": "Django Basics", "slug": "django-basics",
  "description": "…", "category": 1, "category_name": "Programming",
  "instructor": 5, "instructor_name": "Jane Doe", "level": "beginner",
  "price": "0.00", "thumbnail": "https://…", "is_published": true,
  "created_at": "2026-08-01T12:00:00Z",
  "modules": [
    { "id": 9, "title": "Getting Started", "order": 1,
      "lessons": [
        { "id": 21, "module": 9, "title": "Welcome", "content": "…",
          "video_url": "https://…", "order": 1, "duration_seconds": 300,
          "is_preview": true, "locked": false, "has_video": true } ] } ] }
```
**Content gating:** in this tree, each lesson has a `locked` boolean. For a viewer
who isn't entitled to the course (not enrolled, not the owning instructor, not an
admin), **non-preview** lessons come back with `locked: true` and **empty
`content`/`video_url`** — the outline (title, order, duration) stays visible so you
can render a locked list with an "Enrol/Buy to unlock" CTA. Preview lessons and all
lessons for entitled viewers return in full (`locked: false`). Don't rely on hiding
locked lessons client-side — the server already redacts the bodies.

### `POST /courses/` — instructor/admin
```json
// request (instructor is bound server-side; slug is derived from title)
{ "title": "Django Basics", "category": 1, "level": "beginner",
  "price": "0.00", "description": "…", "is_published": false }
// 201 → course detail
```
Thumbnail upload: send `multipart/form-data` with a `thumbnail` file field.

### `PATCH /courses/{slug}/` · `DELETE /courses/{slug}/`
Owner instructor or admin only (others → `403`). Publish a course by
`PATCH {"is_published": true}`.

---

## 5. Modules  `/api/v1/modules/`
Authenticated read (scoped by role); **instructor/admin** write.

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | `/modules/` | auth | list scoped to your courses / enrollments |
| GET | `/modules/{id}/` | auth | `{id, course, title, order, lessons:[…]}` |
| POST | `/modules/` | instructor/admin | `{course, title, order}` → 201 |
| PATCH/PUT/DELETE | `/modules/{id}/` | owner instructor/admin | |

Ownership: creating/modifying a module on a course you don't own → `403`
`{"detail":"You can only add modules to your own courses."}`. `(course, order)`
must be unique → duplicate order returns `400`.

---

## 6. Lessons  `/api/v1/lessons/`
Read is gated: anonymous & non-enrolled users see **only preview lessons of
published courses**; enrolled students see their courses' lessons; instructors
see their own; admins see all. **instructor/admin** write.

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | `/lessons/` | see above | list |
| GET | `/lessons/{id}/` | see above | lesson object (404 if not visible to you) |
| POST | `/lessons/` | instructor/admin | `{module, title, content, video_url, order, duration_seconds, is_preview}` → 201 |
| PATCH/PUT/DELETE | `/lessons/{id}/` | owner instructor/admin | |

Ownership: creating a lesson under a module of a course you don't own → `403`.
`(module, order)` unique → duplicate order returns `400`.

### Lesson video (direct-to-R2 upload + signed playback)
Videos upload straight from the browser to R2/S3; the server only signs URLs.

**Upload sequence (instructor/admin, owner):**
1. `POST /lessons/{id}/video-upload-url/ {content_type}` → `{key, upload_url,
   method:"PUT", headers:{Content-Type}, expires_in}`. `content_type` must be
   `video/*` (mp4/webm/mov/mkv).
2. `PUT` the file to `upload_url` with the exact `Content-Type` header (direct to
   R2 — not through this API).
3. `POST /lessons/{id}/attach-video/ {key}` → binds the object to the lesson
   (rejects a `key` outside this lesson's prefix → `400`).

**Playback (any viewer who may see the lesson):**
- `GET /lessons/{id}/play/` → `{playback_url, expires_in, source}`. `source` is
  `upload` (short-lived signed R2 GET, ~1h) or `external` (the stored `video_url`).
  Gated exactly like lesson reads (preview / enrolled / owner / admin), else `404`.
- `503 storage_not_configured` if R2/S3 keys aren't set on the server.

---

## 7. Enrollments & Progress  `/api/v1/enrollments/`
**Student role only** (instructors/admins → `403`).

### `GET /enrollments/` — my enrollments (paginated)
```json
{ "count": 2, "results": [
  { "id": 7, "course": { "id": 3, "title": "Django Basics",
    "slug": "django-basics", "thumbnail": "https://…" },
    "status": "active", "progress_percent": "50.00",
    "enrolled_at": "2026-08-20T09:00:00Z", "completed_at": null } ] }
```

### `POST /enrollments/` — enrol
```json
{ "course": 3 }   // → 201 enrollment object
```
- **Free course** (`price == 0`): enrolls immediately, `status: active`.
- **Already enrolled**: returns the existing enrollment (idempotent).
- **Paid course**: `402 {"error":{"code":"payment_required", …}}` — **do not enrol
  here; start checkout via `POST /payments/initialize/` instead** (see §8). A
  successful payment enrols the student automatically.
- **Unpublished course**: `403 not_enrolled`.

### `GET /enrollments/{id}/` — one enrollment (must be yours).

### `GET /enrollments/{id}/progress/` — per-lesson completion
```json
[ { "id": 40, "lesson": 21, "completed": true,
    "completed_at": "2026-08-21T10:00:00Z" } ]
```

### `POST /enrollments/complete-lesson/` — mark a lesson done
```json
{ "lesson": 21 }   // → 200 updated enrollment (progress recomputed server-side)
```
- Progress is **always** recomputed from stored completions — never trust a
  client-sent percentage. Reaching 100% flips `status` to `completed` and sets
  `completed_at`.
- Idempotent (re-marking the same lesson is a no-op).
- No active enrollment in that lesson's course → `403 not_enrolled`.

---

## 8. Payments (Paystack)  `/api/v1/payments/`
**Student role only.** Paid-course purchase → redirect to Paystack → verify → the
student is auto-enrolled. **All confirmation is server-side** (the backend calls
Paystack's verify API); never mark a purchase complete from the client.

**Checkout sequence the frontend runs:**
1. `POST /payments/initialize/ {course}` → get `authorization_url`.
2. Redirect the browser to `authorization_url` (Paystack's hosted checkout).
3. Paystack redirects back to your callback page with `?reference=…`.
4. `POST /payments/verify/ {reference}` → on success the student is enrolled
   (the backend also confirms independently via webhook, so enrollment happens
   even if the user closes the tab before step 4).

### `POST /payments/initialize/`
```json
// request
{ "course": 3 }
// 201
{ "reference": "vaceup_9f2c…", "course": 3, "course_title": "Django Basics",
  "amount": "5000.00", "currency": "NGN", "status": "pending",
  "authorization_url": "https://checkout.paystack.com/…", "paid_at": null,
  "created_at": "2026-08-23T10:00:00Z" }
```
- Reuses an existing `pending` payment for the same course (idempotent — safe to
  double-click). Errors: `400 course_free` (use `/enrollments/` for free courses),
  `409 already_exists` (already enrolled), `402 payment_failed` (gateway/config error).

### `POST /payments/verify/`
```json
{ "reference": "vaceup_9f2c…" }   // → 200 payment object with "status":"success"
```
- Idempotent. On success the enrollment is created/confirmed.
- `402 {"error":{"code":"payment_failed", …}}` if not successful or the amount
  doesn't match the course price; the payment is marked `failed`/`abandoned`.
- `404` if the reference isn't yours / doesn't exist.

### `GET /payments/` · `GET /payments/{reference}/`
Your payment history / a single payment (must be yours).

### `POST /payments/webhook/`  — Paystack only (not for the frontend)
Server-to-server. Authenticated by the `x-paystack-signature` HMAC header, not a
token. Configure this URL in your Paystack dashboard. It re-verifies server-side
and enrols idempotently. Returns `200` (or `401` on a bad signature).

---

## 9. Live classes  `/api/v1/live-classes/`
Instructors schedule sessions on their courses; enrolled students join within a
time window; attendance is recorded.

**Reads** (auth, scoped): admins see all; instructors see their own courses';
students see classes on courses they're actively enrolled in. Filter
`?course=<id>&status=scheduled|live|ended|cancelled`.

### `POST /live-classes/` — instructor/admin (owner)
```json
{ "course": 3, "title": "Week 1 Live", "scheduled_start": "2026-09-01T18:00:00Z",
  "duration_minutes": 60, "provider": "external",
  "join_url": "https://meet.google.com/abc-defg-hij" }
```
- `provider`: `external` (store a Meet/Zoom link in `join_url`) or `livekit`
  (native; set `room_name`, the server mints a per-user token at join).
- Scheduling on a course you don't own → `403`.
- Read shape adds `scheduled_end` and `joinable` (bool, is the window open now).

### `POST /live-classes/{id}/join/`
Returns join credentials and records attendance.
- external → `{ "provider":"external", "url":"https://…" }`
- livekit → `{ "provider":"livekit", "room":"…", "ws_url":"wss://…", "token":"<jwt>" }`
- Student must be enrolled **and** within the window (opens 10 min before start,
  closes 15 min after end) → else `409 class_not_joinable`. The owning instructor
  (host) may join any time and joins as publisher.

### `GET /live-classes/{id}/attendance/` — instructor/admin
`[ { "id": 5, "student": {"id":7,"full_name":"…","email":"…"}, "joined_at":"…" } ]`

---

## 10. Messaging  `/api/v1/messages/`
Direct messages. **Policy:** a student and an instructor may message each other
only if the student is enrolled with that instructor; admins reach anyone;
student↔student and instructor↔instructor are blocked. (Real-time is future —
poll `unread-count`.)

| Method | Path | Body → Response |
|---|---|---|
| POST | `/messages/` | `{recipient, body}` → 201 message, or `403 messaging_not_allowed` |
| GET | `/messages/` | conversation summaries: `[{user_id, full_name, role, last_message, last_at, last_from_me, unread}]` |
| GET | `/messages/thread/?with=<user_id>` | paginated thread (oldest first); **marks incoming read** |
| GET | `/messages/unread-count/` | `{"unread": 3}` |

---

## 11. Instructor dashboard  `/api/v1/instructor/`
Instructor/admin only (students → `403`). Scoped to the logged-in instructor.

### `GET /instructor/dashboard/`
```json
{ "courses": {"total": 4, "published": 3}, "students": 128,
  "enrollments": {"active": 140, "completed": 22}, "revenue": "560000.00",
  "upcoming_classes": 2,
  "recent_enrollments": [ {"student_name":"…","course_title":"…",
    "progress_percent":"50.00","enrolled_at":"…"} ] }
```
### `GET /instructor/students/`
Paginated roster across the instructor's courses. Filter `?course=<id>&status=`.
Each row: `{student_id, student_name, email, course, course_title, status,
progress_percent, enrolled_at}`.

---

## 12. Health  `GET /healthz/`
No auth. `200 {"status":"ok","database":"ok"}` when healthy, `503` when the DB
is unreachable. For load balancers / uptime monitors — do not expose in the UI.

---

## 13. Role & access matrix

| Capability | Anonymous | Student | Instructor | Admin |
|---|:--:|:--:|:--:|:--:|
| Browse published courses / categories | ✅ | ✅ | ✅ | ✅ |
| View preview lessons | ✅ | ✅ | ✅ | ✅ |
| Register / verify / reset password | ✅ | — | — | — |
| Enrol / mark lessons complete | — | ✅ | ❌ | ❌ |
| Pay for a course (Paystack) | — | ✅ | ❌ | ❌ |
| View gated lesson content / play video | — | ✅ (enrolled) | ✅ (own) | ✅ |
| Create/edit courses·modules·lessons·video | — | ❌ | ✅ (own) | ✅ (all) |
| Schedule live classes · read attendance | — | ❌ | ✅ (own) | ✅ (all) |
| Join a live class | — | ✅ (enrolled) | ✅ (host) | ✅ |
| Message (per policy in §10) | — | ✅ | ✅ | ✅ |
| Instructor dashboard / roster | — | ❌ | ✅ | ✅ |
| Manage categories | — | ❌ | ❌ | ✅ |
| Django admin (`/admin/`) | — | — | — | ✅ |

---

## 14. Not built yet (do not wire UI to these — no endpoints exist)
Applications/admissions · Assignments & grading · Quizzes · Certificates ·
Announcements · Blog · Testimonials · Notifications feed · Real-time (WebSocket)
messaging. See `FUNCTIONAL-SPEC.md` and `PRODUCTION-GAP.md` for the roadmap.
