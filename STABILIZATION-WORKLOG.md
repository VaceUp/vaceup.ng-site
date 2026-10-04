# Production stabilization worklog

## Latest checkpoint: 4 October 2026

The implementation below is a tested release batch, not a whole-project completion or zero-error/security guarantee. Do not restart the work or rewrite the architecture. Install and verify the matching backend before promoting the frontend.

- Latest tested backend: `artifacts/stabilization/candidate-umd1t90z/backend`, isolated and secret-free. Full SQLite run: 305 tests, 302 passed, 3 MySQL-only tests skipped; exit 0. No migration drift. All 14 declared route checks passed. Both MySQL and SQLite CI passed for final code commit `e8a8d90`: https://github.com/VaceUp/vaceup.ng-site/actions/runs/37166360831 . The final concurrency test exercises ten distinct new buckets with five simultaneous requests each. These are correctness tests, not a 1,000-users/minute load benchmark.
- Read-only strict deployment diagnostic verified against a disposable SQLite database: fails before migrations, passes afterward with no missing tables/columns/pending migrations and all 5 diagnostic routes matching. This does not prove the live MySQL schema is correct.
- Added/fixed: full course controls in Content; inline category creation; all 10 original programmes and optional empty-metadata recovery; public outline/outcomes/requirements/benefits; protected deletion with clear schema errors; durable audience-scoped announcement email with deduplication, scheduling, account-mail priority and no replay of completed sends.
- Additional account bugs found by tests and fixed: non-existent User.updated_at writes, incorrect tutor profile fields, missing staff-invite action/serializer, unsafe token deletion instead of blacklisting, duplicate-title grading lookup, malformed numeric IDs and bulk-price bounds. Staff mutations/password changes and audit records are atomic. Staff invitations request password setup through the existing mail queue. Admin self-deactivation is blocked.
- Final frontend Next.js 15.5.24 production build passed with 58 static pages, type checks and lint (existing warnings remain). Browser harness passed six captured course/category/import/public states, mobile widths 280/320/414, scoped axe checks, category keyboard focus/return, retained data after API errors, successful retry, and deletion schema-error/protected retry. All requests intercepted with synthetic data; no live users touched. Failed course images use an uncropped logo fallback.
- State contrast checks previously passed for the changed course controls in light/dark preferences; responsive check passed 6 files. Compiled-theme reference validation passed (288 definitions); scanning globals.css alone cannot resolve imported Tailwind defaults. No-emoji scan passed 10 selected changed files.
- Root design-kit accuracy gate was run: 1/37 passed. Missing kit examples, unavailable python3 alias and Windows path assumptions block that overall gate. Do not claim a full repository-wide design audit passed. Product-specific checks above have their own scope. Admin intentionally retains the established light branding under dark preference.
- Deliver changed runtime files plus known missing dependencies only. Exclude config, .env, database, media and virtualenv. No configuration change is required for this patch. Install guide: COURSE-CONTROL-DEPLOYMENT-2026-09-29.md. Remaining work: PROJECT-COMPLETION-PLAN-2026-09-30.md.
- FINAL ZIP: `artifacts/stabilization/vaceup-course-controls-patch-2026-10-04-v2.zip`, 32 backend runtime/dependency files plus diagnostic, guide and checksum manifest (35 entries). SHA256 `cdc9d8f3841a45cd68c4f09db4dd4d0f42a8f90e48af45abb4d9d5c08c7ce414`. Every runtime file is byte-matched to the tested candidate. No config/.env included or required edits. The earlier non-v2 local ZIP is superseded; do not deliver/install it.
- Backend commits `d38be90` and `e9bc124` pushed. Initial push was rejected because Git used Joshuaroug2083 (read-only). Switched to the already-authenticated VaceUp account after verifying write permission; push succeeded using the CLI credential helper without exposing tokens. No further user login is needed for this checkout.
- MySQL CI caught a real counter-initialization deadlock. The repair creates the unique rate-limit row before locking its counter, retries only known transient errors within a bounded limit, and never bypasses throttling on database failure. Added retry/fail-closed/transaction-owner tests. The repaired CI run passed; the earlier failed run is retained as evidence, not ignored.
- Dependency audit: `uv tool run pip-audit -r backend/requirements.txt --format columns --progress-spinner off` completed with "No known vulnerabilities found" for the newly resolved requirement set. This is not an audit of the versions installed on cPanel. Both full frontend `npm audit` and production-only audit now report 0 known vulnerabilities. Next.js is pinned to 15.5.24 with patched PostCSS 8.5.26. Existing ESLint configuration 14.2.35 is retained/pinned with its glob dependency patched to 10.5.0; this avoids introducing the newer lint plugin's unresolved fast-glob chain. Static export and React 18 are retained. Only the blog/legacy course route params needed framework compatibility edits.
- Security upgrade source: https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36 and https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4 . Zero currently reported dependency advisories is not proof of no application vulnerabilities. Existing deprecation/lint warnings and the separate design-kit gate remain disclosed.
- Frontend and browser test source committed and pushed as `e8a8d906b11d777dc8586e104f55dc74299fe596` on `codex/production-stabilization`. GitHub CI passed for that code. Source work is committed; unrelated local skills, AGENTS.md, skill lockfiles and generated artifacts remain deliberately untracked. No production merge or cPanel deployment has been performed. A subsequent documentation-only commit records this handoff.
- Final product gate rerun: 72 content element-states passed default/hover/focus checks under each light/dark preference, 6 public-course element-states passed, 6 rendered files passed responsive widths 280/320/414, 10 selected changed files passed no-emoji scan and all changed CSS variable references resolved against the compiled theme. The root kit's 1/37 result above is still not a passing whole-repository gate.
- Handoff: deliver only the v2 ZIP above, the installation guide and remaining-work plan. Preview image: `artifacts/stabilization/course-controls-preview/content.png`; public page preview: `artifacts/stabilization/course-controls-preview/public-course.png`. Synthetic data only. Preserve cPanel .env/config/database/media, check the migration plan and strict diagnostic, migrate and restart the correct app, then promote the matching frontend branch. The local 4187 preview server is no longer needed for these image previews.

