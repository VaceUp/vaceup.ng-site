# VaceUp Build Session — Complete Chat & Work Log

**Session date:** 6 September 2026
**Final state:** Frontend live and feature-complete · Backend deployed and running on Truehost · Dashboards built · Handoff in `PROGRESS.md`
**Commits this session:** `e186569` → `209cd98` (see `git log` for all)

---

## Phase 1 — Project Audit (where it all started)

The opening request: audit the project, find vulnerabilities and weak links, especially the design system.

**Findings:**
- Register/login pages were **fake** — `setTimeout` simulations, no API calls
- Real secrets sat in local `.env` files (DB password, SECRET_KEY, JWT key) + a risky `backend.zip`
- Dead `/api` rewrites in `next.config.js` (ignored by static export)
- Paystack had a hardcoded test-key fallback
- **Design system had three conflicting sources of truth** (design-system.ts, globals.css with duplicated/conflicting tokens, tailwind.config.js with a wrong gold)
- Homepage rendered TWO navbars and TWO footers (layout + page both rendering them)
- Footer used a fake hand-drawn SVG logo instead of the real `logo.webp`
- `ignoreBuildErrors: true` was hiding broken files (Modal.tsx, Tooltip.tsx didn't compile)
- Live site was an old build; live API domain served a Cloudflare "Hello World" worker

## Phase 2 — Brand System Established

- Sampled the actual logo pixels: **Teal #018183, Gold #FBCB40, Navy #020281** → normalized
  to brand tokens: **Navy `#00088A` · Teal `#008B8B` · Gold `#FFC72C` · White**
- `globals.css` `@theme` block = single source of truth; duplicates removed; conflicting
  `navy-800` double-definition fixed
- UI kit repaired: `primary-*` aliases (primary=gold CTA with navy text for WCAG, secondary=navy),
  Button variants fixed (gold/navy, working loading state, duplicate props removed)
- Fixed broken files: `Modal.tsx` (unclosed div, invalid syntax), `Tooltip.tsx` (missing paren),
  `kids-academy` page (corrupted JSX, literal `{program.color}` class bug — same bug in 3 more files)
- Tailwind v4 dark-mode leak fixed (OS dark scheme made cards slate; pinned to inert class variant)

## Phase 3 — Homepage & Chrome

- **Duplicate navbar/footer fixed at the root**: layout owns Header/Footer/AuthModal globally;
  removed per-page duplicates from 9 pages
- Footer: real `logo.webp`, working routes, newsletter (name+email → marketing leads),
  socials via `site-config.ts`
- TopBar added (phone/email/WhatsApp/socials with the X logo + TikTok inline SVG)
- Hamburger now auto-closes on navigation + body scroll lock
- PRD sections added: How It Works (6-step admission), Insights & Guides (blog), Final CTA,
  hero CTAs per spec, per-card Enroll buttons, `#courses` anchor
- Stats consolidated to honest PRD numbers (30/5/8/98%/3) in ONE band with count-up animation
- Animations: macOS-dock spring auth modal, scroll reveals, count-up stats; reduced-motion respected
- Loader: transparent logo processed from logo.webp; V-monogram SVG draws end-to-end (arrow up)
  + gold progress bar; completes on route change (root cause of stuck overlay: Next Link
  navigations never fire window load)
- Real social handles wired (Digital Academy: FB/IG/TikTok/YouTube/LinkedIn; Kids: FB/IG/YT);
  TikTok rendered as inline SVG (not in Bootstrap Icons)

## Phase 4 — Real Auth & Wiring

- **Auth made real**: register/login/JWT against the live backend; session restore;
  register-before-pay business rule (`/apply` gates unauthenticated users to `/register?next=`)
- Apply wizard: live course catalog (fallback list when API down), submits to `/applications/`
- Dashboard: auth guard, role-aware rendering
- Resources downloads gated behind accounts; course syllabus download generates real files
- Course detail: Enroll (→ apply with preselect), Download Syllabus (gated), Share (native + clipboard)
- Contact: mailto fallback until backend contact endpoint exists
- Newsletter: name+email captured as marketing leads (localStorage until backend app ships)

## Phase 5 — Backend Deployment Saga (Truehost, cPanel File Manager)

Step-by-step guide written: **`TRUEHOST-DEPLOYMENT-GUIDE.md`**. Everything hit and fixed:

1. **Hello World at api.vaceup.ng** — an old Cloudflare Worker route (`vaceup-api-proxy`)
   answered before Truehost. Fixed by deleting the route in Cloudflare + DNS A record to server IP
2. **drf-spectacular missing** from requirements.txt (crashed startup) — plus channels/httpx/reportlab
3. **httpx>=1.0 doesn't exist** — pinned `>=0.27,<1.0`
4. **passenger_wsgi.py infinite recursion** — cPanel regenerates its default template when the
   Python app is recreated; it loads ITSELF forever. Fix: replace with the real 6-line Django entry
5. **SECRET_KEY containing `#`** — .env truncates at `#`; generated a clean key
6. **Redis configured but not installed on shared hosting** — `REDIS_URL=` emptied
7. **Register 500**: Celery email queue failure crashed signup — isolated; email failures now
   log (with verification token) but never block registration. ⚠️ **This fixed file
   (`apps/accounts/services.py`) still needs re-upload to the server**
8. ** healthz lives at `/healthz/`** not `/api/v1/healthz/` (guide corrected)
9. **useSearchParams in root layout** silently broke static export for ALL pages (removed)
10. **Build/server race on Windows**: never build while a preview server holds `out/`
11. Payment system verified **idempotent** end-to-end (unique references, safe re-verification,
    enrollment can't duplicate, webhook never raises)

## Phase 6 — Testimonials & Reviews System (frontend-first)

- `/testimonials` page: rating summary with distribution bars, review form (photo upload +
  canvas resize, 5-star input, role/course/outcome, validation), filter tabs, animated cards
- Reviews persist per-browser (localStorage); **admin removal** (hidden-ids)
- Single switch-point `submitReview()` in `lib/testimonials.ts` → becomes
  POST `/testimonials/` when the backend app is built (contract in MISSING-ENDPOINTS.md)
- Homepage success stories: fixed 404 link, added Share Your Story CTA

## Phase 7 — Dashboards (role-aware, live data)

- `/dashboard` reads the logged-in user's role and renders the right control room:
  - **Admin — Platform Control Panel**: live stats from `/admin/dashboard/`,
    **staff invite** (creates tutor/admin accounts), **deactivate/activate/promote**,
    announcements (create + publish), **feature flags** (admin/settings), **marketing
    campaigns** (send/pause/resume) — all wired to the real adminpanel endpoints
  - **Tutor**: `/instructor/dashboard/` + `/instructor/students/` — revenue ₦,
    enrollments, upcoming classes, student progress table
  - **Student**: learning dashboard (stats + courses, live data)
- Brand navy sidebar with role label; fixed dashboard layout syntax error + folder casing conflict
- Fixed `courses/[id]` build-time fetch for the live backend (real UUID pages now generated)

## Phase 8 — Content & Assets

- 5 course card images (downloaded, brand-aligned, verified per skill)
- 4 event images, 9 resource images, 6 blog images — all real, local, verified
- Kids Tech Academy logo discovered in the repo (`IMG-...jpeg`) → promoted to
  `public/kids-academy-logo.png`, featured on homepage + kids pages
- Legal pages written: Terms, Privacy (NDPA-tailored), Refund Policy, Cookie Policy
- FAQ page, blog with 6 real articles

---

## 🔴 WHAT REMAINS (tracked in PROGRESS.md)

1. **CODE EDITOR** — multi-language editor + JS runs offline in sandboxed iframe; other
   languages via backend execute endpoint; localStorage persistence
2. **WHITEBOARD** — working canvas draw tool + session API
3. **DESIGN EDITOR** — canvas shapes/text/colors
4. **EXCEL WORKSPACE** — formula grid, offline-capable
5. **LIVE CLASS** — classroom UI (join + tool tabs + recordings)
6. **CHAT** — WhatsApp-style messaging with polling (REST endpoints exist)
7. **Backend re-upload**: `apps/accounts/services.py` (register fix) — or fresh Desktop zip
8. **Paystack live keys** in .env + webhook URL in Paystack dashboard → money path opens
9. **SMTP provider** in .env → verification emails send (until then links print in stderr.log)
10. **Manual activation** of registered users until email works (Django admin → Users → Active)
11. **GSC verification token** in layout.tsx
12. Testimonial/newsletter/contact **backend apps** (contracts in MISSING-ENDPOINTS.md)

## ⚠️ GOTCHAS LEDGER (never relearn these)
1. Stop preview server BEFORE building (Windows out/ race)
2. cPanel regenerates default `passenger_wsgi.py` on app recreation (self-recursion crash)
3. httpx pin `>=0.27,<1.0`
4. Never use `#` inside .env values
5. `useSearchParams` in root layout breaks static export globally
6. healthz at `/healthz/`
7. New users are `is_active=False` until verified — activate manually or via email link
8. Register creates users with `role=student` by default — promote tutors in Django admin
