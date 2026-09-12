# Student and tutor workspace release

Date: 12 September 2026. Base release: `8ac1f69`.

## What is included

- Account-scoped student and tutor overview pages; no fallback demo statistics.
- Searchable, paginated course lists with progress and missing-image fallbacks.
- A course lesson viewer with authenticated video-access requests and stored lesson completion. Tutors review content without marking student progress.
- Tutor-only enrollment roster, including progress and status.
- Live-class listing and external meeting access. Tutors can schedule external Meet/Zoom sessions for their own courses and inspect recorded joins. Students cannot schedule.
- Student payment history, certificate listing and authenticated certificate PDF downloads.
- Account details, password-reset link, and persistent light/dark workspace appearance.
- Mobile menu, keyboard focus handling, active navigation, and redirects from old settings/live-class/certificate pages.
- Visible-page refresh every 60 seconds, focus/online refresh, manual retry, bounded fetch waiting and stale-data warnings. This is polling, not WebSocket real-time delivery.
- Single-flight token refresh. A temporary API outage no longer deletes the saved session during restoration.
- Private, non-cacheable responses from the new dashboard endpoints.

The existing admin panel and the unfinished admin, messaging and email backend patches are deliberately excluded. The design-code and UI/UX skills guided shared semantic tokens, consistent controls, role-specific actions, and explicit error/empty states.

## cPanel backend upload

The companion `vaceup-workspace-backend-20260912.zip` contains only:

```text
apps/dashboard/member_views.py
apps/dashboard/urls.py
apps/dashboard/test_workspace.py
README.md
```

1. Download a backup of the existing `/home/coqrpund/vaceup_api/apps/dashboard/urls.py` before replacing it. If `member_views.py` or `test_workspace.py` already exist on the server, back those up too.
2. Upload the ZIP to `/home/coqrpund/vaceup_api/` in cPanel File Manager and extract it there. The final path must be `/home/coqrpund/vaceup_api/apps/dashboard/member_views.py`, not a nested `backend/apps/` path. Review the extraction paths before confirming replacement.
3. Leave `.env`, `config/settings.py`, the database, uploaded media and all other applications unchanged. This package contains no credentials, model changes or migrations. It does not require a dependency update.
4. In the activated application terminal, run:

```bash
cd /home/coqrpund/vaceup_api
python manage.py check
```

5. Restart the VaceUp Python application in cPanel.
6. The GitHub push deploys the frontend through your existing Cloudflare integration. GitHub does not deploy this backend ZIP. Until the backend files are installed, the new `/api/v1/dashboard/` requests can return 404.

New API routes:

```text
GET /api/v1/dashboard/overview/
GET /api/v1/dashboard/courses/
GET /api/v1/dashboard/courses/<id>/
GET /api/v1/dashboard/payments/
```

Existing instructor, enrollment, live-class and certificate endpoints remain in use.

## Redis is still a live blocker

This release does not bypass rate limiting or repair the refused Truehost-to-Upstash TCP connection. Authentication, course APIs, dashboard requests and queued email can remain unavailable until that connection is restored. `manage.py check` alone does not test Redis.

After Truehost/Upstash connectivity is restored, run the read-only check:

```bash
python manage.py shell -c "from django.core.cache import cache; cache.get('vaceup-connectivity-check'); print('Redis connection OK')"
```

Restart Celery separately after connectivity is restored. Verify email delivery with a real requested verification email; an accessible dashboard does not prove mail delivery.

## Live acceptance checks

- Sign in as a student with a real enrollment. Compare course progress against Django records and complete one lesson. Reload to confirm it persists.
- Confirm that another student's course and payment records cannot be retrieved. A suspended enrollment may be listed but must not unlock lessons or classes.
- Sign in as a tutor. Confirm only that tutor's assigned courses and their enrollments appear.
- Schedule a test external meeting on that tutor's course. Confirm the enrolled student sees it, has no scheduling control, and can join during the configured time window. Recorded joins are not attendance duration.
- Download an existing issued certificate. This release does not repair certificate issuance or public verification logic.
- Navigate between pages without refreshing, then check the mobile menu and theme persistence.
- Check an actual R2 video with a configured signed-playback endpoint. Browser fixture tests do not establish that the production R2 bucket, CORS or media encodings are configured correctly.

## Preview

The preview helper serves the actual static frontend build on loopback only and intercepts API requests with sample fixtures. Its yellow banner identifies it as test data. It does not create real users, payments, attendance or messages. Preview helpers are outside `src` and are not imported by the production application.

After `npm run build` in `frontend`:

```bash
node scripts/preview-workspace.cjs
```

Open `http://127.0.0.1:4173/__preview?role=student` or `http://127.0.0.1:4173/__preview?role=instructor`. Keep the local process running while viewing. This is not a publicly hosted preview URL.

## Verification and limits

- Isolated release frontend: static production build succeeded; 57 static pages generated.
- Isolated backend: 36 tests passed across dashboard, enrollment and live classes, including the new private-cache response check. Local runtime: Python 3.13 / Django 5.2 / SQLite. The production Python/MySQL combination was not exercised remotely.
- Browser workflows: 15/15 passed against the actual static build with local fixtures; no browser runtime exceptions during the run.
- Token refresh tests: 4/4 passed. Modern-color contrast-gate regression tests: 2/2 passed, including rejection of an intentionally low-contrast nested button label.
- Shared workspace UI hardcode lint: six files scanned, no hardcoded values found. Theme-reference validation passed against the rendered theme.
- State-aware contrast checks passed for the captured student overview and dark account page. Responsive checks passed at 280, 320 and 414 pixels on the tested snapshots. Screenshots were inspected after interactions; these are scoped checks, not a complete WCAG audit.
- Repository-wide `node scripts/accuracy_report.mjs`: initial run reported `RESULT: 0/37 checks passed`. The kit targets missing `examples/` harnesses and unavailable `python3`/browser resolution in its default environment. This release does not claim the repository-wide gate passes. The state checker was corrected to handle modern CSS colors, nested text labels and missing files; scoped checks used the installed browser.
- Full-project TypeScript checking still reports existing errors in legacy pages, Cloudflare functions and shared components. No new workspace-file type errors were reported. The existing Next.js configuration skips type checking during builds; build success is not a clean type-check claim.
- No 1,000-users-per-minute production load test was run.

Still separate work: classmates messaging integration/moderation, the standalone code editor and language execution, assignments/grading, embedded LiveKit conferencing/recordings, tutor course authoring, editable account profile, certificate issuance/verification repairs, and email infrastructure. Existing tool links do not mean those systems have been rebuilt in this release.

## Rollback

Use Cloudflare's previous successful frontend deployment if necessary. The additive backend routes can remain installed with the old frontend. To remove this backend patch, first restore the backed-up dashboard URL file and any backed-up dashboard files, then restart the Python app. Do not restore an old `.env` or database as part of this rollback.
