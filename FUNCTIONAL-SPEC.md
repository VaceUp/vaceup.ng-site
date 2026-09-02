# VaceUp LMS — Functional Specification & Behavior Guide

*What the system does, what every action is expected to do, and exactly what is
built vs. not. Pair this with `API-REFERENCE.md` (the HTTP contract).*

**Status legend**
- ✅ **Built & tested** — implemented, covered by automated tests, ready to wire.
- 🟡 **Partial** — exists but incomplete or has a known caveat (called out inline).
- ⛔ **Not built** — no code/endpoint yet. Behavior below is the *intended* design
  so the frontend can plan, but **do not wire real UI to it** — there's nothing to call.

---

## 0. What VaceUp is
An online course platform (LMS). Three kinds of people use it:
- **Students** — browse the catalog, enrol in courses, watch lessons, track progress.
- **Instructors (a.k.a. tutors)** — create and manage courses, modules and lessons.
- **Admins** — run the platform: manage categories, users, and everything via Django admin.

The **built** product today is the spine of the platform: accounts, the course
catalog, authoring, and the enrol → learn → progress → complete loop. The
revenue features (payments), the live/social features (live classes, messaging),
and the assessment features (assignments, quizzes, certificates) are **designed
but not built** (Phase 1–2).

---

## 1. Accounts & Authentication  ✅

### 1.1 Sign up  ✅
**Screen:** Registration form (email, full name, password).
**On "Create account" click →** `POST /auth/register/`.
- Server creates an **inactive** student account and emails a verification link.
- Password is validated (min length, not all-numeric, not too common, not similar
  to the email). Weak password → inline field errors (`400`).
- Duplicate email → error "An account with this email already exists."
- **Expected UX:** show "Check your inbox to verify your email." The user
  **cannot log in yet.**
- Role is always `student` here. Instructors/admins are created by staff (Django
  admin), never through this form.

### 1.2 Verify email  ✅
**Screen:** "Verify email" landing page that reads `?token=` from the URL.
**On page load / "Verify" click →** `POST /auth/verify-email/ {token}`.
- Valid, unused, unexpired token → account becomes **active**; show "Email
  verified — you can now log in."
- Invalid/used/expired token → `invalid_token`; offer a "Resend link" button.
- Tokens are **single-use** and expire in **24 hours**.

