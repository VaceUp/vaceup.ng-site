# VaceUp challenge implementation plan

Planning date: November 13, 2026. All operational times below use Africa/Lagos.

Status updated November 14, 2026: implementation started after the user accepted the no-social-API approach below. Assessment-capacity validation remains outstanding; nothing in this challenge release has been deployed. This document combines Updates.docx, the project audit, and the user's latest decisions.

## November 14 decision: public posting and participant evidence

The user approved actual project files, submitted public LinkedIn/Instagram links, participant-supplied screenshots or analytics exports, automatic count extraction and scoring, and checks focused on finalists and exceptions. Social posting is for VaceUp publicity. Private analytics, audience demographics and social account passwords are not required.

- Keep the challenge post public, show likes/comments where the platform supports it, include the VaceUp tag and round hashtag, and retain access through announcement.
- Preserve the approved 80/20 scoring split. Participant-supplied public-counter proof can support engagement points after extraction and consistency checks, with its source clearly labelled. It is not independently authenticated analytics.
- Public observations supplement that evidence where available. An unavailable public counter does not become zero or prevent participation merely because an official API connection is absent.
- Ask participants for updated evidence when their last observation is stale. A daily job cannot create a new screenshot or relabel old evidence as freshly observed.
- Final engagement evidence must be received during November 30, 18:00-20:00 Lagos time, separately from the November 29 project deadline. Preserve the server receipt time and declared observation time; backdating an old upload must not make it final evidence.
- Administrators inspect finalists/flagged entries and approve the frozen scorebook. Published rules must explain participant-supplied evidence and its limitations before registration opens.

This supersedes official social API access as a prerequisite for hybrid November scoring. APIs remain an optional future collection method. The approved quality-only fallback and independent AI capacity check remain available before registration opens.

## Approved decisions

- Hybrid scoring: 80 points for project quality, 12 for likes/reactions and 8 for comments. Shares/views are recorded where supported.
- Submission closes November 29 at 18:00 Lagos time. Final engagement collection is November 30, 18:00-20:00. Announcement is December 1.
- A quality-only November fallback remains approved, with the rules changed before registration opens. Following the November 14 decision, missing social API approval alone does not require that fallback: participant-supplied public evidence can support hybrid scoring.
- Important feasibility distinction: quality-only removes engagement from judging but does not eliminate AI assessment workload. Sufficient assessment capacity is still required; do not promise automated completion if that independent check fails.

The user will configure a Groq key and reply when ready. No key has been supplied or validated yet.

## 1. Agreed direction

- Run a reusable monthly challenge with separate rankings and winners for Data Analysis, Web Development, Graphic Design, UI/UX Design, and Virtual Assistance.
- Participants register for one category without creating an LMS/student enrollment.
- They receive their category brief, publish the required social post, and submit its link with actual project evidence.
- The November brief requires a public LinkedIn or Instagram post, a short explanation video, the VaceUp tag and `#VaceUpNovemberChallenge2026`. Confirm the exact platform handles and supported post/video formats before publishing. Subsequent rounds have editable handles, hashtag and requirements.
- Start project-quality assessment when valid submissions arrive.
- Refresh available social engagement every 24 hours and update a provisional scorebook.
- Complete a dedicated final collection and review on November 30, with results intended for December 1.
- Design for approximately 2,000 submissions per month, with no paid AI service assumed.
- Keep administrative approval of the final result; automate normal collection, assessment, calculations, and ranking.

Daily engagement collection uses social APIs and normal calculations. It does not require another LLM assessment. We need an assessment workflow using an existing model, rather than training our own LLM.

## 2. Feasibility checks that must come first

### Free AI capacity

