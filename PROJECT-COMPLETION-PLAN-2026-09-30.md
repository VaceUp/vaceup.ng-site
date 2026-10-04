# Remaining work and delivery order

This is a continuation of the existing LMS, not a rebuild or a promise of zero errors. Valid 400/401/403/404/409 responses must remain. The acceptance target is: correct successful flows, useful validation, no unexpected server exceptions in tested cases, least-privilege access, and a recoverable deployment.

## Current release: implemented; final packaging and CI recorded in the worklog

- Full course controls in Content, with category creation in a modal, public syllabus/outcomes/requirements/benefits and existing lesson/video editing.
- Original ten-programme catalogue import as drafts, with opt-in blank-details recovery and no overwrite of existing pricing or authored content.
- Protected user-deletion previews, atomic deletion, reauthentication and explicit schema-failure instructions. Missing live tables still require migrations.
- Announcement publishing without the missing Celery module; scheduled, audience-scoped database email delivery with recipient deduplication and revalidation. Push is explicitly unavailable, not falsely reported as sent.
- Malformed administrator IDs rejected before database lookup; targeted regression tests for incorrect/missing inputs and missing records.
- Fix grading to use the actual assignment ID rather than a title that can be duplicated. Protect admin self-deactivation and audit logging from untrusted IP header data.
- Repair staff invitations, tutor profile creation, password setup requests, account activation/deactivation/promotion and password changes. Revoke old refresh tokens on disable/password changes; reject malformed IDs and invalid bulk prices; roll back mutations if their audit write fails. Completed announcement deliveries are not replayed for later enrollments.

## Priority 0: complete this deployment before expanding usage

1. Match the backend source, migration graph and actual MySQL schema. Use the changed-files ZIP, read-only diagnostic and migration plan. Do not fake missing tables or overwrite .env.
2. Pass both SQLite and MySQL CI tests and the frontend production build. Deploy the matching frontend only after backend migration/restart. A pushed feature branch is not proof of a production Cloudflare deployment.
3. Recheck real sign-in, new verification, fresh password reset, course publish/import, student paid access, explicit off-platform activation and a disposable-account deletion. No real deletion/payment/email tests are run automatically against production.
4. Verify the cron environment and mail queue, including persisted TLS/local-relay settings. Test inbox arrival separately from SMTP acceptance.
5. Restore a backup in a separate environment and rehearse rollback. Establish who responds to failed payments, overdue mail and API errors.

## Priority 1: remaining admin-first teaching workflows

6. Complete the quiz question/choice builder, learner attempt screens, manual short-answer grading and durable grading audit. Current quiz creation still directs admins elsewhere to add questions. Duplicate-title grading is fixed in this patch; the complete assessment workflow is not.
7. Give assigned tutors an ownership-scoped content editor and submission review screens, not unrestricted admin access. Verify every action against other tutors' courses and suspended learners.
8. Unify or deliberately separate legacy SystemAnnouncement and course-targeted Announcement administration with a clear frontend audience/schedule/delivery view. Do not silently migrate or send existing announcements. Add newsletter consent and campaign delivery acceptance tests.
9. Verify upload size/type validation, private assignment downloads, R2 completion/cleanup and signed playback across roles. Signing a URL alone does not validate an uploaded object.
10. Finish live-class attendance/moderation/recording workflows against the selected provider. Current external-meeting links are different from a fully managed embedded classroom; the LiveKit room manager still has placeholder operations.

## Priority 2: security, operations and capacity evidence

11. Complete administrator MFA/recovery, browser token/XSS/CSP review, proxy trust configuration, dependency audit and security alerting. Existing role checks, database rate limiting and deletion reauthentication are useful controls, not a guarantee against attackers.
12. Add queue-age/cron and dependency-aware monitoring. Verify production email limits and storage/payment failure recovery.
13. Repair and run a realistic load model on staging. Define whether 1,000 users/minute means arrivals, active sessions or API requests. Record latency, error rate, database connections/locks and queue age. TrueHost shared-hosting capacity is not proven.
14. Only then choose and measure any process, cache, hosting or load-balancing changes. Redis is not required for the database-queue path; disabling Redis is not a capacity test.

## Later or separate infrastructure

15. Isolated code execution with language/runtime quotas and provider failure handling; never execute learner code in the Django web process.
16. Membership-scoped collaborative whiteboard/editor with persistence, reconnect and multi-user tests before re-enabling closed endpoints.
17. Browser/mobile push requires a chosen, configured provider and consent/subscription lifecycle. This patch does not create such infrastructure.

## Definition of done

Evidence must cover guest, learner, tutor and administrator using the real staging API/MySQL; mobile and keyboard; permission failures; retries and concurrent submissions; expired links; missing/deleted records; provider outages; backups and target workload. Local automated tests and intercepted browser previews are evidence for their own scope only. See STABILIZATION-WORKLOG.md for actual results and deployment state.
