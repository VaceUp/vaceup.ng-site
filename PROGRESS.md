# VaceUp Platform — Progress Log & Handoff

**Last updated:** 6 September 2026
**Repo:** `github.com/VaceUp/vaceup-ng-site` (master, auto-deploys frontend to vaceup.ng)
**Latest commit:** `4d6b34d`

---

## 🟢 LIVE RIGHT NOW

| Piece | URL | State |
|---|---|---|
| Frontend (marketing + student tools) | https://vaceup.ng | ✅ Live, auto-deploys on push to master |
| Backend API (Django on Truehost) | https://api.vaceup.ng | ✅ Live — Django answering, DB connected |
| Backend health check | https://api.vaceup.ng/healthz/ | ✅ JSON (NOTE: at root, not /api/v1) |
| Django admin (full control) | https://api.vaceup.ng/admin/ | ✅ `vaceupacademy@gmail.com` (promoted to superuser) |
| API docs (Swagger) | https://api.vaceup.ng/api/docs/ | ✅ |

## ✅ COMPLETED

### Marketing site (vaceup.ng) — PRD §4 complete
- Homepage: TopBar (phone/email/WhatsApp/socials), hero (Explore Courses + Watch How It Works),
  trust stats (30/5/8/98%/3 — the ONLY stats band), Featured Courses with Enroll+View buttons,
  Why VaceUp (icons turn white on navy hover), Kids Academy section, Success Stories,
  How It Works (6-step admission), Insights & Guides blog section, Final CTA, footer
  (name+email newsletter capturing marketing leads to localStorage `vaceup_newsletter_leads_v1`,
  real social handles, legal links)