## Earlier in-progress notes: 27 September 2026 (superseded by checkpoint above)

- Focused scope only: full course control in Content; inline category creation; restore the ten original landing-page programmes; editable public syllabus/outcomes/requirements/benefits; actionable fail-closed deletion errors. No change to paid-access rules or deployment architecture.
- Original source is frontend/src/components/landing/CourseGrid.tsx: six professional courses and four kids courses. Backend original_catalog.json preserves the source copy and prices. Missing courses become drafts; existing records are matched by slug/title (including Virtual Assistant alias). Optional explicit blank-detail backfill never overwrites authored details, prices, tutors, categories or publication. It does not create lessons/progress.
- Added six optional Course fields with new courses.0005 migration. Existing migrations were not edited. Admin/public serializers expose those metadata fields; paid lesson bodies remain gated.
- Content reuses CourseForm and the existing curriculum editor. Inline category dialog uses NativeDialog with focus return, busy/error handling and selection of the newly created category. Design-code/design-component/ui-ux-pro-max skills preserve existing semantic brand tokens and shared controls.
- Deletion now stops early for protected administrator accounts and tutors who own courses. Database schema failures return explicit 503 instructions without permitting deletion; transaction rollback and reauthentication remain in force. Live tables are not repaired by this response change. Await a fresh diagnose_admin_deployment.py report: last report had missing announcements/messaging tables and payment/message columns.
- Frontend typecheck passed. Isolated backend tests and frontend production build in progress. Packaging/browser gates pending. No live deletion, migration, import, publication or deployment performed.

Branch: `codex/production-stabilization`. This release batch is packaged and pushed. The user has uploaded backend changes, but the live installation is incomplete/mixed-version; it is not a whole-project production sign-off.

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
- Repository-wide design-kit accuracy report: 1/37 checks passed. It targets missing examples and invokes an unavailable python3 command on this Windows machine; this is not a passing repository-wide design audit. Completed product-specific checks are recorded below.
- Live read-only checks: user-directory endpoint returns 401 anonymously, deletion-preview endpoint returns 404. The live server is not exposing the newer route. Server extraction path/restart must be checked after installing the package.
- No live account was deleted, no live payment was initiated, and no live email was sent by this work.

## Required next steps

1. User installs the supplied backend ZIP on cPanel, runs migrations and restarts the correct Python app. Follow STABILIZATION-DEPLOYMENT.md. Do not replace `.env` or delete the database.
2. Promote the matching frontend branch only after backend installation. No production merge has been performed by this task.
3. Confirm persistent local-relay environment and cron, verify a fresh reset email/link and deletion preview, then run provider sandbox and workload tests. Automated tests do not prove live delivery or capacity.
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
- Code commit `8d0f4ab5e7dbf14b4b13558ba8b72e1e6e2c6d0e` was pushed to GitHub. Both SQLite and MySQL jobs passed: https://github.com/VaceUp/vaceup.ng-site/actions/runs/35475288757 . No production merge or cPanel installation was performed.
- Packaging, scoped browser checks and deployment instructions are complete. Preview: `artifacts/stabilization/preview/manual-enrollment.png`; screenshots use synthetic data. The existing branding and shared form components were retained.
- Unrelated untracked skills, AGENTS.md and local artifacts were deliberately left out of the commit. Resume from the deployment steps above, not by repeating the implementation.
- User-requested smaller handoff: `artifacts/stabilization/vaceup-backend-changed-files-2026-09-20.zip`. Contains exactly the 39 added/modified backend files between baseline `9e8d7f4` and release `8d0f4ab`, with `apps/` at the archive root. Verified archive paths and source contents; no unchanged backend files, `.env` or database included. This delta assumes the preceding backend release is already installed; it cannot restore unchanged files missing from an older server. Extract into `/home/coqrpund/vaceup_api/`, migrate, run `check_release_routes`, and restart the cPanel Python app. The previous full-source ZIP is retained, not overwritten.