### 1.3 Resend verification  ✅
**On "Resend verification email" click →** `POST /auth/resend-verification/ {email}`.
- Always shows the same neutral message ("If an account matches, we've sent an
  email") — it never reveals whether the email exists. Old links are invalidated.

### 1.4 Log in  ✅
**Screen:** Login (email, password).
**On "Log in" click →** `POST /auth/login/`.
- Success → returns `access` + `refresh` tokens and the `user` object. Store both
  tokens (see 1.7) and route by `user.role`.
- Correct password but **unverified** → `401` with `code: email_not_verified`;
  show "Verify your email first" + a resend option.
- Wrong credentials → generic `401`.

### 1.5 Forgot / reset password  ✅
- **Forgot:** "Send reset link" → `POST /auth/password-reset/ {email}` → always
  `200` (no enumeration). Show neutral confirmation.
- **Reset:** reset page reads `?token=`; "Set new password" →
  `POST /auth/password-reset/confirm/ {token, new_password}`.
  - New password is validated. Token single-use, expires in **1 hour**.
  - **Side effect:** all existing sessions are logged out (refresh tokens revoked).
    After reset, send the user to login.

### 1.6 Current user  ✅
**On app load (when a token exists) →** `GET /auth/me/` to hydrate the session
and confirm the token is still valid. `401` → try refresh, else log out.

### 1.7 Session / token handling  ✅ (frontend responsibility)
- Access token lives **15 min**; refresh token **7 days**.
- On a `401` due to expiry, call `POST /auth/token/refresh/ {refresh}` →
  returns a **new** access **and** a **new** refresh (rotation). **Persist the new
  refresh token**; the old one is now dead.
- **Log out:** `POST /auth/logout/ {refresh}` to blacklist it, then clear local
  tokens. (The access token can't be revoked server-side; it just expires — so
  also drop it client-side immediately.)

---

## 2. Catalog browsing  ✅

### 2.1 Category list  ✅
**On catalog load →** `GET /categories/`. Public. Use for filter chips / nav.

### 2.2 Course list + search/filter  ✅
**On catalog load →** `GET /courses/`. Public sees **published** courses only.
- **Search box →** `?search=<text>` (matches title + description).
- **Filters →** `?category=<id>`, `?level=beginner|intermediate|advanced`.
- **Sort →** `?ordering=price` / `-price` / `created_at` / `title`.
- **Pagination →** `?page=<n>` (20 per page); render `count`/`next`/`previous`.
- List is the lightweight shape (card data). `price` is a string decimal
  (e.g. `"0.00"`); treat `"0.00"` as **Free**.

### 2.3 Course detail  ✅
**On opening a course →** `GET /courses/{slug}/`. Returns the full tree:
description, category, instructor name, price, and `modules[] → lessons[]`.
- For a **non-enrolled** viewer, each lesson carries a `locked` flag. Non-preview
  lessons come back **locked with empty `content`/`video_url`** (server-side
  redaction); preview lessons are full. Render locked lessons as 🔒 with an
  "Enrol/Buy to unlock" CTA — the outline (title, order, duration) is still there.
- ✅ The earlier leak (full bodies exposed to anyone) is **fixed**: bodies are
  redacted server-side for non-entitled viewers, so a non-paying visitor cannot
  read a paid course. Entitled viewers (enrolled student, owning instructor, admin)
  see everything.

### 2.4 Preview a lesson  ✅
**On clicking an unlocked (preview) lesson →** `GET /lessons/{id}/`.
- Preview lessons of published courses are viewable by anyone (even logged-out).
- Non-preview lesson while not enrolled → `404` (hidden). Show the locked state
  instead of calling it.

---

## 3. Course authoring (Instructor / Admin)  ✅

> Instructors act only on **their own** courses; admins act on all. Ownership is
> enforced server-side — a cross-owner write returns `403`.

### 3.1 Create a course  ✅
**Instructor dashboard → "New course" →** `POST /courses/` `{title, category,
level, price, description, is_published}`.
- The instructor is bound to the logged-in user automatically (not sent by client).
- `slug` is generated from the title and de-duplicated automatically.
- New courses default to **unpublished** (`is_published:false`) — invisible to
  the public until published.
- **Thumbnail:** send as `multipart/form-data` with a `thumbnail` file.

### 3.2 Add modules  ✅
**Course editor → "Add module" →** `POST /modules/` `{course, title, order}`.
- `order` must be unique within the course (duplicate → `400`). Use it to sequence sections.
- Adding a module to a course you don't own → `403`.

### 3.3 Add lessons  ✅
**Module editor → "Add lesson" →** `POST /lessons/` `{module, title, content,
video_url, order, duration_seconds, is_preview}`.
- `order` unique within the module. `is_preview:true` makes it a free marketing lesson.
- `video_url` is for **external** embeds (YouTube/Vimeo). For hosted video use the
  upload flow in 3.3a.
- Lesson under a module you don't own → `403`.

### 3.3a Upload lesson video (R2/S3 direct upload)  ✅
**Lesson editor → "Upload video":**
1. `POST /lessons/{id}/video-upload-url/ {content_type}` → the server returns a
   short-lived **signed PUT URL** + object `key`.
2. The browser **PUTs the file straight to R2/S3** (never through the API), with
   the `Content-Type` header the response specifies.
3. `POST /lessons/{id}/attach-video/ {key}` → binds it to the lesson.
- Playback (any entitled viewer): `GET /lessons/{id}/play/` → a short-lived signed
  URL (`source: "upload"`), or the external link (`source: "external"`). The public
  course tree exposes `has_video` per lesson so the UI can show a player.
- Ownership enforced; `503 storage_not_configured` if R2 keys aren't set.

### 3.4 Edit / reorder / delete  ✅
`PATCH`/`PUT`/`DELETE` on `/courses/{slug}/`, `/modules/{id}/`, `/lessons/{id}/`
(owner/admin only). Reordering = `PATCH` the `order` field.

### 3.5 Publish a course  ✅
**"Publish" toggle →** `PATCH /courses/{slug}/ {"is_published": true}`. Only then
does it appear in the public catalog and become enrollable.

### 3.6 Instructor dashboard (aggregate stats)  ✅
**Instructor home →** `GET /instructor/dashboard/` → course counts, distinct
student count, active/completed enrollments, **revenue** (sum of successful
payments for their courses), upcoming-class count, and 5 most-recent enrollments.
**Student roster →** `GET /instructor/students/` (paginated, filter by course/status).
Instructor/admin only.

---

## 4. Enrolling & learning (Student)  ✅

### 4.1 Enrol  ✅
**Course detail → "Enrol" →** `POST /enrollments/ {course}`.
- **Free course** → enrolled instantly (`status: active`, progress `0.00`).
- **Already enrolled** → returns the same enrollment (idempotent; button is safe
  to double-click).
- **Paid course** → `402 payment_required`. The "Enrol" button on a paid course
  should instead start **checkout** (see §4.7) — a successful payment enrols the
  student automatically.

### 4.2 My courses  ✅
**"My learning" →** `GET /enrollments/` → cards with course, `status`, and
`progress_percent`. Paginated.

### 4.3 Watch lessons (gated content)  ✅
Once enrolled, the student's lessons are fetchable via `GET /lessons/{id}/` and
appear in `GET /courses/{slug}/`. Suspended enrollment removes access; completed
keeps it.

### 4.4 Mark a lesson complete  ✅
**"Mark complete" on a lesson →** `POST /enrollments/complete-lesson/ {lesson}`.
- Server records completion and **recomputes** `progress_percent` from stored
  completions (client percentages are never trusted). Returns the updated enrollment.
- Idempotent. No enrollment in that course → `403 not_enrolled`.

### 4.5 Progress & auto-completion  ✅
- `progress_percent = completed_lessons / total_lessons × 100`.
- Hitting **100%** flips `status` to `completed` and stamps `completed_at`
  automatically. Show a "Course complete!" state. (Certificate issuance is ⛔ Phase 2.)
- **Per-lesson checklist →** `GET /enrollments/{id}/progress/`.

### 4.6 Student dashboard (aggregate)  ⛔
"Next class, pending assignments, overall progress" composite — **not built**
(depends on live classes/assignments which are also Phase 2). Build "My learning"
(4.2) from `GET /enrollments/` for now.

### 4.7 Pay for a course (Paystack)  ✅
**Course detail (paid) → "Enrol / Buy" →** a 4-step checkout:
1. **"Buy" click →** `POST /payments/initialize/ {course}` → returns
   `authorization_url`.
2. **Redirect** the browser to `authorization_url` (Paystack's hosted, PCI-compliant
   checkout — the app never touches card details).
3. Paystack redirects back to your **callback page** with `?reference=…`
   (set `PAYSTACK_CALLBACK_URL` to that page).
4. **Callback page loads →** `POST /payments/verify/ {reference}` → on success the
   student is **auto-enrolled**; route them into the course.

**Behavior & guarantees:**
- The backend **always confirms with Paystack server-side** and checks the paid
  amount against the course price — a tampered client can't unlock a course.
- **Idempotent end to end:** double-clicking "Buy" reuses the pending payment;
  verifying twice enrols once. A **webhook** (`/payments/webhook/`, Paystack →
  server, HMAC-signed) confirms the purchase independently, so the student is
  enrolled even if they close the tab before step 4.
- Free course sent here → `400 course_free` (use the free enrol path). Already
  enrolled → `409`. Payment not successful / amount mismatch → `402 payment_failed`
  (payment marked `failed`/`abandoned`).
- **Payment history →** `GET /payments/`.
- 🟡 **Ops:** set `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_CALLBACK_URL`
  in `.env` and register the webhook URL in the Paystack dashboard (see `GO-LIVE.md`).

---

## 5. Live classes  ✅
**Instructor schedules →** `POST /live-classes/` `{course, title, scheduled_start,
duration_minutes, provider, join_url|room_name}`. `provider` is `external`
(paste a Meet/Zoom link) or `livekit` (native — server mints a per-user token).
- **Students see** classes for courses they're enrolled in (`GET /live-classes/`,
  filter by course/status); each has a `joinable` flag.
