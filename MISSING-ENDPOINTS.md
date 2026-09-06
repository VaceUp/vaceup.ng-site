# Endpoint Audit — Frontend vs Backend

**Date:** 2026-09-06 · **Frontend client:** `frontend/src/lib/api.ts` · **Endpoint map:** `frontend/src/lib/api-endpoints.ts`

## Summary

Every backend router mounted in `backend/config/urls.py` now has a matching typed
client method in `api.ts`. Three frontend features have **no backend route yet** —
they are documented as `PENDING_ENDPOINTS` in `api-endpoints.ts` and listed below
with their intended contract so they can be built later without re-discovery.

## ✅ Endpoints that exist in the backend (client methods added this pass)

| Backend router (api/v1/) | Client methods added | Notes |
|---|---|---|
| `announcements/` | `getAnnouncements`, `getAnnouncement` | Priority/target/status model in `apps.announcements` |
| `assignments/` | `getAssignments`, `getAssignment` | |
| `submissions/` | `getSubmissions`, `submitAssignment` | Submit action path to confirm against `/api/schema/` |
| `quizzes/`, `quiz-attempts/` | `getQuizzes`, `getQuizAttempts` | |
| `code-editor/sessions/` | `getCodeEditorSessions` | Realtime collaboration runs over WebSocket (PRD §6) |
| `whiteboard/sessions/` | `getWhiteboardSessions` | Realtime canvas runs over WebSocket (PRD §7) |
| `lessons/`, `modules/`, `categories/` | *(documented in map; add client getters when the course page needs them)* | Flat DefaultRouter routes |

Already wired before this pass: auth (`accounts`), `courses`, `enrollments`,
`payments`, `live-classes` (incl. `join`), `messaging`, `dashboard`, `cart`,
`applications`, `notifications`, `healthz`.

## ⏳ PENDING — no backend route exists yet (build later)

### 1. Newsletter — `apps.newsletter` (new)
Used by: footer "Stay Updated" form (`components/landing/Footer.tsx`).
Current frontend behaviour: shows a local "thanks for subscribing" state; nothing is stored.
```
POST /api/v1/newsletter/subscribe/     { email }                → 201 { id, email, is_confirmed }
POST /api/v1/newsletter/confirm/       { token }                → 200 (from emailed link)
POST /api/v1/newsletter/unsubscribe/   { token }                → 200
```
Build notes: double opt-in (confirm email), store source page, rate-limit per IP
(5/min), include in Celery async tasks. `EDITOR_HOST`/`EMAIL_HOST` must be live first.

### 2. Contact messages — `apps.core` or new `apps.contact`
Used by: contact page form (`app/contact/page.tsx`).
Current frontend behaviour: opens a pre-filled `mailto:info@vaceup.ng`.
```
POST /api/v1/contact/   { name, email, subject, message }   → 201 { id }
```
Build notes: spam protection (honeypot field + throttle 3/min/IP), notify
info@vaceup.ng via Celery email, store for the admin inbox.

### 3. Public certificate verification — action on `apps.certificates`
Needed by: certificate QR codes (PRD §13 — verification link must work
unauthenticated).
```
GET /api/v1/certificates/verify/{code}/   → 200 { student_name, course, issued_at, certificate_number } | 404
```
Build notes: `AllowAny` + throttle, returns only public fields.

## 🔎 Verify after backend redeploy

- `POST /submissions/` payload shape (assignment submit) — confirm against `/api/schema/`.
- `POST /api/v1/announcements/{id}/read/` — read-receipt action route name.
- `GET /api/v1/live-classes/{id}/reminders/` — whether class reminders shipped with `apps.liveclasses`.
- Cart → Paystack checkout flow (`payments/initialize/` → `verify/{reference}/`) once `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` is set in the build env.

## Frontend-only placeholders (intentional, no endpoint needed)

- Auth modal / login redirects — real API.
- Apply page course catalog — `GET /courses/` with static fallback list while the backend is down.
- Course card images — self-hosted at `/public/courses/*.jpg` (restored this pass; the live site was 404-ing on them).
