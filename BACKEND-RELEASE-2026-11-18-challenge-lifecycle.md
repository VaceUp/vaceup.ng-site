# Backend release 2026-11-18 — challenge lifecycle, marketing segments and email fixes

Delta overlay only. Every file listed here is new or changed by this release;
extract over the existing backend application root (it builds on the
2026-11-15 challenge backend). **Run `python manage.py migrate` after
extracting — this release adds migrations.** Then restart the Python
application.

## What this release does

**1. Portal access no longer expires daily, and no email round-trip is
needed.** Session tokens now live for the round itself — access ends two
weeks after results are published, so a monthly challenge never leaves a
permanent portal behind. Every registration also receives a hashed six-digit
access code: with their email address it reopens the portal from any device
immediately (`POST /api/v1/challenges/access-code/`). The code is shown once
on the registration confirmation screen and included in the brief email. The
browser keeps the session in localStorage instead of sessionStorage, so
returning to the same device just works.

**2. The category brief PDF is delivered with the guide email.** The email
now carries a signed seven-day download link for the uploaded category PDF
(link rather than attachment: no SMTP size limits, no blocked-file filters)
plus a secondary button in the HTML layout.

**3. Administrators can disqualify or hard-delete a registration.**
`POST/DELETE /api/v1/challenges/admin/registrations/<id>/` (admin only):
disqualification records an audit reason, immediately kills every live
session and verification link, and queues an email to the participant
explaining the decision and the reason. Permanent deletion removes every
submission, snapshot, token and job by cascade and best-effort deletes the
verified evidence objects from storage; it refuses to run while audited score
corrections exist. The dashboard exposes both as buttons on each scorebook
row (delete requires typing DELETE).

**4. Challenge registrants become marketing segments.** New campaign
audiences `challenge_participants` and `challenge_students` target guest
emails by round and category; only registrations with the marketing opt-in
who verified their email and were not disqualified are included, and
participants who pay for a course move to the student segment automatically.
A new "Exclude registered challenge participants" flag implements the
stop/start lifecycle for general prospect mailings. Guest recipients are
supported end-to-end: recipients may have no user account, unsubscribe adds
an email-level suppression, and delivery-time eligibility is re-checked per
recipient. A `marketing_opt_in` field on the registration record and its
consent checkbox in the registration form gate all of it.

**5. Learner lifecycle emails.** Completing a course sends one congratulations
email; a new `send_progress_reminders` cron command emails learners who
stalled mid-course (progress started but idle for N days, throttled to one
reminder per learner per 14 days, row-claimed so overlapping runs never
double-send).

**6. Email delivery failures stop being silent.** The brief-email job now
re-queues with backoff on delivery failure instead of completing as
"skipped", and `python manage.py challenge_email_selftest --to you@example.com`
validates the whole delivery path (configuration checks, then a real
challenge-shaped test email) printing only safe error codes — run it on the
server before assuming a participant "did not get the email". Reminder: the
challenge brief email is delivered by the `process_challenges` cron, and
bulk campaigns need `marketing_sending_enabled` in Platform Settings.

## Migrations

- `challenges.0003` registration marketing opt-in; `challenges.0004` access code hash.
- `marketing.0003` guest-capable recipients (nullable user, per-email uniqueness), challenge segment targeting, exclusion flag.
- `enrollment.0002` last progress reminder stamp.

## Verification

Twenty-one functional checks passed against an in-memory database: access-code
issue/sign-in/wrong-code; segment membership incl. opt-in, verification,
disqualification, payment-driven student transition and round/category
filters; prospect exclusion; guest campaign delivery and guest unsubscribe
suppression; disqualification endpoint, email and access kill; hard delete
including cascade; congratulations email on completion; reminder delivery and
14-day throttle; and a clean `challenge_email_selftest`.
