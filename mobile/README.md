# VaceUp Mobile (React Native, Android + iOS)

Expo (TypeScript) app for VaceUp Digital Academy learners: sign in, browse and
enroll in courses, complete lessons, read notifications, and open the
community-challenge portal with an access code. One codebase for Android and
iOS, sharing the exact backend contract the web client uses.

## Stack

- Expo SDK + expo-router (file-based navigation, typed routes)
- TypeScript strict mode
- zustand session store; JWT pair in `expo-secure-store` (never plain storage)
- Single silent token refresh on 401; field-level error normalization
- Feather vector icons; design tokens in `src/constants/theme.ts` mapped from
  the repo's `tokens/*.json` (navy/gold system)

## Screens (v1)

| Route | Purpose |
| --- | --- |
| `(auth)/login` | Sign in; guards the whole tabs area |
| `(auth)/register` | Account creation (verification notice, then sign in) |
| `(tabs)/home` | Dashboard stats + continue-learning cards |
| `(tabs)/courses` | Searchable catalog with pagination, enroll entry |
| `(tabs)/learn` | Enrolled courses with progress |
| `learn/[id]` | Course detail: modules, lessons, mark-complete, video link |
| `course/[id]` | Public course detail + free enrollment (paid checkout stays web for v1) |
| `(tabs)/alerts` | Notification inbox with read/mark-all |
| `(tabs)/profile` | Identity, challenge portal link, sign out |
| `challenge` | Challenge portal via email + six-digit access code |

Deferred (tracked, not built): in-app assessments/quizzes, messaging, in-app
Paystack checkout, tutor tools. In-app notifications move the email lifecycle
here incrementally.

## Run locally

```sh
cd mobile
npm install
npx expo start          # scan the QR with Expo Go, or press a for Android
```

The API base URL comes from `app.json` -> `expo.extra.apiBaseUrl`
(default `https://api.vaceup.ng/api/v1`). For local backend testing:
`EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8000/api/v1 npx expo start`.

## Production builds (Android + iOS)

```sh
npm install -g eas-cli
eas login
eas init                 # links this project to an Expo account (writes projectId into app.json)
eas build -p android --profile production   # produces the Play Store .aab
eas build -p ios --profile production       # requires Apple Developer access; produces the .ipa
eas submit -p android    # or upload manually to Play Console
```

Push notifications: after `eas init`, the Expo push token is captured on the
Home screen (`src/lib/notifications.ts`); a backend endpoint to store tokens
per device ships with the notifications milestone. Android push additionally
needs FCM credentials on the Expo account.

## Verification

```sh
npm run typecheck       # tsc --noEmit, strict
npm test                # jest: API client error normalization + silent refresh
npm run bundle-check    # metro export proves the whole app bundles
```

## Notes

- Challenge portal access is independent from the academy account (guest
  token in secure storage) and dies with the round, exactly like the web.
- Paid-course enrollment opens the website course page; keep the in-app
  purchase decision for when Paystack mobile flows are agreed.
- The auth guard lives in `src/app/_layout.tsx` and uses the session store,
  not per-screen checks, so deep links can never bypass it.
