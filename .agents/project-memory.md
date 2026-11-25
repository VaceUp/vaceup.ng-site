# VaceUp Project Memory

## 2026-11-25 — Public cohort calendar and registration lifecycle

**Decision**
- The public website presents the year's active cohorts. Visitors choose a course inside a cohort, register interest without an account, and choose pay now or pay later.
- Cohort registrations are tracked separately from enrollments; paid registrations are confirmed only after verified payment, while opted-in interest leads receive periodic reminders and paid learners receive one reminder for each class day.

**Changed**
- Added `CohortRegistration`, public cohort registration and admin registration endpoints, payment-to-registration synchronization, and the `send_intake_reminders` management command.
- The public-facing name is Admissions and the canonical page is `/admissions/`; `/cohorts/` and `/intakes/` remain compatibility aliases while the backend keeps its internal intake terminology.
- Rebuilt the public admissions page as a cohort-to-course registration flow with waitlist handling, a shared accessible cohort dialog, checkout intake context, branded registration/reminder emails, admin registration visibility/export, and header/footer navigation.
- Verification: backend checks, 10 intake tests on SQLite, frontend typecheck and production build completed; existing storage configuration warnings remain environment-specific.

**Open**
- Deploy migration `0013_cohortregistration` before enabling public registrations. Configure a daily cPanel cron for `python manage.py send_intake_reminders` and verify production email and Paystack callback behavior.

## 2026-11-25 — Academy intake, capacity, delivery and installment requirements implemented

**Decision**
- Course modules now explicitly choose Google Meet or VaceUp Live Room; only the selected learner-facing link is exposed to entitled learners. Live Room join links are configured per module in course content.
- 2027 academy intakes expose course-by-course capacity (30 by default), remaining places and waitlist state. A waitlist request never creates payment or enrollment; it stores the learner's name, email, phone, preferred course and intake and can be exported or reminded by an administrator.
- Installment terms are stored on courses. The seeded academy pricing is Excel NGN 30,000 full payment; Virtual Assistance and Graphic Design NGN 36,000 + NGN 24,000; Data Analysis and UI/UX NGN 42,000 + NGN 28,000; Web Development NGN 48,000 + NGN 32,000. Verified payments are the source of paid and outstanding totals.
- Capacity is enforced inside the transaction that grants enrollment, separately per course and intake. Course content and live-class access are paused after the configured final-month deadline when an installment balance remains.

**Changed**
- Backend models, serializers, services and migrations add module delivery, intake capacity/waitlist, course payment terms, intake-aware applications/enrollments/payments, installment checkout amounts, student/admin balance reporting, and public waitlist email confirmation.
- Frontend adds `/intakes`, intake selection during applications, payment-term copy and first/final installment checkout, learner payment status, admin capacity/waitlist controls, and the module delivery selector.
- Verification: `python manage.py check`, `python -m compileall -q apps`, `python manage.py makemigrations --check --dry-run`, targeted SQLite-backed Django tests (41 existing intake/course/live-class tests and 14 admin tests), `npm run typecheck`, and `npm run build` all completed successfully. The repository-wide accuracy report remains the pre-existing 5/37 objective-gate result because its sample harness directories are absent.

**Open**
- Run the new migrations in the deployed MySQL database before using the intake, installment, or Live Room fields in production.
- Configure and verify the production Paystack callback/webhook for installment number 1 and 2, and confirm the production email backend accepts waitlist confirmations/reminders.
- Browser-level rendered-pixel inspection of the new `/intakes` page and module editor remains pending; the production build and TypeScript gate are green.

Durable log of product decisions and mid-code changes. Newest first. Every agent reads this file at session start and appends a dated entry before finishing (see `.agents/skills/project-memory/SKILL.md`). Never delete entries; record reversals as new entries.

## 2026-11-20 — Mobile v1 verified: emulator runs the CI-built APK; releases automated