- **Join →** `POST /live-classes/{id}/join/`. Enrolled students may join **within
  the window** (opens 10 min before start, closes 15 min after end) — outside it →
  `409`. Returns the meeting link (external) or `{room, ws_url, token}` (LiveKit).
  Attendance is recorded once. The **host** (owning instructor) can join any time.
- **Attendance →** `GET /live-classes/{id}/attendance/` (instructor/admin).
- **Reminders ✅:** enrolled students are emailed automatically before a class
  starts (default 30 min ahead) via a Celery Beat job — once per class, idempotent.
- 🟡 Native LiveKit needs `LIVEKIT_*` keys; without them, use `external` links.

## 6. Messaging  ✅
Direct messages between users. **Who may message whom:** a student and an
instructor only if the student is **enrolled with that instructor**; admins may
message anyone; student↔student and instructor↔instructor are blocked (anti-spam,
student safety). Violations → `403 messaging_not_allowed`.
- **Send →** `POST /messages/ {recipient, body}`.
- **Conversations list →** `GET /messages/` (latest message + unread per party).
- **Open a thread →** `GET /messages/thread/?with=<user_id>` (marks incoming read).
- **Badge →** `GET /messages/unread-count/`.
- 🟡 Delivery is request/response; **real-time (WebSockets)** is a future add — poll
  `unread-count` for a live badge.

