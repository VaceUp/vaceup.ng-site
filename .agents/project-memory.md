# VaceUp Project Memory

Durable log of product decisions and mid-code changes. Newest first. Every agent reads this file at session start and appends a dated entry before finishing (see `.agents/skills/project-memory/SKILL.md`). Never delete entries; record reversals as new entries.

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
- 2026-11-15/16: user still hit the calibration readiness error on Open registration — cause: server env has `CHALLENGE_AI_ENABLED=true` with a working Groq key while `CHALLENGE_ASSESSMENT_CALIBRATED=false` (or the delta zip was not yet extracted; the message text distinguishes the two). Unblocked by setting `CHALLENGE_AI_ENABLED=false` + restart, and the two readiness messages now name their exact resolution flag.
- Deploy pending on the server: rebuilt delta ZIP `vaceup-backend-2026-11-15-challenge-setup.zip` (extract over the 2026-11-14 challenges backend, restart; no migration) plus the frontend pipeline. Rendered pixels of the rebuilt challenge page not yet visually inspected.
- User wants to "discuss some more beautiful stuff" after this round lands — next design session.
