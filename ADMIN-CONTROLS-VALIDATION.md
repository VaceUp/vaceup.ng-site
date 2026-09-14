# Admin controls verification

Local verification, not a claim that the live server has been deployed.

- Backend: 218 tests ran; 215 passed and 3 MySQL-specific tests were skipped. The exact candidate backend was tested in a separate directory without production `.env` files or unrelated pending messaging work.
- Migration drift: `makemigrations --check --dry-run` reported no changes.
- Frontend production export: completed, generating 57 static pages. Existing Next configuration skips type validation during builds.
- Standalone TypeScript check: NOT clean. Existing failures remain in Cloudflare function types, announcements/applications, the legacy code editor, homepage props and shared Card/Dropdown/Tooltip components. No errors were reported for the new authoring components.
- Stateful browser regression: 13/13 checks passed using intercepted test API responses. These cover drafts, category creation/protected deletion, course edits, module append, the direct admin courses route, campaign authoring/confirmation/pause/report, typed settings, mobile overflow and permanent user deletion. No live email or user deletion was performed.
- Component state checks: courses 33, marketing 18 and settings 12 element-state measurements passed in each of light and dark modes. The test artifacts convert Tailwind OKLCH literals through the browser's sRGB canvas because the kit's numeric parser only understands RGB.
- Responsive gate: the three component snapshots had no horizontal overflow at 280, 320 and 414 CSS pixels.
- Automated accessibility: axe-core reported zero violations for the courses, marketing and settings snapshots in both light and dark modes after correcting the dark-theme root background. This covers these captured states, not every page or interaction in the LMS.
- Focus: campaign review remained inside the native dialog during the tested Tab sequence. Deletion and other confirmations use the shared native dialog primitive.
- Token checks: four authoring source files passed hardcoded-value lint; all authoring stylesheet references resolved against the 288 definitions in the compiled shared theme. Eight changed authoring components passed the no-emoji gate.
- Manual inspection: desktop campaign, courses and deletion screenshots, plus mobile settings were inspected. These are sample-data previews, not a live content audit.
- Taste signals: no measurable slop tells in the campaign snapshot; the taste audit flagged two long paragraphs. These heuristics do not establish aesthetic quality.

## Wider kit gate remains incomplete

The supplied `accuracy_report.mjs` returned **23/37 checks passed** with a bounded runner. Windows Python naming/encoding and the external axe download required local test-runtime setup. Several large combined harness checks exceeded the per-command 30-second budget; token-build/eval and some other kit checks also failed. This is NOT a passing whole-kit report and does not certify the whole LMS.

The browser preview and build initially hit local memory pressure; the preview tests and production export subsequently completed. The test-only timeout preloader changes no application code or accessibility thresholds.

## Still requires deployment verification

Live MySQL locking and workload capacity, Cloudflare's deployment result, real R2 upload/playback, SMTP inbox delivery, sending quotas and cPanel cron operation have not been proven by these local tests. See `ADMIN-CONTROLS-DEPLOY.md` for rollout and smoke checks. Password-reset troubleshooting was deferred from this release.
