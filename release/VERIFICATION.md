# Verification record

These results are from the local workspace and mocked/local services, not the live server.

## Functional checks

- Full Django suite: **121 tests passed** with SQLite, in-memory email, eager Celery and isolated cache/broker configuration. The last run completed in 3.042 seconds. No real email was sent.
- Migration drift check for accounts, adminpanel and courses: **no changes detected**.
- Frontend production build: completed, including **50/50 static pages**. The repository already configures Next.js to skip TypeScript validation during builds; a successful build is not a clean type check.
- Browser suite against the compiled static export: **passed**. All **13 admin sidebar destinations** changed displayed content/active state without document reload; Back/Forward also worked.
- Guide checks: automatic opening, four-step walkthrough, complete section map, Tab containment, Escape and focus return, preference-save failure, persistence after reload, manual re-enable, and display on the next login.
- Registration checks: DRF field-error display, successful inactive-account notice, unavailable-mail-queue notice, resend, public calls without stale bearer headers, explicit verification action, and successful activation notice. The standalone registration page was exercised; the older popup shares the corrected request/success handling but was not independently exercised through a live popup entry point.
- Catalogue checks: backend-provided course on the homepage, detail fetched by slug, real numeric application ID, responsive catalogue, and explicit outage message without fallback courses. Admin category creation and renaming were exercised in the browser. Server tests cover course creation, price validation, publication, tutor validation, category renaming, draft privacy, and repeatable import without overwrites.
- Browser run: **67 intercepted API calls**, **zero browser runtime exceptions**. No live API writes, payments, learner accounts, or actual provider connections were used.

## UI checks and their limits

- Screenshots of the actual guide were captured and visually inspected on desktop and at narrow widths. The narrow site map uses a selector so the instructions are not buried beneath thirteen navigation rows.
- Actual guide and catalogue containers had no horizontal overflow at **280, 320 and 414 pixels** in the browser suite. This does not certify every legacy admin table or page at those widths.
- `verify_states.mjs` on the rendered guide snapshot reported **56 element-state checks**, passing in both normal and `--dark` runs. VaceUp intentionally remains a light-only brand; the dark run does not implement or certify a separate dark theme.
- `verify_responsive.mjs` reported **1 file**, no overflow at **280/320/414px**.
- The newer CSS Color 4-aware browser check measured **30 text pairs** and **68 interactive text states**, with **zero failures**. Minimum measured body-text contrast was **7.23:1**. This check converts computed colors through browser canvas; it does not cover all non-text contrast, assistive technologies, or every error/loading state.
- The existing `measure_render.mjs` reported six failures because its numeric parser treats `oklch(...)` components as RGB, including impossible RGB components above 255. Those results were not hidden or counted as passes. The separate browser-color-aware check was used to verify the same rendered guide colors correctly.
- Targeted no-hardcode checks passed for the new guide, category manager, course editor and public catalogue. The targeted no-emoji check passed for the seven new UI files and the two then-existing release documents: **9 files**.
- Taste checks were advisory: one long paragraph and one repeated-shadow signal. Screenshots were inspected; neither automated output nor this inspection is a numeric claim about visual taste. The separate design-critic agent file was not available at the routed location.
- New components use shared brand tokens/semantic aliases and the reusable native dialog primitive. No product-wide rebrand or palette replacement was made. The design-code, brand and UI/UX skills guided these choices.

## Gates that remain red

- Repository-wide `node scripts/accuracy_report.mjs`: **0/37 checks passed**. The gate could not run cleanly in this checkout: it expects `python3`, local Playwright resolution and reference/evaluation assets that are not available in the configured locations. This is a failed gate, not a waived success. Product-specific checks above were run separately with the available Python and bundled browser runtime.
- `npx tsc --noEmit --pretty false`: still fails on existing source/dependency issues (Cloudflare worker types, CardHeader calls, code editor Select props, marketing variables, StudentHome typing, and shared UI definitions). No new type errors were reported for the new guide, catalogue, category editor or account-recovery files. The pre-existing KidsAcademy prop error remains in the homepage source.
- Automated axe/screen-reader testing, production MySQL migration rehearsal, live Redis/TLS/SMTP delivery, and workload/security testing have not been completed in this task. The static site's existing host-header/CSP policy is not certified by these checks.

## Reproduce

Use a test environment, never production data. Set empty/isolated service settings before importing Django, so a test does not initialise a live cache or monitoring connection.

```powershell
$env:REDIS_URL=''
$env:CELERY_BROKER_URL='memory://'
$env:CELERY_RESULT_BACKEND='cache+memory://'
$env:SENTRY_DSN=''
cd backend
python manage.py test --settings=config.settings_test --noinput
python manage.py makemigrations --check --dry-run accounts adminpanel courses --settings=config.settings_test
```

Build the frontend with its production API origin, then serve `frontend/out` locally (for example `python -m http.server 3118 --bind 127.0.0.1 --directory frontend/out` from the repository root). With Playwright resolvable in Node:

```powershell
$env:QA_BASE_URL='http://127.0.0.1:3118'
$env:QA_BROWSER_CHANNEL='chrome'
node frontend/tests/admin-auth-catalog.cjs
node frontend/tests/contrast-modern.cjs artifacts/admin-auth-catalog/guide.html
```

On this workstation the existing bundled dependency directory was provided through `NODE_PATH`; no application runtime dependency was added. `frontend/tests/qa-runtime.mjs` provides the equivalent resolution for the ESM design scripts when passed through Node's `--import` flag. Browser screenshots, snapshots, JSON results and release ZIPs are generated under `artifacts/admin-auth-catalog/` and intentionally excluded from Git.

Archive integrity and per-file SHA-256 manifests are checked by `release/package-admin-auth-catalog.py`. Review the deployment guide before upload. These results do not establish a capacity of 1,000 users per minute or production readiness for the entire LMS.