- Header: TopBar, sticky nav, **hamburger auto-closes on navigation**, active link states
- Brand system: single token source in `globals.css` @theme (Navy #00088A, Teal #008B8B, Gold #FFC72C),
  no gold glow on buttons, no rainbow gradients (only Kids keeps playful colors)
- SEO: robots.txt, sitemap.xml, OpenGraph, GSC verification slot in layout
  (⚠️ replace `REPLACE_WITH_GSC_VERIFICATION_TOKEN` in `layout.tsx` when GSC is set up)
- Loader: V-monogram draws end-to-end + gold progress bar on page navigation
  (ⓘ the in-browser "black screenshot" issue during testing was a background-tab artifact, not a bug)

### Pages (all built, 78/78 internal links resolve, zero dormant buttons)
- Courses list (canonical 5 courses, live catalog w/ fallback) + course detail pages 1–5
- Apply (4-step wizard, register-before-pay gate, ?course= preselect, submits to live API)
- Terms / Privacy / Refund Policy / Cookie Policy (NDPA-tailored)
- FAQ, Forgot Password (wired to live reset endpoint), Contact (mailto until contact endpoint exists)
- Testimonials + Reviews: **working review system** — photo upload+resize, star rating, role,
  course, outcome; persists per-browser; admin can remove reviews (hidden-ids mechanism);
  single switch-point `submitReview()` in `lib/testimonials.ts` when backend ships
- Blog: 6 full articles (shared data in `src/data/posts.ts`), article pages, search/filter
- Checkout: /checkout (order summary, register gate, Paystack initialize → Inline fallback),
  /payment/success (verifies via API), /payment/cancel
- Certificate verification: /verify?code= → calls live GET /api/v1/verify/<code>/ (endpoint EXISTED)

### Auth (live + verified)
- Register / login / JWT — **login endpoint confirmed working** (401 on bad creds = correct)
- **Registration 500 bug FIXED (commit 4d6b34d)**: verification-email queue failure no longer
  crashes signup. ⚠️ **The fixed file `apps/accounts/services.py` still needs re-uploading to
  Truehost** (File Manager → replace that one file → restart app), OR re-upload the fresh
  Desktop zip `vaceup-backend-upload.zip`
- User roles from backend: `admin | instructor | student`

### Dashboards (role-aware, live data) — commit 7fee7e9
- `/dashboard` renders by role:
  - **Student**: stats, my courses, progress (live dashboard API)
  - **Tutor**: /instructor/dashboard/ + /instructor/students/ — revenue ₦, enrollments,
    upcoming classes, student progress table
  - **Admin — Platform Control Panel**: overview stats (users/courses/enrollments),
    **staff invite** (creates tutor/admin accounts), **deactivate/activate/promote** by user id,
    announcements (create + publish via /admin/announcements/), **feature flags**
    (admin/settings key-value), **marketing campaigns** (send/pause/resume)
- Brand navy sidebar, role-labeled, mobile responsive

### Security done
- CORS locked to vaceup.ng domains; HSTS/CSP headers (Cloudflare `_headers`); ACAO:* removed
- JWT unique references; payments idempotent (unique reference, idempotent verify/enroll/webhook)
- Email queue failures isolated — signup never crashes on mail problems (commit 4d6b34d)

---

## 🔴 REMAINING — Platform builds (the 4 big ones)

### 1. CODE EDITOR (PRD §6) — highest value
- Current `/codeeditor` is a shell. Build: multi-language editor (suggest `@uiw/react-codemirror`),
  **JavaScript runs offline in a sandboxed iframe** (works on bad networks),
  other languages → backend POST `/code-editor/sessions/{id}/execute/` (backend route exists),
  localStorage persistence (launch before/during/after class), backend session API exists
- Backend code-execution sandbox service (PRD §6.4) — verify it exists server-side

### 2. WHITEBOARD + DESIGN EDITOR + EXCEL WORKSPACE (offline-tolerant)
- `/whiteboard`: replace shell with working canvas draw tool (strokes saved via
  `/whiteboard/sessions/` API — routes exist)
- NEW `/design`: UI/UX design canvas (shapes, text, colors, export)
- NEW `/excel`: formula grid (SUM/ranges/=A1+B1), localStorage persistence — build custom, no deps
- All must work on unstable connections (PRD: poor-network Nigeria)

### 3. LIVE CLASS + CHAT (PRD §5, §9)
- `/liveclasses` upgrade: classroom UI — join button (external Meet/Zoom per default provider,
  LiveKit when keys set), **tool tabs during class** (launch code editor/whiteboard/excel),
  **recordings** via `/live-classes/{id}/recording/` (route exists)
- Tutor workspace follow + auto-recordings need the backend/LiveKit config — UI first
- CHAT: rebuild `/messaging` WhatsApp-style (chat list, bubbles, timestamps, read receipts,
  attachments) with live polling of `/messages/`, `/messages/thread/`, `/messages/unread-count/`
  (all routes exist — REST polling, no websockets needed on shared hosting)

### 4. Testimonials/Newsletter/Contact BACKEND apps
- Reviews currently per-browser; newsletter leads in localStorage; contact is mailto.
- Backend has NO testimonials/newsletter/contact apps yet — build them server-side
  (contracts documented in MISSING-ENDPOINTS.md), then flip the 3 switch-points
  (`submitReview()`, footer `handleSubscribe`, contact form submit)

---

## 🟡 SMALL OPEN ITEMS
- [ ] Paystack **live keys** in `.env` (PAYSTACK_SECRET_KEY/PUBLIC_KEY) + webhook URL
      `https://api.vaceup.ng/api/v1/payments/webhook/` in Paystack dashboard → money path opens
- [ ] Email SMTP provider (any Postmark/SES/Gmail app-password) in `.env` → verification emails send
      (until then: verification links print in `stderr.log` — searchable by "token")
- [ ] GSC verification token in `frontend/src/app/layout.tsx`
- [ ] Social handles: verified real. X/Twitter removed (no handle yet)
- [ ] Kids site: separate repo/folder, future subdomain kids.vaceup.ng — this site's kids links
      point via ONE constant: `SITE.kidsUrl` in `src/lib/site-config.ts` (flip when live)
- [ ] weasyprint PDF certificates won't run on cPanel (needs system libs) — swap to a
      pure-Python PDF renderer (e.g. xhtml2pdf) or use the HTML verify page
- [ ] localStorage marketing leads (`vaceup_newsletter_leads_v1`) — collect from real visitors
      once site is promoted, or import into the marketing app

## 🔑 KEY ACCESS POINTS
| What | Where |
|---|---|
| Frontend | vaceup.ng (Cloudflare Pages, push-to-deploy from master) |
| Backend API | api.vaceup.ng (Truehost cPanel, app `vaceup_api`, Python 3.12) |
| Django admin | api.vaceup.ng/admin (vaceupacademy@gmail.com — superuser) |
| Deployment guide | TRUEHOST-DEPLOYMENT-GUIDE.md (root) — 2-min redeploy recipe at bottom |
| Endpoint audit | MISSING-ENDPOINTS.md (root) |
| Brand tokens | frontend/src/app/globals.css (@theme block) |
| Social links | frontend/src/lib/site-config.ts |
| Deploy zip builder | python script pattern: zip backend/ EXCLUDING .env, __pycache__, db.sqlite3, tests |

## ⚠️ DEPLOYMENT GOTCHAS LEARNED (don't relearn the hard way)
1. **Never build the frontend while a preview server holds `out/`** — Windows gives a
   half-deleted out/ and the build silently exports nothing. Stop server → build → serve.
2. **cPanel recreating the Python app overwrites `passenger_wsgi.py` with a self-loading
   template** (infinite recursion → Passenger 500). If you see 500 with "have occured" typo
   page: re-paste the real passenger_wsgi.py (2 lines: DJANGO_SETTINGS_MODULE + from config.wsgi).
3. httpx pin: `>=0.27,<1.0` (1.0 doesn't exist yet)
4. `.env` values containing `#` get truncated — never use `#` in SECRET_KEY values
5. `useSearchParams` in the root layout breaks static export for ALL pages
6. healthz is at `/healthz/` NOT `/api/v1/healthz/`