## 7. Admin operations  ✅ (via Django admin)
`/admin/` (staff/superuser login) can manage: users (roles, activation),
student/tutor profiles, verification/reset tokens, categories, courses, modules,
lessons, enrollments, per-lesson progress, and **payments** (read-only audit —
records come from the gateway). This is the operational back office until custom
admin APIs exist. Categories are also manageable via the API
(`POST /categories/`, admin only).

---

## 8. Infrastructure behavior  ✅
- **Health check:** `GET /healthz/` for the load balancer / uptime monitor.
- **Rate limiting:** abuse-prone auth endpoints are throttled (login 10/min,
  register 5/min, resend 3/min, reset 5/min); general anon 50/h, authenticated
  1000/h. 🟡 These are only correct once a shared cache (Redis/Upstash) is set —
  see `GO-LIVE.md`. A `429` means "slow down."
- **Async jobs:** account emails and live-class reminders run on **Celery** (a
  worker + beat scheduler), not in the request — so sign-up/reset never block on
  SMTP. In dev they can run inline (`CELERY_TASK_ALWAYS_EAGER`).
- **Media:** private files are served via short-lived signed URLs; treat
  `thumbnail`/`video_url` as already-usable URLs, don't cache them past ~1h.

---

## 9. NOT BUILT — designed features & their intended behavior  ⛔
These have data models in the ERD and flows in the design docs, but **no code or
endpoints**. Listed so the frontend can plan; there is nothing to call yet.

