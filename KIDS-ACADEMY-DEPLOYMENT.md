# Kids Academy deployment

The kids experience is a separate static Next.js application in `kids-academy/`.
It deploys to its own Cloudflare Pages project and custom domain `kids.vaceup.ng`.
The main website is only a link to that domain, so a frontend outage on one site does not take down the other.

## Shared services

- `api.vaceup.ng` remains the single backend and admin source of truth.
- Kids programmes are loaded from the published `Kids Tech Academy` category.
- Parent portal links hand off to the existing VaceUp account and student dashboard.
- No kid-specific credentials or database are duplicated in the frontend.

## Cloudflare Pages

The independent workflow is `.github/workflows/deploy-kids-cloudflare.yml`.
It runs only when `kids-academy/` changes. Add the repository variable
`CLOUDFLARE_KIDS_PAGES_PROJECT` if the Pages project is not named
`vaceup-kids-academy`. The existing `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets are reused.

Build variables are already supplied by the workflow:

```text
NEXT_PUBLIC_API_URL=https://api.vaceup.ng/api/v1
NEXT_PUBLIC_KIDS_SITE_URL=https://kids.vaceup.ng
NEXT_PUBLIC_MAIN_SITE_URL=https://vaceup.ng
NEXT_PUBLIC_PORTAL_URL=https://vaceup.ng/login?next=%2Fdashboard%2F
```

## Backend origin allow-list

Add `https://kids.vaceup.ng` to the live backend values for both
`CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, then restart the Django
application. The example and Kubernetes configuration in this repository
already include the new origin.

## Local preview

```text
cd kids-academy
npm ci
npm run dev
```

The local app uses `http://localhost:3001`. If the local backend is enabled,
set `NEXT_PUBLIC_API_URL` to its API origin in `kids-academy/.env.local`.
