# Course controls and API repairs: cPanel installation

This is a changed-files overlay, not a replacement backend. It includes the known missing baseline migration/helper files as dependencies. It does not contain .env, passwords, databases, media, frontend code or a virtual environment. Keep your existing database and .env.

Final release date: 4 October 2026. Archive: `vaceup-course-controls-patch-2026-10-04-v2.zip`. The initial local archive is superseded; use v2, which includes the MySQL rate-limit concurrency repair.

## Configuration changes

None for this patch. No config directory or .env file is included, and there is no configuration text to paste. Preserve the already verified database-mail/local-relay settings and existing cron. Do not restore the old Redis connection or TLS settings as part of this upload.

## Install the backend first

1. Back up the current database and the files listed in COURSE-CONTROL-MANIFEST.json. Do not delete the current backend.
2. Extract the ZIP into `/home/coqrpund/vaceup_api/`. The ZIP's `apps` directory must merge with that application's existing `apps` directory, not a new nested backend folder. The diagnostic belongs beside manage.py.
3. Use a short maintenance window while uploading and migrating: updated course code needs its new columns before requests are served.
4. In cPanel Terminal run each command separately:

```bash
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
cd /home/coqrpund/vaceup_api
python manage.py check
python manage.py migrate --plan
python diagnose_admin_deployment.py
```

Expect `courses.0005_course_public_details`. If previous repairs have not been applied, the original adminpanel, messaging, payments and announcements migrations may also appear. If the diagnostic says announcements.0001 is applied while announcements tables are missing, STOP and send the report: migration history and actual schema disagree. Do not use --fake, delete migration history, or blindly roll back migrations.

If the plan is consistent with the diagnostic and your backup is available:

```bash
python manage.py migrate
python manage.py check_release_routes
python diagnose_admin_deployment.py --strict
```

Strict diagnosis must show no missing tables/columns, pending migrations or route mismatches. Restart the **VaceUp Python application** in cPanel. A terminal check alone does not restart its web workers. No new environment key is required for this patch.

## Frontend and catalogue

Deploy the matching frontend changes through the existing GitHub/Cloudflare path AFTER the backend checks pass. This ZIP cannot update Cloudflare. Do not upload frontend files into the Django application.

- Courses > Import homepage courses now previews ten original programmes: Virtual Assistance, Data Analysis, UI/UX Design, Graphic Design, Web Development, Artificial Intelligence, Graphic Design for Kids, UI/UX Design for Kids, Web Development for Kids and AI for Kids.
- Choose an active tutor and import. New records are drafts. Existing titles/prices/tutors/categories/publication and authored details are retained.
- To recover an empty outline on an existing course, explicitly select **Also fill blank public details on matching courses**. This only fills empty fields from the original catalogue. If an existing course is published, those details become public immediately.
- Content > select course: edit public information, requirements, outcomes, outline, cover, price, tutor and publication. Create a missing category without leaving the form. Save details before switching courses.
- Add actual teaching modules, lessons and private videos below. The public outline is not paid lesson content and does not affect learner progress.

## User deletion

Deletion remains irreversible. Review the preview and use only a disposable test account during acceptance testing. Self/staff/admin accounts, tutors owning courses, payment history and shared/retained records remain protected. Reassign a tutor's courses in Content or disable access when deletion is blocked. A missing-schema error is not permission to bypass these safeguards.

If deletion still fails after strict diagnosis and restart, send the new diagnostic plus the timestamped stderr traceback. Do not send passwords or .env. Live schema correctness has not yet been confirmed by the user.

## Announcement email repair

The course-targeted `/api/v1/announcements/` publishing flow no longer imports a nonexistent task module. The existing database mail worker queues due announcement emails in bounded batches, prioritizes account mail, deduplicates recipients, retries delivery failures and rechecks publication/current audience before sending. It also publishes scheduled announcements when due. Already-completed announcement deliveries are not replayed for later enrollments. Review any previously published announcements with email enabled but not marked sent before restarting cron: the worker will now process those pending deliveries.

The existing cron must continue to run with the verified local-relay environment. It now also processes these announcements:

```bash
python manage.py diagnose_email_delivery
python manage.py process_mail_queue --limit 50 --max-seconds 45
python manage.py mail_queue_status
```

Running the worker can send pending real messages. Run it only when ready for delivery. SMTP acceptance does not guarantee inbox arrival; test with a fresh reset request. SMTP remains at-least-once if a process dies after acceptance but before recording success. Browser push is not configured and now returns an honest explanation instead of a server error/false success. The older admin SystemAnnouncement API is separate; this patch does not silently merge those records.

## Other repaired administrator actions

Enable, disable, promote and password-change actions now save the fields the User model actually has. Disabling an account and changing its password blacklist its old refresh tokens; re-enabling cannot revive those refresh tokens. Existing access tokens remain subject to the configured expiry and active-account checks. Password changes also invalidate outstanding reset links. These changes and their audit log entry commit together or roll back together. You cannot disable your own signed-in account.

Staff invitations create the correct tutor profile and request a password-setup email through the existing mail-delivery flow. No password is invented or exposed to the administrator. Bulk price updates use real numeric course IDs, reject out-of-range prices and roll back as a unit. Assignment grading uses the submission's assignment ID, so duplicate assignment titles no longer select the wrong course assignment.

The shared database rate limiter establishes a new counter before locking it, avoiding the missing-row insert deadlock reproduced in MySQL tests. Transient lock errors have bounded retries; database failures never bypass abuse limits. A prolonged database failure returns a safe, explicit 503 rather than exposing internals or disabling security checks.

## Remaining production gates

This release is not a guarantee of zero HTTP errors or complete production readiness. Invalid inputs must return 400, unauthorized access must remain blocked, and absent/private records can return 404. Keep these checks.

Still required: live MySQL migration/role-flow checks, reset-email/cron verification, provider sandbox tests (payments/storage/live classes), backup restoration and controlled workload testing. Native push, embedded classroom moderation/recording, collaborative tools and remaining assessment/tutor workflows are not all completed by this patch. See STABILIZATION-WORKLOG.md for evidence and next work.