| Feature | Intended behavior (future) |
|---|---|
| **Applications / admissions** | Apply to a course → admin approves/rejects → converts to enrollment. |
| **Notifications feed** | In-app feed (grade posted, class scheduled, payment confirmed) with read/unread. |
| **Assignments** | Instructor sets an assignment + deadline; student submits a file (late-flagged); instructor grades with feedback. |
| **Quizzes** | MCQ/true-false auto-graded on submit; short-answer manual; pass mark; attempts. |
| **Certificates** | On completion, issue a verifiable certificate (PDF + public verify page); revocable. |
| **Announcements** | Course-wide or academy-wide posts fanned out to notifications/email. |
| **Blog / Testimonials** | Marketing content + course testimonials. |
| **Real-time messaging** | WebSocket delivery + typing/read receipts (REST messaging exists today; §6). |

---

## 10. "Every screen → action → result" quick map (built features)

| Screen | Control | Calls | Expected result |
|---|---|---|---|
| Register | Create account | `POST /auth/register/` | 201; "verify your email" |
| Verify email | (auto) | `POST /auth/verify-email/` | Account active; go to login |
| Login | Log in | `POST /auth/login/` | Tokens + user; route by role |
| Login | Forgot password | `POST /auth/password-reset/` | Neutral "check email" |
| Reset page | Set new password | `POST /auth/password-reset/confirm/` | Sessions revoked; go to login |
| Any (boot) | (auto) | `GET /auth/me/` | Hydrate user or refresh/logout |
| Navbar | Log out | `POST /auth/logout/` | Refresh blacklisted; clear tokens |
| Catalog | Search/filter/sort | `GET /courses/?…` | Filtered, paginated cards |
| Catalog | Open course | `GET /courses/{slug}/` | Full tree; lock non-previews |
| Course | Play preview lesson | `GET /lessons/{id}/` | Preview plays; gated → 404 |
| Course | Enrol (free) | `POST /enrollments/` | Free→active; paid→402; dup→same |
| Course | Buy (paid) | `POST /payments/initialize/` | Get authorization_url → redirect |
| Callback | (auto) | `POST /payments/verify/` | Success→auto-enrol; else 402 |
| Payments | History | `GET /payments/` | My payments |
| My learning | Open | `GET /enrollments/` | My enrollments + progress |
| Lesson | Mark complete | `POST /enrollments/complete-lesson/` | Progress recomputed; 100%→completed |
| Lesson | Progress checklist | `GET /enrollments/{id}/progress/` | Per-lesson completion |
| Instructor | New course | `POST /courses/` | 201 (unpublished) |
| Instructor | Add module/lesson | `POST /modules/` · `POST /lessons/` | 201; foreign course → 403 |
| Instructor | Publish | `PATCH /courses/{slug}/` | Appears in catalog |
| Lesson editor | Upload video | `POST /lessons/{id}/video-upload-url/` → PUT → `attach-video/` | Video bound to lesson |
| Lesson player | Play | `GET /lessons/{id}/play/` | Signed URL (upload) or external link |
| Instructor | Schedule live class | `POST /live-classes/` | 201 (own course) |
| Timetable | Join class | `POST /live-classes/{id}/join/` | Link/token; window → 409 |
| Instructor | Attendance | `GET /live-classes/{id}/attendance/` | Who joined |
| Messages | Send | `POST /messages/` | 201 or 403 (policy) |
| Messages | Open thread | `GET /messages/thread/?with=` | Thread; marks read |
| Navbar | Unread badge | `GET /messages/unread-count/` | `{unread}` (poll) |
| Instructor home | Dashboard | `GET /instructor/dashboard/` | Stats + revenue |
| Instructor | Students | `GET /instructor/students/` | Roster (paginated) |
| Admin | Create category | `POST /categories/` | 201 (non-admin → 403) |

---

*Keep this file updated as features move from ⛔ to ✅. It, `API-REFERENCE.md`,
and `PRODUCTION-GAP.md` are the three living documents for the project.*