## Payment compatibility notice

Migration payments.0003 labels existing records pricing_version=0. Existing successful purchases and their enrollments are preserved. Unverified old orders cannot automatically unlock courses; support must reconcile charged orders against provider records and the historical approved price. Do not ask an already-debited learner to pay again. New orders use catalogue prices and immutable item snapshots.

Provider verification follows https://paystack.com/docs/payments/verify-payments/ : the transaction status, not merely a successful HTTP response, determines payment success.

## Live incident: 24 September 2026

- User reports sign-in shows "Failed to fetch" after the last manual backend update.
- Read-only live checks at approximately 16:22 UTC: frontend root returned 200; API root, `/healthz/`, GET `/api/v1/auth/login/` and GET `/api/v1/courses/` returned generic HTML 500 responses without Access-Control-Allow-Origin.
- Login OPTIONS preflight returned 200 with the correct allow-origin for both `https://vaceup.ng` and `https://www.vaceup.ng`. This is not evidence to loosen CORS. Actual API requests are failing, including the basic health endpoint; the missing CORS header on error responses is consistent with the browser's generic fetch error.
- Exact server exception is not available remotely. A route-import/file-version mismatch after the delta upload is a possibility, not a confirmed cause. Need `python manage.py check` output from the cPanel application root and, if that passes, the latest Python/Passenger stderr traceback for a failing request.
- No production mutation, real login attempt, configuration change, new code patch, commit or push was performed for this diagnosis.
- Follow-up traceback confirms `ModuleNotFoundError: No module named 'apps.core.schema'`, imported by `apps.announcements.schema` while loading the root URL configuration. Both `check` and `migrate` stop at that import. This explains the route-wide failure; the shown migration attempt did not reach its migration execution stage.
- The 39-file delta omitted `apps/core/schema.py` because it was unchanged relative to the local baseline, but the server lacks it. Prepared `artifacts/stabilization/vaceup-schema-dependency-fix-2026-09-24.zip`: exactly that one file at its correct `apps/core/` path, verified against the previously tested candidate. SHA-256: `6cfc1309cb766bb2778393c87fe21a413ed5421230a1c018d00985c4320ed9df`.
- Local Django system check with the dependency present passes. User must extract this additive repair into `/home/coqrpund/vaceup_api/`, run `check`, `migrate` and `check_release_routes`, then restart the cPanel app. No `.env` modification or database reset is needed. Live recovery is not yet verified; investigate any next traceback rather than declaring the incident resolved.
- Next uploaded terminal output repeats the identical missing `apps.core.schema` exception. `check` failed, so the chained `migrate` and route check did not run. The server file location/readability remains unverified. Provide the existing `backend/apps/core/schema.py` directly and verify `/home/coqrpund/vaceup_api/apps/core/schema.py` before retrying; do not issue another unrelated code patch.
- Subsequent paste includes the old terminal prompt and full Python traceback entered back into Bash, causing `syntax error` and `command not found` messages. These are shell-input mistakes, not evidence of new Django defects. Pause further migration attempts; ask the user to press Ctrl+C and run only the absolute-path `ls -l` check for the required file, then provide its short output. No evidence yet that the repair file reached the server's expected location.
- Latest user output confirms `apps/core/schema.py` is present/readable and `python manage.py check` now passes. Import failure is resolved in the terminal; live web recovery still requires verification after restart.
- `migrate` now fails before execution with `NodeNotFoundError`: `adminpanel.0003` depends on missing `adminpanel.0002_alter_adminactionlog_action_type`. The certificate `mysql.W003` is a separate warning, not the exception stopping this invocation. Do not fake migrations or edit the dependency to skip the missing predecessor.
- Prepared `artifacts/stabilization/vaceup-admin-migration-repair-2026-09-24.zip`, containing only the original `apps/adminpanel/migrations/0002_alter_adminactionlog_action_type.py` from the tested release. SHA-256: `2cdbbdaff296bbf476317d3fc82d1f7bc23043a732c61eee6423b96456df9a07`. No new model changes, schema migrations or settings changes were authored.
- Isolated read-only loader probe reproduced the exact missing-parent exception when excluding adminpanel.0002 from discovery; restoring it resolved the three release migration dependency graphs (adminpanel, messaging and payments). Server migration inventory is still unknown. After uploading the missing predecessor, request `python manage.py migrate --plan` before further execution to identify any remaining baseline gaps safely.

