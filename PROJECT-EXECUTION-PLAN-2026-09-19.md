# VaceUp: remaining work and execution priorities

Audit date: 19 September 2026. Repository baseline: `9e8d7f48be7f312b601ad888aadffce878ca1bee`, on `master` and `origin/master` at inspection.

## Executive conclusion

The LMS has a substantial working foundation, but it is not ready to be described as a complete, production-verified platform. The main problem is a combination of security defects, unfinished frontend/backend integration, old demonstration screens, failed release jobs and unverified hosting operations. Adding more screens before fixing those problems would not resolve the launch risk.

The first work should be payment security and access control. Offline checks reproduced paid-course enrollment without payment and access to other classrooms' data. Those findings take priority over appearance, additional dashboards or native video features.

This audit reviewed the frontend routes, backend feature modules, relevant tests, infrastructure settings, release documents and current GitHub Actions results. Targeted probes used synthetic users and an in-memory database in a secret-free backend snapshot. No live payment, email, deletion, load test or server change was performed. This is not a claim that every line or every possible vulnerability has been examined.

The exact backend ZIP currently installed in cPanel and the version served by Cloudflare were not independently verified. Repository findings apply to the audited code; compare deployed versions before assuming a specific defect is present or absent on the live site.

## Findings that change the execution order

### 1. Paid-course price manipulation: reproduced locally

The cart serializers accept `price_override` from the logged-in customer. Checkout uses that value as the effective price. In an isolated check, a course priced at NGN 5,000 was added with a zero override and checkout created an active enrollment without invoking a payment provider.

Sources: [cart serializers](C:/Users/User/Downloads/vaceup/backend/apps/cart/serializers.py:22), [checkout pricing](C:/Users/User/Downloads/vaceup/backend/apps/payments/services.py:83).

Required fix: prices and authorized discounts must be calculated server-side. Student requests must not create or edit price overrides. Review existing overrides and suspicious orders through an authorized, read-only production audit before deciding how to correct any affected records. Do not automatically delete historical records.

### 2. Classroom and announcement privacy failures: reproduced locally

An unrelated student could read a tutor-created whiteboard, add a stroke to it and read another session's saved code history. The HTTP endpoints require authentication but do not restrict objects to classroom members. Disabling WebSockets does not protect these HTTP endpoints.

The committed announcement API also allowed an unrelated student to retrieve both an unpublished draft and an announcement targeted to another course. Published/time/audience filtering must be enforced on every retrieval, not entrusted to a frontend query parameter. The instructor branch also includes admin-targeted announcements.

Sources: [code-editor endpoints](C:/Users/User/Downloads/vaceup/backend/apps/codeeditor/views.py:29), [whiteboard endpoints](C:/Users/User/Downloads/vaceup/backend/apps/whiteboard/views.py:28), announcement `get_queryset` in the committed version of [announcement views](C:/Users/User/Downloads/vaceup/backend/apps/announcements/views.py).

Required fix: disable unfinished classroom endpoints or implement course/room membership and host permissions for every read and write. Enforce announcement audience, publication, schedule and expiry on the server. Test student, unrelated student, suspended student, assigned tutor, unrelated tutor and administrator separately.

### 3. A successful push did not produce a successful deployment

