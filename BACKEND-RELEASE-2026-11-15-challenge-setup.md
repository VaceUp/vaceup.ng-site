# Backend release 2026-11-15 — challenge setup leniency and optional AI grading

Delta overlay only. Every file listed here is new or changed by this release;
nothing else in the application root is touched. This release builds on the
2026-11-14 challenges-and-intakes backend and must be extracted over it (or a
server that already carries it). **No migration and no new environment
variable.** Restart the Python application after extracting.

**This build supersedes the earlier 2026-11-15 zip of the same name.** The
only difference is the wording of the two AI-grading readiness messages,
which now name the exact switch to flip. If a blocked opening still shows
the old short text ("Complete the representative assessment and capacity
review before opening registration."), this zip has not been extracted yet
— or the server environment still has `CHALLENGE_AI_ENABLED=true`, which is
what makes the gate fire at all.

## What this release does

**1. Draft-stage challenge setup is no longer compulsory.** An administrator
can save a category brief with a partial rubric (a few criteria, points not
yet totaling 100, descriptions still empty) and long deliverable lists while
the round is a draft. Shape is still validated — stable lowercase ids, unique
criteria, positive point maxima — so a saved draft is always loadable.
Completeness (every criterion described, rubric totaling exactly 100 points)
is enforced only by the readiness review at "Open registration", which is
where it belongs. Published rounds stay locked exactly as before.

**2. AI-assisted grading is now optional.** The two readiness errors that
required the Groq provider and the calibration attestation apply only when
`CHALLENGE_AI_ENABLED=true`. With AI grading disabled (the current default),
a round opens for registration without any provider configuration and is
graded manually through the audited administrator corrections flow
(Review / correct in the scorebook: quality points, engagement points and
disqualifications, each with a reason). When the gate does fire, each message
now names its resolution: finish the provider settings or set
`CHALLENGE_AI_ENABLED=false` to grade manually; complete the representative
assessment review and set `CHALLENGE_ASSESSMENT_CALIBRATED=true`, or switch
to manual grading.

**3. A manually graded round can freeze.** `freeze_round` retires
`awaiting_configuration` assessment and engagement-extraction jobs as
`cancelled` with error `manual_grading` in the same transaction as the
freeze, so pending provider jobs no longer block a round whose scoring was
done by administrators. Unassessed entries still block the freeze until they
carry a correction or a disqualification — an unavailable score is never
treated as zero.

## Manual grading, end to end

1. Open registration with `CHALLENGE_AI_ENABLED` unset or `false`.
2. Participants register, upload evidence and submit as usual; their
   assessment jobs simply wait (`awaiting_configuration`) and never call a
   provider.
3. Grade each submission from the scorebook with "Review / correct": enter
   quality points out of 100 (and engagement points out of 20 in hybrid
   rounds) with an audit reason.
4. Freeze the scorebook after the final collection window closes; waiting
   jobs are retired automatically.
5. Publish results as usual.

## Not included in this zip

The frontend changes (centered admin dialogs, real error messages instead of
bare "error 400", the rebuilt stepped challenge page) deploy through the
existing frontend pipeline. Nothing in this zip is needed by the frontend
beyond the API contract it already uses.

## Files

- `apps/challenges/serializers.py` — draft-lenient rubric and requirements
  validation; readiness gate made conditional on `CHALLENGE_AI_ENABLED`.
- `apps/challenges/assessment.py` — freeze retires waiting provider jobs for
  manually graded rounds.

## Verification

Eight functional checks were run against an in-memory SQLite database:
draft partial rubric saves; AI gate absent when disabled and present when
enabled; published rubric stays locked; freeze no longer blocked by waiting
jobs; a manual override freezes the round, retires the waiting job and ranks
the entry. `python manage.py check` passes.