## Current handoff: remaining admin errors, 24 September 2026

- User can log in again. Deletion preview shows service unavailable, course publication shows Failed to fetch, and platform settings shows No AdminSettings matches the given query. No subsequent successful migration output has been supplied.
- Read-only live checks around 21:47 UTC: `/healthz/` returns 200 with the correct frontend allow-origin. `/api/v1/admin/settings/definitions/` returns an unauthenticated 401 with detail-view methods (GET/PUT/PATCH/DELETE), not the GET-only definitions action. Alongside the screenshot, this identifies an older/mismatched live settings route; creating a setting named definitions is not the fix. Homepage import still resolves as a course-detail route instead of the POST action.
- Course PATCH preflight returns 200 with the expected origin, method and headers. This does not establish why the real publication request fails. Do not loosen CORS or claim a specific server exception without its traceback.
- Deletion preview traverses related database tables; missing migrations/tables are a possible cause, not yet confirmed. Preserve self/admin-account and shared-record deletion safeguards. No real user was deleted and no course was published.
- Added `scripts/diagnose_admin_deployment.py`, a standalone read-only diagnostic to upload beside live manage.py. Run from `/home/coqrpund/vaceup_api/` with `python diagnose_admin_deployment.py`. It reports source hashes, exact route-action bindings, migration metadata and missing model tables/columns. It does not query learner records, apply migrations, invoke endpoints or print environment credentials.
- Local verification passed against the secret-free candidate and a fully migrated SQLite in-memory database: all five exact route bindings match, no missing migrations/tables/columns, and the SQL guard rejects INSERT/UPDATE/DELETE/DROP. An initial test exposed Django's transaction-wrapped capability probe; transaction-control statements are now allowed while row/schema mutations remain rejected. Live MySQL results still require the user's diagnostic report.
- Next: compare the report with local source and obtain the latest server exception for deletion preview/publication if needed. Prepare a dependency-complete targeted patch based on the installed versions, not another assumed-baseline delta. No business logic rewrite, frontend edit, commit or push in this diagnostic turn.

## Repair packaged: 25 September 2026

- The user's diagnostic confirms MySQL/Django 5.2.17, six missing tables (four announcements, two messaging), missing messaging.client_message_id and payments.pricing_version columns, and four pending migrations: adminpanel 0002/0003, messaging 0003, payments 0003. Migration graph has no conflicts. Login recovery does not establish schema readiness.
- Source hashes identify admin serializers and course views/serializers from commit 8ac1f69, admin views from b2b938c, and an absent platform_settings.py. Deletion and core schema/throttling files match the tested release. Settings/public definitions and homepage import resolve to the wrong actions. This is confirmed mixed-version deployment, not a frontend redesign requirement.
- Restored original admin/course code and direct dependencies in a targeted overlay. Included the original announcements migration package because its tables are absent and its migration was not listed as pending. If it is recorded as applied despite missing tables, stop for investigation; do not fake/unapply history or blindly create tables.
- Hardened check_release_routes to check exact settings/import action bindings, with 14 routes in total and three regression tests. Added migration-discovery evidence to the standalone diagnostic. No changes to product business logic, secrets, frontend or existing migration definitions.
- Verification: 55 targeted tests passed against secret-free `artifacts/stabilization/candidate-muc28py6/backend`. A separate in-memory SQLite upgrade rehearsal reproduced six missing tables/two missing columns, applied the five original pending/restored migrations, and verified existing course price/draft, successful payment and message preservation. Settings, protected deletion preview and publish PATCH returned 200 against synthetic records. This is not a new live MySQL verification.
- Packaged `artifacts/stabilization/vaceup-admin-deployment-repair-2026-09-24.zip`: 19 entries (16 backend files, standalone diagnostic, deployment guide and hash manifest). All backend entries byte-match the tested candidate; archive integrity and contents verified. SHA-256: `07feb2068b70b03d19f16093700ed80a4e5f67f4a331869530e1bf80240bdf4c`. Filename follows the incident date. The builder refuses to overwrite delivered archives.
- User handoff: back up database and replaced files, extract into `/home/coqrpund/vaceup_api/`, run `check`, then send `migrate --plan`. Expect announcements 0001 plus the four known pending migrations. After confirming the plan, migrate, run check_release_routes and diagnostic, restart cPanel app, and retest screens. Instructions: `ADMIN-DEPLOYMENT-REPAIR-2026-09-24.md`.
- Still unverified: actual live publication exception and successful live migration/restart. If publication still fails after repair, get the timestamped Python stderr traceback and browser Network status. No live deletion, publication, migration, email, Git commit or push was performed this turn.
