# Challenge portal and course intake release

This release implements the agreed public-post and participant-evidence workflow. It has not been deployed. The backend is installed by cPanel ZIP upload; the frontend uses the existing GitHub deployment workflow.

## Included behavior

- Separate guest challenge registration, category-specific branded emails, one-time verification links, private participant sessions and access recovery. No LMS enrollment is created.
- Actual project uploads, immutable revisions and a public LinkedIn/Instagram post link with an own-work/public-post attestation.
- Public posting instructions: visible likes/comments, VaceUp tag, round hashtag, and public access through announcement. Private analytics and social account passwords are not requested.
- Participant-supplied screenshots and CSV/XLSX count evidence; deterministic table extraction, optional Groq screenshot extraction, discrepancy flags and retained proof for finalist review. Uploaded evidence is not represented as independently authenticated analytics.
- Separate public-count observations where an authorized public collector can read matching post data. Blocked, hidden or unsupported counts remain unavailable. Public collection is disabled by default; direct public-post links remain available for review.
- Project-quality assessment through configured Groq, evidence citations, versioned rubric/model settings, persistent token budgets, retries and paused jobs when configuration/quota is unavailable. No paid provider fallback.
- Provisional scorebooks update from available evidence. Hybrid scoring is 80% quality plus up to 12 points for likes and 8 for comments, with fixed published targets. Quality-only uses the full original quality rubric out of 100.
- CSV/XLSX exports with counts, provenance, observation/receipt times, scores and audit references. Corrections require an administrator and a reason. Results remain private until the completed scorebook is frozen and explicitly published.
- The scorebook uses batched database reads and a paged administrator table. A synthetic 2,000-entry test exercises database ranking and the API; this is not a provider throughput benchmark.
- Reusable course intakes with course availability and archive controls. Homepage/catalog/course notices use the next active intake that has not started; the current application/payment flow remains in place.

## Install backend before publishing the frontend

1. Back up the deployed source and database. Extract the accompanying ZIP over the existing backend application root; keep the existing `.env` and uploaded files.
2. Activate the Python environment shown in cPanel, then run:

   ```sh
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py check
   python manage.py seed_november_challenge
   python manage.py seed_intakes_2027
   ```

3. Restart the Python application. The new seeds create drafts and preserve existing content; neither command publishes a round, opens registration or activates an intake.
4. Deploy the corresponding frontend through the existing pipeline. Challenge routes are `/challenge/` and `/challenges/`; management appears under Challenges and Course Intakes in the admin dashboard.

The new migrations are `challenges.0001_initial`, `challenges.0002_challengesubmission_checklist_confirmed` and `website.0011_academyintake`. The package also carries the earlier recordings/email backend overlay, including its additive migrations, so those existing local changes are preserved.

## Backend configuration

Keep credentials only in the backend environment, never a `NEXT_PUBLIC_*` variable or Git. The local Groq key was still absent at the last configuration check; no live model assessment has been performed.

```dotenv
GROQ_API_KEY=
CHALLENGE_AI_ENABLED=false
CHALLENGE_ASSESSMENT_CALIBRATED=false
CHALLENGE_GROQ_MODEL=qwen/qwen3.8-27b
CHALLENGE_AI_DAILY_TOKEN_LIMIT=180000
CHALLENGE_AI_MAX_OUTPUT_TOKENS=1200
CHALLENGE_AI_TIMEOUT_SECONDS=45
CHALLENGE_PUBLIC_COUNTER_COLLECTOR=disabled
CHALLENGE_MAX_PROJECT_BYTES=20971520
CHALLENGE_MAX_ENGAGEMENT_BYTES=10485760
```

Set the key and enable inference for the pilot. Review representative projects from every category against expert scores, actual token use, accepted evidence formats and the last-day workload. Only after that review set `CHALLENGE_ASSESSMENT_CALIBRATED=true`. Opening registration checks this flag and the offline provider configuration. This is an operator attestation, not automatic certification that a free provider can handle 2,000 entries by the deadline.

Official limits and provider availability can change. A daily budget avoids automatic paid overflow; it cannot guarantee completion. Screenshot-only engagement extraction also consumes the model quota. Clearly labelled CSV/XLSX tables use ordinary parsing without LLM calls. Where a table already supplies likes/comments, accompanying images remain available for finalist review without another model call; this is labelled participant-supplied evidence, not a claim that the image was automatically cross-checked.

Private uploads require valid existing `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME` and the correct S3/R2 endpoint. The object storage CORS policy must permit the frontend's PUT requests and content type. The backend allows `X-Challenge-Token` in its CORS headers. Upload verification hashes the bytes and copies them out of the browser-writable quarantine key.

`permitted_public_html` may be configured for `CHALLENGE_PUBLIC_COUNTER_COLLECTOR` only where that automated collection is authorized. It uses HTTPS allowlisted post URLs, public DNS, bounded responses and matching structured counters; it does not log in, bypass access controls or promise that the platform exposes every count.

## Cron

Use the cPanel virtual environment's actual Python path and the deployed application directory. Schedule this command every minute, redirecting logs to a private file outside public web directories:

```sh
/path/to/venv/bin/python /path/to/backend/manage.py process_challenges --limit 20 --max-seconds 45
```

Jobs use database leases and operation keys, so overlapping invocations do not intentionally process the same operation twice. Unknown provider completion is flagged for review rather than blindly resubmitted. The runtime bound is checked between jobs; a single in-flight network call can run until its own timeout.

Public observations are scheduled by elapsed 24-hour intervals from acceptance, with a separate final observation job. Daily processing cannot create new participant screenshots. Participants must supply fresh final evidence themselves when public observations are unavailable.

## November setup before opening registration

In the private November draft, complete the actual five project briefs, deliverables, rubric descriptions, official handles, published rules, prizes/tie policy and positive likes/comments targets. Draft placeholders cannot pass readiness validation. The draft includes the agreed dates:

- Project submission: November 29, 2026, 18:00 Lagos.
- New final engagement evidence and its submission: November 30, 18:00-20:00 Lagos.
- Result announcement: December 1; set the desired publication time before opening.

Both the final file's trusted upload timestamp and the evidence update's server receipt must be within the collection window. Earlier proof cannot be relabelled as final by editing its declared capture time. Provisional scores are not final winner declarations. Exact winner-boundary ties remain flagged for an audited resolution under the published prize rules.

The approved quality-only fallback must be selected before opening registration. It removes engagement from ranking, but still needs sufficient project-assessment capacity. Published rules/dates/rubrics are locked; use Clone for a later monthly round with fresh dates and no copied entrants or results.

Activate the seeded 2027 intake drafts only after assigning the offered courses or deliberately selecting all published courses. The homepage's manual cohort date remains a fallback until managed intakes exist; after that, the intake calendar is authoritative.

## Validation and remaining live checks

Local tests and captured browser fixtures do not send real emails, call Groq, modify hosted data or prove production storage permissions. See `artifacts/challenges/backend-suite.txt`, `frontend-build.txt`, `browser/result.json` and `ui-gates.json` for reproducible results.

Before launch, perform a real category registration/email recovery, private upload/download, representative Groq pilot and cron run against an authorized test entry. Confirm the publication date, finalist review procedure and free-provider capacity. Do not open registration while those prerequisites remain unresolved.

The repository-wide design-kit command currently reports 5/37 checks because its root token/example/template fixtures are absent. Scoped challenge/intake state, accessibility, responsive and browser interaction checks are reported separately; do not describe the global kit as passing.
