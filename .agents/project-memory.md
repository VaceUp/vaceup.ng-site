# VaceUp Project Memory

Durable log of product decisions and mid-code changes. Newest first. Every agent reads this file at session start and appends a dated entry before finishing (see `.agents/skills/project-memory/SKILL.md`). Never delete entries; record reversals as new entries.

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