ChatGPT Free/Plus does not qualify for the included API-credit benefit in current official OpenAI documentation. We should not budget those credits. [Official OpenAI documentation](https://developers.openai.com/api/docs/guides/chatgpt-api-credits).

Groq is a candidate for a free assessment pilot. Its published free limits for `qwen/qwen3.8-27b` include 200,000 tokens/day; actual organization limits must be checked. [Groq limits](https://console.groq.com/docs/rate-limits).

Illustrative arithmetic, not measured throughput: November 14-30 provides 17 processing days. At that cap, 2,000 entries would have only 1,700 tokens each on average before retries and reserve. Two images alone consume 4,096 input tokens under the documented vision accounting. Therefore, free completion of every entry by November 30 is currently unproven. [Groq vision accounting](https://console.groq.com/docs/vision).

The pilot must measure representative evidence from every category, token use, processing time, grading usefulness, and likely revision/retry overhead. A last-day submission surge must be included in the capacity forecast. Spreading requests cannot create additional token allowance.

If capacity is insufficient, first evaluate the approved quality-only November fallback. It still requires the project assessments; if that workload remains unsupported, agree a smaller volume, different evidence format/provider or longer processing period before making a promise to entrants. Do not silently truncate important evidence to fit a quota, rotate accounts to evade limits, or enable paid overflow.

### Optional social API access and quotas

A submitted public URL is not a guarantee that every counter or the post's contents can be fetched automatically.

- Instagram's supported insights route serves connected professional accounts. Serving outside entrants requires Advanced Access, App Review, and Business Verification. Personal-account eligibility therefore needs a specific supported access method, not an assumption. [Instagram platform overview](https://developers.facebook.com/documentation/instagram-platform/overview).
- LinkedIn member analytics requires approved permissions and entrant authorization. Development access allows 500 app calls per 24 hours; that is insufficient if all 2,000 entries require daily LinkedIn checks, even at one call per entry. Required production access and capacity must be established for the actual platform mix. [LinkedIn access tiers](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-10), [member analytics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2026-10).
- Caption/tag/video access must be tested separately from metric access. Unsupported checks must remain flagged rather than treated as verified.
- Instagram insight data can lag up to 48 hours; unavailable metrics return empty data rather than zero. Later lifetime counters cannot automatically reconstruct an exact November 30 count. [Instagram media insights](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights).

These limitations apply to a future API collector, not to eligibility for the approved participant-evidence workflow. Public post links and evidence are reviewed without demanding private analytics or a social account connection. Preserve verification states for ownership/tags; unavailable information must not silently count as a passed compliance check.

## 3. Approved scoring split and mode rules

Approved hybrid scoring: project quality contributes 80 points; engagement supported by the published evidence policy contributes 20.

| Criterion | Points in final total |
|---|---:|
| Technical execution and accuracy | 24 |
| Practical application and relevance | 20 |
| Creativity and problem solving | 16 |
| Presentation and communication | 12 |
| Compliance with the brief | 8 |
| Verified engagement | 20 |

Each category has its own evidence requirements and scoring descriptions. Mandatory eligibility conditions are separate from discretionary compliance points: an entry cannot compensate for being ineligible by gaining likes.

The approved engagement component scores likes/reactions and comments: 12 points and 8 points respectively. Record shares/reshares and views/impressions where supported, with their original platform labels. Adding those metrics to prize scoring requires a future approved and published rule set after the access pilot demonstrates fair, consistent availability.

Use a fixed, capped logarithmic formula rather than unlimited raw counts:

```text
engagement_points =
  12 * min(ln(1 + likes_or_reactions) / ln(1 + likes_target), 1)
   + 8 * min(ln(1 + comments) / ln(1 + comments_target), 1)

final_points = quality_points_out_of_80 + engagement_points
```

Positive targets are calibrated from the pilot or previous campaigns, approved, and published before entries open. They remain identical across supported platforms within a category and cannot change during the round. No target values are finalized in this plan.

### Approved quality-only November fallback

Select and publish one mode for the entire November round before registration opens. In quality-only mode, rank on project quality out of 100 using the original rubric:

| Criterion | Quality-only points |
|---|---:|
| Technical execution and accuracy | 30 |
| Practical application and relevance | 25 |
| Creativity and problem solving | 20 |
| Presentation and communication | 15 |
| Compliance with the brief | 10 |

If an assessment stores the hybrid quality component out of 80, normalize it as `quality_points * 100 / 80`. Do not leave entrants capped at 80 by setting engagement to zero. Show engagement as "not scored" in the scorebook and exports. Do not mix scoring modes between entrants or silently redistribute missing-metric weights.

In quality-only mode, daily social collection may run for reporting if available, but it is not a ranking dependency. The November 30 review freezes the final accepted evidence and quality assessments. Public rules, emails, portal copy and exports must consistently identify the active scoring mode. Do not remove or award unverifiable compliance requirements silently.

This limits the effect of a very large audience but does not remove audience or platform advantages. Public counter totals also do not prove that engagement is genuine. Do not promise bot detection or unique-commenter verification without supporting data. Specify whether API comment totals include replies and self-comments.

Proposed tie order: unrounded total, quality total, technical score, then practical score. If still tied, recommend a joint winner; confirm prize handling before launch. Display rounding must not decide a tie.

## 4. Daily collection and November finalization

Follow the user's common November 30 cutoff approach. Earlier posts will have more exposure time; disclose that clearly in the public rules.

1. On accepted submission, validate the post and store its canonical identity and an initial engagement snapshot.
2. Schedule subsequent snapshots every 24 hours, spreading jobs rather than sending every request simultaneously.
3. Preserve cumulative counters, source, metric availability, scheduled time, actual observation time, and any error. Never add daily cumulative totals together.
4. Recalculate the provisional engagement score from the applicable snapshot. Preserve legitimate counter decreases.
5. Run a dedicated final refresh for all eligible entries within a published collection window. Do not merely reuse whichever daily snapshot happens to be latest.
6. Lock each entry's accepted evidence revision, quality assessment, final metric snapshot, formula version, and calculated rank into the final scorebook.
7. An authorized administrator reviews exceptions and approves publication. Normal entries do not need manual judging.

Calendar: submission close, final collection window and December 1 announcement are approved. Registration dates come from the brief; the proposed registration closing time and exact publication time remain setup details. The access/capacity pilot must still demonstrate feasibility.

| Stage | Lagos date/time |
|---|---|
| Registration | November 13-20; closing time 23:59 on November 20 |
| Project development | November 14-28, as in the brief |
| Submission/evidence replacement closes | November 29 at 18:00 |
| Final metric collection window | November 30, 18:00-20:00 |
| Final validation and administrator approval | November 30, after collection completes |
| Results announcement | December 1; exact publication time to be set |

The approved final window is not yet a demonstrated capacity result. In hybrid mode, judge the API totals observed during that window; do not describe them as complete real-time activity at one exact instant. Keep actual timestamps visible to administrators. No December 1 re-fetch may silently replace November 30 inputs with newer lifetime totals.

Before registration opens, select and publish the hybrid participant-evidence mode or the approved quality-only fallback. Independently validate assessment capacity for either mode. If it is insufficient, surface the capacity issue for a revised volume, provider or assessment schedule rather than claim the fallback solves it.

After registration opens, preserve the published mode. If required assessments or, in hybrid mode, required final metrics remain unresolved, keep the scorebook provisional and escalate the deadline risk. Do not switch to quality-only secretly after seeing results or treat missing values as zero.

Entrant-caused deletion/private access and provider failures require different treatment. Proposed rule: required posts stay public and materially unchanged through announcement; the published eligibility/remediation policy handles entrant changes. Provider failures remain pending, not an automatic zero or individual disqualification.

## 5. Participant journey and clean UI

| Step | Main task | Recovery/error behavior |
|---|---|---|
| Challenge overview | Understand prize, categories, requirements, rules and dates; choose one category | Closed or unavailable rounds explain the next action |
| Guest registration | Submit name, email and phone; verify email using a code or secure link | Duplicate registration resumes the existing entry; resend/recovery is rate limited |
| Personal challenge page | Read the selected brief, download resources and see deadlines | Brief is available in the portal even if its email is delayed |
| Submit work | Provide a public post URL, explanation and required project evidence; no social account connection is required | Show inaccessible link, duplicate post, incomplete upload or missing requirement with a specific remedy |
| Submission receipt/status | Confirm what was received; show processing, required corrections and last engagement update | Receipt appears immediately after durable save; delivery status is distinct from registration success |
| Published result | View the released result and permitted feedback | Before release, show assessment progress without leaking hidden scores or rankings |

Use the existing VaceUp theme and reusable components. Give each screen one primary action, clear labels, short sections, and visible save/processing feedback. On mobile, show a readable status summary with expandable details. Admin tables may scroll within their own region while the page remains usable. Required keyboard, focus, error, loading, disabled and selected states are part of implementation.

Category emails use the shared branded layout: heading, personal greeting, brief, deliverables, social instructions, deadline and one portal link. Correct category isolation, safe formatting and delivery retries are required. Registration must not depend on an email being delivered instantly.

Administrators can edit each category's email and formatted brief, attach a brief PDF, set open/close dates and enable or disable categories. The participant receives only the selected category's material.

Next design validation: review these content flows, then wireframe registration, submission/status, and the admin scorebook before visual implementation. Have representative participants complete registration, find their brief, submit work and recover from a rejected link; have administrators identify a missing metric, inspect evidence, export and approve a result. Success means completing each task without assistance or exposing another participant's data; record observed problems before progressing.

## 6. Evidence and assessment behavior

Social performance and project quality are separate inputs. A caption or URL alone is insufficient evidence for all quality criteria.

| Category | Evidence to define in its brief |
|---|---|
| Data Analysis | Workbook/data, outputs or dashboard, explanation; reference answers/checks where appropriate |
| Web Development | Live site, submitted source/repository snapshot, screenshots and explanation |
| Graphic Design | Exported designs and required source/process evidence |
| UI/UX Design | Screens, flows/prototype, rationale and required research evidence |
| Virtual Assistance | Documents, spreadsheets and workflow evidence demonstrating the requested tasks |

Freeze and hash accepted evidence revisions. Assess once per unchanged revision/rubric; do not rerun quality grading on every engagement refresh. Permit corrections before the deadline, preserve history, and coalesce repeated edits so the latest complete revision is assessed. Publish revision/format limits after capacity measurement.

The model returns structured criterion awards, evidence references, reasons, strengths, weaknesses and flags. The server validates ranges and computes totals and rankings. Missing or unreadable evidence becomes a correction/review state rather than invented findings. Use the same calibrated model configuration and rubric within a category/round; a model change requires validation and consistent treatment of affected entries.

Calibrate against expert-reviewed examples from every category before enabling automatic final rankings. Initial human calibration and exception resolution are necessary quality controls; routine judging remains automated.

Do not claim that screenshots prove site functionality or that an LLM alone proves spreadsheet correctness. Use deterministic checks where possible. Any execution of submitted code needs an isolated worker; do not run it or document macros in the cPanel web process. Submitted content is untrusted evidence, never instructions for the assessment agent.

Store participant evidence privately with controlled access. Establish retention, participant consent, provider data handling and supported age policy before accepting uploads; send the model only necessary evidence, excluding contact details. Reject duplicate claims to the same canonical social post unless team participation is expressly introduced.

## 7. Scorebook and administrator workflow

The database is authoritative; CSV/XLSX are downloadable snapshots. A live Google Sheet integration is not necessary for the first release.

Scorebook columns include category, participant ID, submission revision, eligibility, criterion scores, quality points, available raw social counts, observation times, engagement points, total, rank, assessment status, missing-data flags, and publication status. Contact details are admin-only. Detailed audit records retain model/rubric/formula versions, evidence references and any correction's author/reason/time.

Administrator navigation:

1. Configure or clone a round, dates, categories, briefs, hashtags and immutable published rules.
2. View registrations/submissions filtered by category and status.
3. Monitor email delivery, jobs, free-quota usage, pending tokens/workload and deadline risk.
4. Inspect evidence, criterion reasons, metric history and exceptions.
5. Review the provisional scorebook; export it when needed.
6. Freeze the completed scorebook, confirm separate category winners, approve and publish.
7. Retain prior rounds and their original results.

After the November round, the brief schedules the next challenge for January 2027, then monthly. Cloning a round must copy editable setup without carrying over registrations, results or obsolete dates.

Proposed prize assumption: one winner per category, subject to confirmation. Administrative score corrections require a reason and preserve the original assessment. Reopening a frozen scorebook creates a new version with an audit trail.

## 8. Implementation architecture

- Add a dedicated Django/DRF Challenges module using the existing database and private upload infrastructure.
- Keep guest identities separate from LMS users/enrollments. Use scoped passwordless participant sessions and hashed recovery tokens.
- Add round/category configuration, registrations, versioned submissions/evidence, assessment runs, metric snapshots, audited corrections and frozen scorebooks/publications.
- Use a dedicated challenge outbox/job queue following existing lease, retry and deduplication patterns. The current user-bound mail queue cannot directly represent guests.
- Run bounded background jobs through cPanel cron. Registration requests save work and return promptly; they do not wait for AI or social collection.
- Enforce provider quotas, retry/backoff, token reserve and a zero-paid-overflow policy. A quota pause preserves pending jobs. Protect final collection capacity from optional refreshes/retries.
- Use Next.js client-fetched round data and stable query URLs compatible with the current static-export frontend. New monthly rounds should not require a frontend rebuild.
- Keep social credentials server-side and protect network/file processing against unsafe URLs and oversized/malicious files. Escape spreadsheet-formula text in exports and exclude secrets.
- Deploy frontend through the existing GitHub workflow; prepare backend migrations, cron instructions, environment changes and a cPanel ZIP with recovery instructions. Deployment is a later step.

## 9. Build order and release evidence

| Milestone | Deliverable and condition to move forward |
|---|---|
| 1. Rules and feasibility | Approved scoring/times/fallback and participant-evidence approach are recorded. Obtain the Groq key securely; measure AI cost/capacity and useful grading for each category. Define final evidence/public posting rules and calibrate engagement targets. Independently prove assessment capacity for either mode. No full-automation promise before this succeeds. |
| 2. Flow/design | Review wireframes and recovery paths; reuse the existing theme; validate participant and admin tasks before high-fidelity implementation. |
| 3. Registration and submission | Guest verification, category briefs/emails, private evidence, receipts, revisions and ownership/deadline checks work without creating LMS enrollments. |
| 4. Assessment and collection | Versioned quality results, quota-aware jobs, 24-hour snapshots, honest unavailable states and a dedicated final refresh work with real authorized test accounts. |
| 5. Scorebook and publication | Totals/ranks reproduce from stored inputs; ties/corrections are auditable; hidden results remain inaccessible; exports match frozen data. |
| 6. Capacity and release | Exercise a 2,000-entry synthetic queue, duplicate cron claims, late-submission surge and provider failures. Separately verify real provider throughput. Complete UI interaction, responsive and accessibility checks, then deploy and smoke-test. |
| 7. 2027 intakes | Deliver the separate intake requirement below, without coupling it to challenge ranking. |

Tests must cover category-email isolation, guest recovery, evidence ownership, duplicate posts, deadlines in Lagos time, assessment version changes, invalid model output, quota pauses, missing metrics versus zero, decreasing counters, cumulative-count calculation, final-window collection, scorebook locking, tie rules, unpublished-result privacy and export safety.

Rendered UI work must run the repository's required accuracy, interaction/state and responsive gates and receive visual inspection. Report actual gate results and limitations; this prose plan is not a rendered UI or a passing implementation report.

## 10. Separate milestone: 2027 course intakes

Keep the document's intake scope in the project:

| Intake | Start | End |
|---|---|---|
| First | January 8, 2027 | March 27, 2027 |
| Second | April 9, 2027 | June 26, 2027 |
| Third | July 9, 2027 | September 25, 2027 |
| Fourth | October 8, 2027 | December 25, 2027 |

Administrators manage reusable intake dates, course availability, links and active/archive status. Course registration/interest can remain open according to academy rules. All relevant pages obtain the next not-yet-started intake from the same API; a February visitor sees April rather than the already-started January intake. Preserve existing applications and payment behavior.

## 11. Remaining release prerequisites and pilot handoff

Completed decisions: the user approved the scoring split, submission/final collection times, and quality-only November fallback. Do not request those decisions again.

Outstanding release prerequisites:

1. Configure and validate the free assessment provider, then measure representative inputs from every category and a late-submission workload forecast.
2. Publish the participant-evidence/public-posting policy for hybrid mode, or select quality-only consistently before registration. Social API access is optional.
3. For hybrid mode only, calibrate and approve the logarithmic targets before publishing rules.
4. Confirm prize count, exact-tie prize treatment, precise platform handles, final briefs/evidence formats and publication time during round setup. Current assumptions remain one winner per category and joint winners for a remaining exact tie.

Local configuration preflight on November 13 found no matching Groq/OpenAI/Gemini/LinkedIn/Instagram/Meta provider variables in `backend/.env`, `backend/.env.production`, their inspected examples, `frontend/.env.production`, or the process environment. No provider calls or credential validation were performed. This does not establish the state of the hosted cPanel environment or any developer accounts.

The user will configure Groq and reply when ready. Store `GROQ_API_KEY` in the backend's local environment, keep it out of the frontend and source control, and never paste it in chat. Implementation is underway; a live assessment pilot remains pending until the key is available. Deployment has not begun.
