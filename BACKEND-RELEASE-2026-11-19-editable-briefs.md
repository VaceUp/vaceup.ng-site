# Backend release 2026-11-19 — briefs stay correctable while a round runs

Delta overlay only. Three files. **No migration.** Restart the Python
application after extracting. This builds on the 2026-11-18 lifecycle backend.

## What this release does

**1. Brief text, deliverables and email instructions stay correctable while a
round runs.** Until now everything in a category froze the moment
registration opened, which is how the Data Analysis dataset was missed: the
round was already open when the file upload was attempted. Open and closed
rounds now accept corrections to the brief text, the required-deliverables
list and the per-category email instructions.

**2. The rubric stays locked.** Scoring never shifts mid-round: the rubric,
category name, slug, enabled flag and winner count remain frozen once the
round leaves draft, and the readiness review still requires a complete
100-point rubric before registration opens.

**3. Brief material uploads accept datasets.** The upload endpoint previously
only allowed `application/pdf`. It now also accepts
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX),
`text/csv` / `application/csv`, and `application/zip`, with the size ceiling
raised from 10 MB to 20 MB. Content is still verified byte-for-byte
(spreadsheet structure, safe archive paths, no macros) and copied out of the
browser-writable quarantine into the private evidence prefix.

**4. The dataset reaches participants both ways.** The brief email carries a
signed seven-day download link (plain text and a secondary button), and the
participant portal serves `brief_download_url` for the participant's own
category as soon as a file is attached — existing registrants get the updated
materials by re-requesting their access email.

## Files

- `apps/challenges/serializers.py` — running-round lock narrowed to rubric and identity.
- `apps/challenges/views.py` — upload/complete-brief guards allow open and closed rounds; dataset content types and 20 MB limit.
- `apps/challenges/emails.py` — wording reflects datasets ("brief materials") instead of PDF.

## Verification

Three functional checks passed against an in-memory database: an open round
accepts brief corrections; rubric edits on a running round are rejected with
the lock message; readiness still reports the incomplete 100-point rubric.
No pending migrations were detected.