For the audited commit, the [Cloudflare workflow](https://github.com/VaceUp/vaceup.ng-site/actions/runs/35397574299) built the frontend successfully, but:

- Pages deployment failed during setup: `Unable to resolve action cloudflare/pages-action, not found`.
- Worker deployment failed: `No access to the specified service` for the configured proxy worker.

These observations do not prove that a separately configured Cloudflare Git integration failed too. They do mean this GitHub workflow cannot be used as proof that the latest frontend reached production.

The [backend workflow](https://github.com/VaceUp/vaceup.ng-site/actions/runs/35397574279) passed its SQLite job but failed its MySQL job: 242 tests ran, with one failure and two errors. The failing assessment tests contain hard-coded choice IDs and use an assignment ID as a submission ID. These are evident test-fixture defects; they are not, by themselves, proof that every equivalent production operation fails. Repair the tests and rerun the actual production-database suite.

Fresh frontend type checking also failed. The build currently ignores TypeScript errors and the workflow ignores lint failures. A successful static build therefore does not prove the application contracts are correct.

Sources: [frontend build settings](C:/Users/User/Downloads/vaceup/frontend/next.config.js:12), [deployment workflow](C:/Users/User/Downloads/vaceup/.github/workflows/deploy-cloudflare.yml), [assessment tests](C:/Users/User/Downloads/vaceup/backend/apps/assignments/tests.py:105).

## What already exists and should be retained

| Area | Present in the audited code | Remaining distinction |
| --- | --- | --- |
| Accounts | Registration, verification tokens, login, refresh-token rotation, reset APIs, database email outbox, local SMTP relay backend | Reset confirmation screen is absent; persistent live email/cron configuration remains unproven |
| Catalogue administration | Courses, categories, drafts, tutor assignment, pricing, modules, lessons, homepage-course import | Verify the deployed frontend and imported content; tutor authoring is still missing from the member workspace |
| Student workspace | Backend-backed overview, enrolled courses, lesson reading/playback, progress, payments, certificates and live-class listings | These newer pages are not merely a demo; surrounding older pages and missing assessment workflows still need work |
| Tutor workspace | Assigned courses, scoped student roster, external-meeting scheduling and recorded joins | Course/curriculum authoring, assessment management and complete class lifecycle controls are incomplete |
| Payments | Paystack initialization, signature verification, server-side verification, stored order lines and repeated-confirmation protections | Cart price override, frontend contracts and untracked-payment fallback undermine the complete journey |
| Media | Lesson R2 presigned upload, lesson key binding and authorized signed playback | Live bucket configuration, upload validation and playback recovery need verification/hardening |
| Certificates | Issue, revoke, verify and private PDF download paths | Validate a real eligible learner end to end; define eligibility and any correction/reissue process |
| Marketing | Frontend campaign management, audience confirmation, queue processing, reporting and unsubscribe handling | Separate marketing cron must run; newsletter capture is still browser-local, not a shared leads database |
| Admin controls | Protected permanent deletion, action logging, typed platform settings, admin guide | Deletion intentionally blocks protected accounts/records; it is not unrestricted erasure of all storage and backups |
| Redis-free operation | Database-backed infrastructure mode and bounded mail/marketing workers | Requires reliable cron, adequate database capacity and monitoring; it does not prove the traffic target |

Existing production-gap documents are historical and disagree with current code. This plan should be the starting backlog; older documents should be reconciled, not used to rebuild things already implemented.

## Priority-ordered execution backlog

Order within each phase is intentional. Every item needs its acceptance checks completed before it is called finished.

### Phase 0: security, money and release blockers

| Order | Work | Acceptance criteria |
| --- | --- | --- |
| 0 | Establish a safe release baseline | Identify the deployed backend/frontend revisions; preserve `.env`, database and uploaded files; demonstrate a usable rollback. Keep unfinished local code out of release ZIPs. |
| 1 | Remove customer-controlled pricing | Student cart creation/update cannot alter price. Paid courses cannot become free through cart input. Validate existing overrides; test zero, negative, reduced and stale prices, mixed carts and repeated checkout. |
| 2 | Close cross-user access and draft leaks | Classroom HTTP endpoints are disabled or membership-scoped; unrelated users receive denial. Draft, expired, future and wrong-audience announcements are inaccessible on list/detail/comment/read routes. Cover these cases with regression tests. |
| 3 | Repair release and verification gates | Resolve Pages action failure and Worker account/service permissions, or select and verify the single intended deployment path. Repair MySQL fixtures; require passing MySQL tests, type checking and lint. Confirm served revision after deployment. |
| 4 | Finish account recovery and persistent email delivery | Build `/reset-password`; handle valid, expired, reused and invalid tokens. Align cPanel web, CLI and cron environments. Prove fresh registration and forgotten-password messages leave the queue and arrive; prove reset and login work after a new terminal session/server restart. |
| 5 | Repair the complete purchase-to-enrollment journey | Align frontend payloads, HTTP methods, response shapes and cart routes with the backend. Remove payment fallback that starts a charge without a backend order/reference. Verify success, failure, cancellation, callback loss and duplicate webhook behavior in gateway test mode, followed by an explicitly approved live smoke test. |

Phase 0 details:

- **Account recovery:** email code generates `/reset-password?token=...`, but no matching frontend route exists. The forgot-password form also reports the sent state after request failures. Keep neutral wording for unknown accounts without hiding network/server failures. See [email link](C:/Users/User/Downloads/vaceup/backend/apps/accounts/emails.py:119) and [forgot-password form](C:/Users/User/Downloads/vaceup/frontend/src/app/forgot-password/page.tsx:22).
- **Email operations:** the last user-supplied live output showed three pending jobs and effective TLS enabled, despite the intended local relay settings. A direct test email arriving proves the relay can send; it does not prove queued password resets are processing. Configure the account-mail cron and, separately, marketing cron; monitor failures and oldest pending age. Do not depend on temporary shell exports.
- **Payment contracts:** checkout sends `course_id` while the backend initialization serializer expects `course`. The client verifies with a GET reference URL while the backend exposes POST verification with a reference body. Legacy cart UI uses unauthenticated raw fetch, item routes that do not match the router, quantity fields absent from the current model, and a coupon endpoint not present in the inspected backend. See [checkout](C:/Users/User/Downloads/vaceup/frontend/src/app/checkout/page.tsx:91), [API client](C:/Users/User/Downloads/vaceup/frontend/src/lib/api.ts:229), [payment serializers](C:/Users/User/Downloads/vaceup/backend/apps/payments/serializers.py:34), [cart page](C:/Users/User/Downloads/vaceup/frontend/src/app/cart/page.tsx:38).
- **Payment messages:** the callback screen says payment is confirmed even after verification fails, and promises an email receipt without a demonstrated receipt-delivery implementation. Use truthful pending/error states. See [payment result page](C:/Users/User/Downloads/vaceup/frontend/src/app/payment/success/page.tsx).
- **Admissions policy:** approving an application currently grants enrollment regardless of course price. Decide explicitly whether this represents complimentary/offline-paid access or admission pending payment. Do not let an administrator approve an application assuming it merely permits checkout. See [application review](C:/Users/User/Downloads/vaceup/backend/apps/applications/services.py:23).

### Phase 1: complete the core LMS experience

| Order | Work | Acceptance criteria |
| --- | --- | --- |
| 6 | Finish the actual course catalogue rollout | Import original courses with a real active tutor, review images/prices/categories, keep incomplete courses in draft, then publish deliberately. New courses and edits appear on public pages without a rebuild; drafts remain admin/tutor-only. |
| 7 | Complete the student journey | From enrollment, a learner can resume lessons, access approved materials, submit work, take quizzes, view feedback, track applications, join classes and download eligible certificates. Replace sample application data; ensure all navigation targets resolve. |
| 8 | Complete tutor authoring and teaching tools | Tutors manage only assigned courses, modules, lessons, uploads, assignments and quizzes. They can review submissions and give feedback without using Django admin or needing platform-admin privileges. |
| 9 | Complete assessment and grading | Add a usable question/choice builder, learner attempt screens, deadline handling, submissions and gradebook. Implement short-answer manual marking; match assignments by IDs, not duplicate-prone titles. Test on MySQL with real object IDs. |
| 10 | Finish classmate messaging safely | Add course-scoped contact discovery rather than asking for user IDs. Implement the agreed classmate policy, blocking/reporting, limits and idempotent send. Add stable thread pagination, visible delivery errors and reconnect behavior. Prevent suspended/nonmembers from starting restricted contact. |
| 11 | Unify announcements and notifications | Choose one authoritative announcement system. Publish once and show the right content to the right users. Implement durable notification/email jobs, explicit read actions and unread counters. Replace the static notification screen and mock announcement list. |
| 12 | Complete the external live-class workflow | Tutor/admin schedules, edits and cancels; students only join eligible sessions. Test reminders, timezone display, early/late joins, canceled classes and permissions. Clearly distinguish a recorded join from verified attendance duration. Provide authorized recording playback when a real recording is attached. |
| 13 | Verify and harden video/file delivery | Test upload and signed playback against the real private R2 bucket. Verify object existence, type and size before binding; handle interrupted uploads, expiry and orphan cleanup. Verify private assignment downloads and image fallbacks across roles. |
| 14 | Make campaigns operational | Verify campaign test, audience confirmation, scheduled delivery, pause, retry, suppression and unsubscribe against the separate marketing worker. Keep transactional messages from being starved by marketing volume. Add real server-side newsletter subscription/consent before claiming public signups reach the admin. |
| 15 | Run complete role-based acceptance testing | Use the real staging API and production-like MySQL, not only mocked browser responses. Cover guest, learner, tutor and admin across auth, course purchase/access, assessment, messaging, classes and certificates. Include refresh/deep-link, mobile, keyboard, error and expiry cases. |

Supporting findings:

- The tutor courses route renders `MemberCourses`, a browsing surface, while the administrative role receives `CourseManager`: [course route](C:/Users/User/Downloads/vaceup/frontend/src/app/dashboard/courses/page.tsx:8).
- There are no dedicated learner assignment/quiz routes in the current app route inventory. The admin assessment tab creates basic quizzes but tells users to add questions elsewhere. Its grading logic matches an assignment by title: [assessment admin](C:/Users/User/Downloads/vaceup/frontend/src/components/Dashboard/admin/AssignmentsTab.tsx:123).
- Short-answer quizzes are deliberately left ungraded because manual marking is not implemented: [grading service](C:/Users/User/Downloads/vaceup/backend/apps/assignments/services.py:227).
- The committed messaging service disallows student-to-student contact. Its tutor/student relationship check does not restrict enrollment status. Conversation summaries load the user's full message history; thread pagination is not fully consumed by the UI, so longer conversations can omit recent messages. See [messaging API](C:/Users/User/Downloads/vaceup/backend/apps/messaging/views.py:44), [chat client](C:/Users/User/Downloads/vaceup/frontend/src/lib/api.ts:292) and [chat polling](C:/Users/User/Downloads/vaceup/frontend/src/app/messaging/page.tsx:95).
- The notification endpoint uses `MessageSerializer`. The local probe returned HTTP 200, not 500, but omitted notification title/type and marked the notification read merely by listing it. The frontend notification page never fetches anything: [notification API](C:/Users/User/Downloads/vaceup/backend/apps/messaging/views.py:99), [notification page](C:/Users/User/Downloads/vaceup/frontend/src/app/notification/page.tsx:6).
- Admin announcements use `adminpanel.SystemAnnouncement`; the other announcement API uses a separate `Announcement` model. The latter imports a nonexistent announcement task module for publish/send actions, while the service delivery functions are placeholders. These are not a complete delivery pipeline: [admin implementation](C:/Users/User/Downloads/vaceup/backend/apps/adminpanel/views.py:93), [announcement delivery](C:/Users/User/Downloads/vaceup/backend/apps/announcements/services.py:66).
- `/applications` and `/announcements` still populate hard-coded example records: [applications page](C:/Users/User/Downloads/vaceup/frontend/src/app/applications/page.tsx:83), [announcements page](C:/Users/User/Downloads/vaceup/frontend/src/app/announcements/page.tsx:77).
- Member live classes currently support external meeting URLs, not an embedded LiveKit classroom: [live classes UI](C:/Users/User/Downloads/vaceup/frontend/src/components/Dashboard/MemberLiveClasses.tsx:45).

### Phase 2: prove operation, resilience and capacity before wider launch

These checks are launch gates, not optional work to defer until after advertising capacity.

| Order | Work | Acceptance criteria |
| --- | --- | --- |
| 16 | Monitoring and recovery | Add dependency-aware readiness in addition to process liveness; alert on API failures, cron failure, queue age and storage failures without logging secrets. Perform an actual backup restoration and rollback rehearsal. Document who handles payment/email incidents. |
| 17 | Correct the workload test and measure the hosting limit | Replace broken/recursive Locust tasks and old routes; model real authenticated sessions. Run a controlled test on staging or an explicitly authorized environment with realistic MySQL data. Record latency percentiles, errors, DB connections/locks, CPU/memory and queue age. Agree pass/fail limits before the test. |
| 18 | Apply measured scaling changes | Fix unbounded queries and polling first. Confirm TrueHost process/concurrency limits. If measured limits require another hosting tier, choose it using results. Verify shared state and idempotency across processes before introducing replicas/load balancing. Retest the same workload. |
| 19 | Security and release hardening | Review administrator MFA/recovery, browser token storage and XSS/CSP defenses, upload access/content handling, dependency pinning/scanning, audit coverage and recovery after compromise. Replace previously exposed live credentials through controlled secret management; never package `.env` in a release. |

Capacity is currently unproven:

- The existing load file targets **1,000 requests per minute**, not **1,000 users per minute**. These are different requirements. Several tasks call themselves recursively; others are placeholders. See [load test](C:/Users/User/Downloads/vaceup/locustfile.py:367).
- As a workload illustration, 1,000 simultaneously open chats polling threads every four seconds and conversation lists every ten seconds generate roughly 350 requests/second before other traffic. This is arithmetic from the current polling intervals, not a measured hosting limit.
- At the documented once-per-minute account worker limit of 50, a burst of 1,000 verification emails takes at least 20 worker batches before considering SMTP latency, retries or provider limits. This is an upper-bound throughput calculation, not a delivery benchmark. See [account queue command](C:/Users/User/Downloads/vaceup/backend/apps/accounts/management/commands/process_mail_queue.py:17).
- `/healthz/` currently returns a plain `OK`; it does not establish database, email queue or storage readiness: [health endpoint](C:/Users/User/Downloads/vaceup/backend/apps/core/views.py:5).
- Core LMS operation can remain Redis-free. Database queues and sensible polling are a valid code path here, but capacity must be measured. The current shared-hosting setup is not evidence that persistent WebSocket workers, native media processing or a 1,000-users/minute target are supported.

### Phase 3: advanced features and completeness beyond the first launch

| Order | Remaining capability | Current state and completion target |
| --- | --- | --- |
| 20 | Real code editor and runner | Run currently produces canned output; language/theme selects use props unsupported by the shared select component. Implement actual execution through an isolated service, with authorization, quotas and limits; never execute student code on the Django host. Fix sync/async dispatch and provider-result parsing. |
| 21 | Whiteboard and collaborative classrooms | Canvas controls lack drawing/persistence wiring. Implement drawing, undo/redo, save/restore and scoped collaboration. Re-enable collaborative sockets only after membership, authentication, reconnect and multi-user tests pass. |
| 22 | Native LiveKit rooms, recording and breakouts | Token/metadata code exists, but room management, participant removal and recording calls include placeholders. Build the actual provider integration, recording completion callbacks, private storage and playback. Alternatively, keep the first release explicitly limited to external meetings. |
| 23 | Account self-service and preferences | Member account details are read-only, with support contact required for corrections. Add validated profile/avatar changes, email-change verification and useful notification preferences. Persist theme consistently across routes; do not confuse editor language with a site-language translation feature. |
| 24 | Public-site submissions and content management | Contact currently opens a mail client; it does not send through the backend. Newsletter signups and community reviews are browser-local. Build server-side contact/lead/review storage, consent/suppression, spam controls and moderation, or explicitly remove/label unsupported submission promises. Decide which static blog/events/resources/kids content requires an admin CMS. |
| 25 | Financial support and data lifecycle | Complete receipts and reconciliation tooling; decide and implement refunds/coupons only if offered. Define certificate corrections/reissue, archive versus deletion, file cleanup and retained-history handling. Protected account deletion is already implemented, not universally missing. |
| 26 | Consistency, accessibility and documentation | Consolidate duplicate legacy screens and API methods. Check all shipped pages in light/dark, mobile and keyboard flows, including failure states. Refresh the admin guide, API contracts, ERD/migrations, launch instructions and stale gap documents to match the accepted release. |

Sources for advanced gaps: [editor UI](C:/Users/User/Downloads/vaceup/frontend/src/app/codeeditor/page.tsx:63), [whiteboard UI](C:/Users/User/Downloads/vaceup/frontend/src/app/whiteboard/page.tsx), [LiveKit stubs](C:/Users/User/Downloads/vaceup/backend/apps/liveclasses/livekit.py:116), [account screen](C:/Users/User/Downloads/vaceup/frontend/src/components/Dashboard/MemberPages.tsx:96), [contact handoff](C:/Users/User/Downloads/vaceup/frontend/src/app/contact/page.tsx:29), [newsletter storage](C:/Users/User/Downloads/vaceup/frontend/src/components/landing/Footer.tsx:13), [review storage](C:/Users/User/Downloads/vaceup/frontend/src/lib/testimonials.ts:3), [deletion protections](C:/Users/User/Downloads/vaceup/backend/apps/adminpanel/user_deletion.py:81).

## Verification record and limits

Checks performed for this audit:

- Inspected current GitHub runs and failed-job output for the audited commit. SQLite job passed; MySQL job had one failure and two errors; frontend build passed but Pages and Worker deployment jobs failed.
- Ran `node node_modules/typescript/bin/tsc --noEmit --incremental false` in the frontend: exit code 1. Findings include Cloudflare type/dependency gaps, missing CardHeader props, invalid editor Select props, an unsupported homepage prop, and Card/Dropdown/Tooltip typing problems.
- Ran offline probes against a secret-free backend snapshot. Relevant cart, payment, classroom and notification source file hashes match the audited commit. No production `.env` or live services were used.
- Probe outcomes: zero-priced paid-course checkout granted access; unrelated student whiteboard read returned 200 and write returned 201; unrelated code-history read returned 200 with the saved code; draft and other-course announcement detail reads returned 200; notification listing returned 200 with an incomplete notification shape and changed the read flag.

The reproducer is [offline audit probe](C:/Users/User/Downloads/vaceup/artifacts/project-audit-20260919/probe.py). It depends on the existing secret-free snapshot and creates/destroys its own in-memory test database. It is evidence, not a deployment patch.

Historical verification documents record scoped browser and UI checks, not a whole-project pass. No new visual/accessibility certification, production load result, SMTP inbox proof or live provider verification is claimed by this audit.

## Unfinished local work: do not ship indiscriminately

Before this audit, the workspace already contained uncommitted announcement serializer/view edits, messaging model/service edits, schema files and a messaging contract document. In particular, new messaging models/service behavior are not yet integrated with the existing views/serializers/frontend and have no matching new migration in the inspected migration directory.

Treat that work as an unfinished change set. Complete its contracts, migrations, authorization tests and release validation before including it in a ZIP or committing it together with unrelated work. It is not evidence that classmate messaging or announcement delivery is already deployed.

## Recommended first execution batch

1. Take and verify the release/rollback baseline.
2. Fix cart pricing and add a regression test for unauthorized free enrollment.
3. Close classroom and announcement access leaks and add cross-role tests.
4. Restore trustworthy CI and the intended deployment path.
5. Finish reset-password and persistent queued email delivery.
6. Complete the purchase/enrollment flow, then move through the core student/tutor backlog above.

For an initial limited launch, unfinished editor/whiteboard/native recording features can be disabled explicitly. Security, account recovery, honest payment state, course access, essential teaching workflows and operational recovery cannot be substituted with demonstration screens or a successful build.