**Decision**
- The Android APK ships via GitHub Actions (`.github/workflows/mobile-android.yml`): every push touching `mobile/` runs npm ci, expo prebuild, gradle assembleRelease on Linux, and attaches the APK to a rolling prerelease (mobile-v1, v2, ...). Downloadable without auth — e.g. https://github.com/VaceUp/vaceup.ng-site/releases/download/mobile-v4/app-release.apk
- Local Windows builds are NOT viable for this repo and were abandoned: ninja ignores Windows long paths (no manifest flag; registry LongPathsEnabled=1 was set but does not apply to ninja) and codegen object paths exceed MAX_PATH even from `C:\m`. Always build via CI or EAS.
- The mobile release APK talks to the same production backend as the website (`expo.extra.apiBaseUrl` = https://api.vaceup.ng/api/v1).

**Changed**
- `mobile/src/app/index.tsx` — launcher route redirects into the tab flow (the "Unmatched Route" screen on launch was a missing index).
- `mobile/.gitignore` — built APKs ignored.

**Open**
- 2026-11-20/21 verification: the CI-built release APK (mobile-v7) installs and runs on the Android emulator; tapped through Home/Alerts/Profile signed-out with no crashes. Tab bar intentionally shows 3 tabs for a signed-out session (role-aware: students see Courses/Learn after sign-in, tutors see Grade/Students). The user's reported "crash on navigation from profile" did not reproduce on the emulator after the tab/session fixes — if it recurs on a real device, the root ErrorBoundary now shows the exact error text to report.
- Rendered-pixel pass over the remaining mobile screens (tabs after sign-in) still pending — needs a real learner account on the production backend or a local backend for the emulator.
- iOS builds need EAS + Apple Developer access.

## 2026-11-18 — Production 500 root cause found: foreign zip corrupted the backend folder

**Decision**
- The user extracted another application's zip into the VaceUp backend folder on the server, which is the actual cause of the persistent 500s (both apps stopped working). Recovery is a clean-slate restore, not a delta overlay — deltas cannot remove foreign files.
- Recovery artifact: `vaceup-backend-2026-11-18-full.zip` (415 files, complete source tree, live `.env` excluded, `.env.production` included as reference; sha256 8bbdfe023a8b0ef7c42570c55db0e36371127acef28371b17680dc488ea3ab11). Runbook: `RECOVERY-RUNBOOK-2026-11-18.md` (backup first, inspect `.env` for VaceUp markers, empty folder, extract full zip, restore `.env`, pip install, migrate, check, challenge_email_selftest, restart).
- Mobile build paused per user while the server is recovered; the Android Gradle build had also hit a 78-minute Maven Central download stall (react-android AAR) and needs one more retry after resume — EAS builds sidestep the local network issue entirely.

**Open**
- User to run the recovery on cPanel and report: whether the server `.env` still held VaceUp values (if not, rebuild from `.env.production` + their secrets), and whether the frontend folder was also overwritten (frontend redeploys from the GitHub pipeline).
- Android emulator verification resumes after the recovery (install APK, launch, screenshot).
- The earlier cross-device 500 diagnosis (error.tsx boundaries) stays deployed as a safety net but was not the root cause.

## 2026-11-18 — Mobile app started (React Native/Expo, Android + iOS)

**Decision**
- The mobile app is Expo (TypeScript) + expo-router in `mobile/` — one codebase for Android and iOS, EAS cloud builds for the stores, tokens in expo-secure-store, push via expo-notifications (token captured on Home; backend storage endpoint ships with the notifications milestone).
- v1 scope mirrors the web contract: auth (login/register/verify-then-sign-in), home dashboard stats, course catalog + detail + enroll, lesson screen with mark-complete and video links, notifications inbox, profile, and the challenge portal via email + access code (same guest identity as web).
- Deferred by design: in-app assessments/quizzes, messaging, Paystack checkout (paid courses open the website for now), tutor tools.
- API base URL lives in app.json `expo.extra.apiBaseUrl`; `EXPO_PUBLIC_API_URL` overrides for local development.

**Changed**
- `mobile/` — Expo SDK 58 app: lib/api.ts (JWT pair, silent refresh, same error flattening), lib/storage.ts (secure store), state/auth.ts (zustand), constants/theme.ts (navy/gold tokens), components/ui.tsx kit, screens for all routes above, __tests__/api.test.ts (8 tests), jest.config.js, README with EAS build steps.

**Open**
- Android emulator verification pending: first Gradle build failed on a 78-minute Maven Central download stall of react-android AAR; a retry is running. EAS build sidesteps this entirely if the local network keeps stalling.
- iOS builds require Apple Developer access (EAS), not runnable from this Windows machine.
- Rendered-pixel inspection of the marketing composer with segments not yet done.
- User wants to "discuss some more beautiful stuff" — pending design session.

## 2026-11-18 — Challenge lifecycle: access codes, marketing segments, admin actions, SEO

**Decision**
- Challenge portal access must NOT require an email round-trip and must NOT expire daily, but there is still no permanent portal: session tokens now live until two weeks after results publication, and every registrant gets a hashed six-digit access code (shown once on the confirmation screen and in the brief email) that reopens the portal with just email + code on any device. The browser keeps the session in localStorage.
- Registration is also an email-collection funnel: a marketing opt-in checkbox gates the new campaign segments. Challenge participants (opted-in, verified, not disqualified) and challenge-participants-who-became-students are selectable audiences by round and category in the marketing composer; a campaign flag excludes registered participants from general prospect mailings (stop/start lifecycle). Participants who pay move to the student segment automatically.
- Learner lifecycle emails: congratulations on course completion; weekly-cron progress reminders for stalled learners (14-day throttle per learner).
- Admins get a per-row Disqualify (reason required, participant is emailed, sessions killed immediately) and a hard permanent Delete (typed DELETE confirm; cascades everything and best-effort deletes storage objects; refuses when audited score corrections exist).
- Challenges and events must be searchable: /challenge/ is now indexable with real metadata, sitemap.xml + robots.txt are generated, and Event JSON-LD (dates, free offer, online attendance) is injected for the round and public events.
- The opaque "500" on other devices gets a readable error boundary (app/error.tsx + global-error.tsx) showing the real error text and a reference — ask the user for that text next time a device fails.

**Changed**
- challenges: auth.py (round-scoped sessions, access code issue/verify), views.py (AccessCodeView, AdminRegistrationActionView, access code in register/access flows), urls.py, emails.py (brief PDF link + access code + disqualification notice), jobs.py (disqualification_email kind), models + migrations 0003-0004, management/commands/challenge_email_selftest.py.
- marketing: models/serializers/services (challenge segment audiences, guest recipients with nullable user + per-email uniqueness, suppression respected, delivery-time re-check), migration 0003.
- enrollment: emails.py (congratulations + reminder), models + migration (last_progress_reminder_at), management command send_progress_reminders.
- frontend: confirmation shows the access code; access form takes the code; ChallengesManager has Disqualify/Reinstate/Delete per row; MarketingManager has challenge segments; lib/seo.tsx + app/sitemap.ts + app/robots.ts + app/error.tsx + app/global-error.tsx; JSON-LD in the challenge and events pages.

**Open**
- 2026-11-19: briefs are now correctable while a round runs (text, deliverables, email instructions, material file up to 20 MB as XLSX/CSV/ZIP/PDF); the rubric and identity stay locked. The Data Analysis dataset reaches participants via the brief email link AND the portal download (`brief_download_url`); existing registrants re-request their access email to receive updated materials. Delta zip `vaceup-backend-2026-11-19-editable-briefs.zip` delivered (no migration).
- The cross-device 500 needs the real error text from error.tsx once deployed — record it here when the user reports it.
- Ops checklist for email: process_challenges cron every minute (brief emails), process_marketing_queue cron (campaigns), send_progress_reminders cron (weekly), marketing_sending_enabled ON in Platform Settings, challenge_email_selftest before assuming non-delivery.
- Rendered-pixel inspection of the marketing composer with segments not yet done.
- User wants to "discuss some more beautiful stuff" — pending design session.

## 2026-11-16 — November round opens with AI grading enabled

**Decision**
- The user set `CHALLENGE_ASSESSMENT_CALIBRATED=true` and registration for the November round now opens — they chose the AI-graded path over manual grading (operator attestation made without the representative assessment review; their call, recorded here so every agent knows this round is machine-graded).

## 2026-11-15 — Challenge round: setup leniency, AI optional, centered dialogs, rebuilt public page

**Decision**
- Challenge setup is NOT compulsory while drafting: an administrator saves partial briefs, rubrics and deliverables freely; completeness is enforced only by the readiness check at "Open registration" (the user: "one can not choose a few or just one course — i want that changed").
- AI-assisted grading is OPTIONAL. The Groq provider + calibration readiness gate applies only when `CHALLENGE_AI_ENABLED=true`. With it off, rounds open normally and are graded manually through audited admin corrections.
- Challenge admin dialogs (round editor, category editor, corrections, freeze/publish confirmations) are CENTERED pop-ups over the page, not side drawers.
- Public challenge experience should feel free and airy: stepped guest flow and a tabbed participant portal, not one packed page ("something more engaging and free even if it needs to be paged").
- The challenge spec source of truth is the user's `Updates.docx` (monthly challenge system; five categories; category-specific brief emails; evidence-based AI-assisted scoring 30/25/20/15/10; admin dashboard; results retained until announcement day).

**Changed**
- `backend/apps/challenges/serializers.py` — added `validate_rubric_draft` (shape-only) used while a round is a draft; strict 100-point rubric still required at readiness; requirements cap relaxed to 100 items / 4000 chars; AI readiness errors only when `CHALLENGE_AI_ENABLED`.
- `backend/apps/challenges/assessment.py` — `freeze_round` cancels `awaiting_configuration` jobs as `manual_grading` when AI is disabled so manually graded rounds can freeze.
- `frontend/src/components/Dashboard/admin/AdminUI.tsx` + `admin.module.css` — Drawer gained `variant="modal"` (centered native dialog); `ChallengesManager.tsx` uses it for all four dialogs and no longer hard-blocks saving a partial rubric while the round is a draft.
- `frontend/src/lib/api.ts`, `api-errors.ts`, `challenge-api.ts` — non-JSON error bodies now surface a readable snippet (tag-stripped, 220 chars) instead of the bare "error 400" message; DRF field messages joined with " · ".
- `frontend/src/components/challenges/ChallengeExperience.tsx` + `challenge.module.css` — rebuilt: numbered stepper, three guest steps (intro / tracks / join) and a tabbed portal (Overview / Your project / Engagement / Results).
- Verification 2026-11-15: 8/8 functional checks passed against in-memory sqlite (draft partial rubric saves; AI gate off when `CHALLENGE_AI_ENABLED=false`, on when true; published rubric stays locked; freeze retires waiting jobs and manual overrides freeze + rank); `npx tsc --noEmit` clean; `next build` static export clean. Rendered pixels not yet visually inspected.

**Open**
- The "Edit Data Analysis" HTTP 400 was never root-caused (the old UI hid the server body). Retry the category save after the error-surfacing change and record the real cause here.
- Rendered pixels of the rebuilt challenge page not yet visually inspected in a browser.
- Operational watchlist now that the round runs AI-graded: `process_challenges` cron every minute (it also delivers registration brief emails), Groq daily token budget (180k default), early sanity check of AI scores against real submissions, and freeze requires every submitted entry scored via correction or disqualified.
- User wants to "discuss some more beautiful stuff" after this round lands — next design session.
