# Production stabilization worklog

Branch: `codex/production-stabilization`. This is ongoing work, not a production sign-off.

## Current scope and user decisions

- Backend deployment is a manual ZIP upload to cPanel, never a GitHub backend deployment. GitHub workflows only test backend code; frontend deployment uses Cloudflare.
- The user approved the repaired pages after the scope was explained. Finish this release batch; do not expand into additional feature rewrites before handoff.
- Ordinary paid-course application approval still requires payment.
- NEW: administrators may explicitly activate an active student's published course after verifying a payment made before the platform or outside it. Record the reason/reference and actor; do not create a fake payment, inflate revenue, reset progress or override suspended access.
- Keep this file current so a new chat can resume without reading the entire conversation.

## Implemented locally

- Reject customer-supplied cart prices; ignore legacy overrides for new orders.
- Paid application approval does not grant course access. Free approval may enroll.
- Scope announcements and nested comments/read receipts by current audience and publication.
- Temporarily close unsafe collaborative classroom HTTP APIs until membership controls are complete.
- Add the missing static password-reset destination and honest email-request errors.
- Keep deletion confirmation safeguards; explain preview 404 without deleting anything.
- Fix TypeScript errors and enable build-time type checking.
- Repair cart/checkout/payment verification routes and payloads; remove client-priced payment fallback.
- Check changed quotes; preserve pending provider status; quarantine unverified pre-upgrade orders for reconciliation.
- Preserve historical payment records and existing enrollments.
- Connect messaging/notifications endpoints and UI, with active-course classmates, bounded pagination, explicit read acknowledgments, UUID retries, block/unblock and abuse reports.
- Add deployment route checks including homepage import. Live HEAD request resolves to the course-detail method set (no POST), confirming that the live import action is missing.

## Evidence recorded

- First isolated backend batch: 68 tests passed before checkout changes.
- TypeScript check passed after checkout changes.
- Full isolated backend suite before manual-grant addition: 265 tests run, 262 passed, 3 MySQL-only checks skipped.
- Latest production static export and lint completed successfully. Existing lint warnings remain.
- Repository-wide design-kit accuracy report: 1/37 checks passed. It targets missing examples and invokes an unavailable python3 command on this Windows machine; this is not a passing product design audit. Product-specific browser checks are still in progress.
- Live read-only checks: user-directory endpoint returns 401 anonymously, deletion-preview endpoint returns 404. The live server is not exposing the newer route. Server extraction path/restart must be checked after installing the package.
- No live account was deleted, no live payment was initiated, and no live email was sent by this work.

## Required next steps

1. Finish scoped browser state checks, package the tested candidate and commit/push the release branch. No production merge until the matching backend is installed.
2. Run the repaired MySQL CI suite. Local SQLite results do not prove production-database concurrency.
3. Install on cPanel, run migrations, restart web app, confirm persistent local-relay environment and cron, verify a new reset email/link and deletion preview, then run provider sandbox and workload tests. Local tests do not prove live delivery or capacity.
4. Subsequent scope: announcement delivery, remaining learner/tutor authoring and assessments, secure collaborative classrooms, upload validation and the priorities in PROJECT-EXECUTION-PLAN-2026-09-19.md. These are not declared complete in this release.

## Latest checkpoint: 20 September 2026

- Tested backend source: `artifacts/stabilization/candidate-r5ixjag3/backend` (secret-free).
- Full suite after manual enrollment addition: 272 tests run, 269 passed, 3 MySQL-only tests skipped; exit 0.
- Migration drift check: no changes detected. Release route check: all 11 declared routes passed.
- Frontend production build: exit 0, 58 static pages generated, TypeScript/lint completed with existing warnings.
- Browser checks use intercepted synthetic API responses only. Reset expiry/retry/success, checkout failure, pending payment, message send/read, notification read and off-platform enrollment retry passed. Live provider integration is not implied.
- Manual activation is implemented under Admin > Enrollments. Admin-only, verified reason/reference, actor audit, UUID retry protection; no new Payment record and no reset of existing progress/suspensions.
- Deployment steps: STABILIZATION-DEPLOYMENT.md. Do not upload frontend files to cPanel or replace `.env` with this ZIP.
- Browser rendering: six captured states (including dark messaging) passed scoped axe checks and overflow checks at 280/320/414px. State-contrast gates passed on 18 reset, 21 checkout, 32 light-message, 32 dark-message, 14 notification and 66 admin enrollment element-states. Screenshots inspected; synthetic previews are not live accounts.
- ZIP created and integrity-checked: `artifacts/stabilization/vaceup-backend-stabilization-2026-09-20.zip`, 254 entries. SHA-256: `2e4363857bb569764eefaebc46d30c26f5444452e8fff8c945feb2481c60a0e1`. Full source overlay excludes `.env`, database, media and virtualenv.
- Packaging, browser checks and deployment instructions are complete. Commit/push and MySQL CI status are the remaining handoff checks; no merge into production has been performed.

## Payment compatibility notice

Migration payments.0003 labels existing records pricing_version=0. Existing successful purchases and their enrollments are preserved. Unverified old orders cannot automatically unlock courses; support must reconcile charged orders against provider records and the historical approved price. Do not ask an already-debited learner to pay again. New orders use catalogue prices and immutable item snapshots.

Provider verification follows https://paystack.com/docs/payments/verify-payments/ : the transaction status, not merely a successful HTTP response, determines payment success.
