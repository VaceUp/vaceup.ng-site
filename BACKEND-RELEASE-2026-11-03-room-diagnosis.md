# Backend release 2026-11-03 (2) — the room says why, and the Events page names its own fault

Three faults, one package.

1. The public **Events** page answers "The service is temporarily unavailable.
   Please try again shortly." That sentence is the frontend's translation of a
   server-side 500. This package makes the server print the real reason, in one
   line, on the machine where it is happening.
2. A **staff meeting** opens for the person who booked it and refuses a
   colleague, and the room blamed the network. It now states which of five
   things stopped the connection, and "Try again" gets a fresh key instead of
   re-offering an expired one.
3. The live room could never open on the deployed site, on any device or any
   network, because the site's own Content-Security-Policy did not allow the
   room's host. The browser blocked the connection and the room reported the
   block as "Failed to fetch", which reads like a dead network. The policy is
   corrected below; this is the cause of "even on personal internet".

The backend suite ran 562 tests and passed (3 skipped), `python manage.py check`
is clean apart from the pre-existing object-storage warnings, the frontend
type-checks, lints with warnings only and builds 67 pages. The room screens were
re-driven in a real browser at 280px, 320px, 390px, 414px and 1440px, and every
sentence quoted below is what the rendered page actually showed.

## Why the room failed on every network: the site's own security policy

`https://vaceup.ng` is served with this header, unchanged since before the live
room existed:

```
Content-Security-Policy: … connect-src 'self' https://api.vaceup.ng
  wss://api.vaceup.ng https://cdn.lordicon.com
  https://*.r2.cloudflarestorage.com https://api.cloudinary.com; …
```

The room's host is not on that list. The browser therefore refuses all three
things the room client needs:

| The browser tries | The policy says |
|---|---|
| `wss://vaceup-lfzis3dt.livekit.cloud/rtc/v1` (the signal socket) | refused |
| `https://vaceup-lfzis3dt.livekit.cloud/rtc/v1/validate` (the check after a failed socket) | refused |
| `https://vaceup-lfzis3dt.livekit.cloud/settings/regions` (edge selection) | refused |

`livekit-client` turns the refused `validate` fetch into `ConnectionError.
serverUnreachable('could not establish signal connection')` with the inner
`TypeError` text appended — so the screen reads **"Failed to fetch"**. That is
the exact sentence in the report. A policy block, a dead DNS name and a phone on
a train all produce that same sentence, which is why it looked like the network
for so long.

Measured, in one browser, with the same page, the same seat and the same room
host — only the policy changed:

| Policy | Console | Room band |
|---|---|---|
| The deployed one | `Connecting to 'wss://…/rtc/v1' violates … connect-src` plus the same for `validate` and `settings/regions` | *This site's own security policy is refusing the room server… Neither your internet nor this device is at fault* |
| The corrected one | no policy violation | reached the server; *The room server would not accept the key this page was given…* — the scratch key used for the test is not the academy's, so a refusal here is the correct answer and proof the route works |

The first run of that comparison happened before the page knew how to read the
browser's own refusals. It showed the generic network sentence with the reach
check underneath: *Check: this device cannot reach the room server even over
ordinary web, so a VPN, an ad-blocking DNS app or a proxy on this device is the
likely cause.* That line is right for a dead route and wrong for a policy block,
so the room now listens for the browser's `securitypolicyviolation` events. When
the refused address is the room's host, it replaces the sentence with the policy
line above and stops the automatic re-dial — a policy does not heal by waiting.
The re-dial ladder and the reach check still run for a genuinely dead route;
measured separately against an address that refuses connections: first named at
t+8.9 s, waits of 2, 5 and 12 seconds, settled at t+22 s, 12 sockets and then
stable, no overflow at 390px.

The correction is one line in `frontend/public/_headers`: add
`https://*.livekit.cloud wss://*.livekit.cloud` to `connect-src`, and add
`https://meet.jit.si` to `script-src`, `connect-src` and `frame-src`. Nothing
else in the policy is loosened.

### The Jitsi room was blocked by the same header

Measured at 390px with an event on the Jitsi provider:

| Policy | What the page showed |
|---|---|
| The deployed one | `Loading the script 'https://meet.jit.si/external_api.js' violates … script-src`; the page fell back to *The room is not showing inside this page.* |
| The corrected one | no violation; the iframe mounted (`https://meet.jit.si/vaceup-Cohort-7-Masterclass-…#jitsi_meet_external`) and the page read *You are in as Amara Testseat.* |

No horizontal overflow in either run.


## The Events page: what the probe says

Probing the live API from here:

| Request | Answer |
|---|---|
| `/api/v1/website/events/` | **500** |
| `/api/v1/website/events/?page=1` | **500** |
| `/api/v1/website/events/nope/` (a slug that does not exist) | **500**, not 404 |
| `/api/v1/website/team/` | 200 |
| `/api/v1/courses/` | 200 |
| `/api/v1/meetings/readiness/` | 401 (sign-in required, correct) |

That pattern matters. A request for an event that does not exist should be a 404,
and getting a 500 instead means the database query itself fails **before** any row
is read. So it is not the page's code and not an event's data — it is the
`website_event` table not having a column the code asks for. `website` migrations
`0007_event_live_room_and_join_token`, `0008_event_jitsi_room_secret` and
`0009_eventregistrant_broadcast_marker` add exactly those columns
(`live_platform`, `room_name`, `room_secret`, `join_token`, `join_link_sent_at`,
`broadcast_sent_at`), and `migrate website` was not in the last set of commands.
MySQL answers "Unknown column" and Django turns that into the 500 you see.

The package proves this rather than asserting it: `diagnose_live_rooms` reads the
server's own migrations table and, if any of those are unapplied, prints which
ones and the command that fixes it.

## What the first run on the server showed

The command was run on this deployment and it answered both questions:

```
LIVEKIT_API_KEY: set (15 characters)
LIVEKIT_API_SECRET: set (44 characters)
LIVEKIT_WS_URL: set (35 characters)
The browser dials: wss://vaceup-lfzis3dt.livekit.cloud
Token mints and verifies against this secret (room vaceup-diagnostic-room, valid 300 seconds).
website: 2 of 9 migrations are not applied (0008_event_jitsi_room_secret, 0009_eventregistrant_broadcast_marker). Run: python manage.py migrate website
meetings: all 1 migrations applied.
Staff meetings: ready.
```

`python manage.py migrate website` applied those two, and the public Events page
then answered `200` with its list and `404` for an event that does not exist —
which is the correct pair, and exactly the missing-column fault described above.
No LiveKit line had to change.

The first run also printed `HTTP 301` for both request lines instead of the answer.
That was the probe, not the site: it asked over plain `http` and this deployment
redirects `http` to `https`. The probe now asks over `https`, so those two lines
report `200` and `401` as they should. Nothing about the site needed changing.

## `python manage.py diagnose_live_rooms`

One read-only command that answers both faults on the box, in plain lines. It
prints no key, no secret, no room code and no attendee token — only whether each
setting is set and how long its value is.

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
python manage.py diagnose_live_rooms
```

What a healthy server prints (this is real output from a local run of the same
code with no LiveKit lines set):

```
LIVEKIT_API_KEY: NOT SET
LIVEKIT_API_SECRET: NOT SET
LIVEKIT_WS_URL: NOT SET
Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL to the server's .env file, then restart the app.
The browser is given no address, so no room can open. This is what the meeting and event screens refuse with.
Token check skipped: the settings above are not complete.
website: all 9 migrations applied.
meetings: all 1 migrations applied.
/api/v1/website/events/ -> HTTP 200
/api/v1/meetings/readiness/ -> HTTP 401 (sign-in required, as expected)
Staff meetings: Meetings are not switched on for this academy yet. Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_WS_URL to the server's .env file and restart the app.
```

Read it bottom-up: the last three lines are what the website asks the server for,
the two `migrations applied` lines are whether the tables exist, and the top lines
are whether a room can open at all. Where something is wrong the line says what
to do next, and when the Events request fails the full Python traceback is printed
under it — that traceback is the thing to paste if the answer is not obvious.

It also previews a `.env` value without writing it anywhere:

```
python manage.py diagnose_live_rooms --check-url "https://your-project.livekit.cloud"
```

```
You wrote:   https://your-project.livekit.cloud
The browser would dial: wss://your-project.livekit.cloud
```

## Before you deploy: `check` now warns about the room line

`python manage.py check` says out loud what used to only appear as a broken room:

- `core.W010` — `LIVEKIT_WS_URL` is set but a browser cannot dial it (angle
  brackets left in from a guide, a pasted sentence, quotes, a trailing comment, a
  bad port). The hint writes the correct form.
- `core.W011` — the two LiveKit keys are present but the address line is not, so
  the keys alone will not open a room.
- `core.W012` — the address is dialable but is a plain `ws://` socket, which a
  page served over `https://` refuses.

Also in this package: `livekit_ws_url()` can no longer raise. It used to be
possible for one bad value to be parsed while the public Events page was being
built; now an unusable value is treated as "not configured" and the page still
lists, with the join band explaining that the room is not switched on.

## The room that blamed the internet

`https://vaceup.ng/meeting/?meeting=<id>` and the event room now translate the
LiveKit failure into the thing that actually stopped it, and keep the client's own
words underneath in small type (`What the room reported: …`) so the sentence can
be checked against reality:

| The room says | What it means |
|---|---|
| The room server would not accept the key this page was given, so your seat did not open. Press **Try again** to be given a fresh one. | The token expired or the key/secret pair is not from one LiveKit project. |
| …the video path did not open in time, which is what a slow or heavily filtered network looks like… | The server answered, the media path did not. |
| This device could not reach the room server at all. Work, school and hotel networks often block video calls — try again on mobile data. | The socket never opened — a firewall or a blocked port, not the academy. |
| The line to the room server closed before the meeting started… | Connected, then dropped. |
| The room server refused to open this room… the academy needs to check its LiveKit project. | LiveKit itself said no — project settings, or the room's own limits. |

**Try again** re-asks the server for a seat rather than re-dialling with the one it
already had. A token is minted when the person presses the button and it expires,
so re-using it made the button a dead control that blamed the network for a stale
key. Verified in a live browser: two presses produced two different tokens
(`…BCwJ1JHc`, then `…B8WUiicM`).

## A poor connection is now expected, not fatal

Defaults were a single attempt and 15 seconds before the browser gave up on the
video path. The room now dials with `maxRetries: 3`, a 30-second peer-connection
timeout and a 30-second socket handshake — a handshake that takes twenty seconds
over a thin link is still a handshake, not a failure. It also resolves the room
server's name and opens TLS while the person is still reading the screen, so the
first dial does not pay for both.

A socket that looks like a flaky link — the server called unreachable, a timeout,
a socket that died — is re-dialled on the room's own initiative after **2, then 5,
then 12 seconds**, with the wait written on screen (*This screen is also dialling
again in 5 seconds*). After the third wait the ladder stops and leaves the
sentence and **Try again**, so a link that stays down cannot loop. Pressing
**Try again** restarts the ladder from the beginning. Measured in a real browser
against a deliberately dead address: the first failure was named at t+8.9 s, the
three waits ran, and the screen settled on the plain sentence at t+22 s with the
socket count stable afterwards.

For a thin link the room adds two controls:

- A notice across the top while the call is up — *the connection to the room has
  dropped out* — with **Keep audio only**.
- **Keep audio only** in the footer (it reads **Show video** again after) stops
  sending and receiving video tracks and keeps the conversation. Audio needs a
  fraction of the bandwidth, so a call that will not carry ten tiles of video
  still carries voices.

The capture buttons are disabled while the room is offline rather than looking
pressable and doing nothing.

### The message now says which layer failed

"Could not reach the room server" hid two different faults: this device cannot
reach the host at all, or it reaches the host while the live socket alone is
filtered. When the socket is labelled unreachable the room fetches the same
host's front door over ordinary https — any answer, even an error page, proves
the route works. The band then adds one line:

| What the check found | Line under the sentence |
|---|---|
| The front door answered | *Check: this device reaches the room server over ordinary web, so the live connection itself is what is being blocked.* |
| The front door did not answer | *Check: this device cannot reach the room server even over ordinary web, so a VPN, an ad-blocking DNS app or a proxy on this device is the likely cause.* |
| The browser's own policy refused the host | Neither line. The main sentence becomes *This site's own security policy is refusing the room server…* and the re-dial ladder is cancelled. |

That line is how the next report names the layer instead of repeating "it does
not work". Verified rendered at 280px, 320px, 390px, 414px and 1440px against a
dead address: the "cannot reach" line appeared, the band had no horizontal
overflow at any of the five widths, and the raw host message stayed below it.

## The `.env` lines (paste these yourself — nothing in this package edits that file)

`/home/coqrpund/vaceup_api/.env` stays yours. The only line this release needs is
the one that was missing. Paste it as **one line, no angle brackets, no quotes, no
trailing comment**:

```
LIVEKIT_WS_URL=wss://your-project.livekit.cloud
```

Put your own project address in place of the placeholder; LiveKit Cloud prints it
on the same page as your API key and secret. The `https://` form the dashboard
shows also works — the server converts it before the browser sees it — and so does
a bare host. `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` stay as they are. Change
nothing else in the file and delete nothing.

## Install

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
```

Upload `vaceup-backend-2026-11-03-room-diagnosis.zip` to `/home/coqrpund/`, then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-03-room-diagnosis.zip -d vaceup_api
cd vaceup_api
python manage.py diagnose_live_rooms
```

Read that output before you migrate anything. If it names unapplied `website`
migrations, that is the Events page:

```
python manage.py migrate website
python manage.py migrate meetings
python manage.py check
```

`migrate meetings` is only needed if the previous 2026-11-03 package has not been
migrated yet; both commands only add what is missing and no command here touches
an existing row. `check` should end with `System check identified no issues
(0 silenced).` apart from the pre-existing object-storage warnings — and now, if
the LiveKit address line is missing or malformed, one of `core.W010`–`W012`.

Then restart the app (cPanel → Setup Python app → Restart) and run
`python manage.py diagnose_live_rooms` once more. It should end with
`/api/v1/website/events/ -> HTTP 200` and `Staff meetings: ready.`

No new packages on either side. The token is minted with PyJWT, already installed;
the LiveKit SDK is still not used on the server; in the browser the room is built
on `livekit-client`, already a frontend dependency.

## Prove it

1. Open `https://vaceup.ng/events/`. It should list events. If it still says
   *temporarily unavailable*, run `python manage.py diagnose_live_rooms` and read
   the traceback under the Events line — that is the answer.
2. Book a meeting as the administrator, and have the colleague open it from their
   own sign-in. If the room does not open, the red band now names a reason. Tell
   me which of the five sentences it shows; each one points at a different fix, and
   that is the difference between a one-line change and a long search.
3. Press **Try again** once. If the sentence repeats with the same wording, it is
   not the network and not an expired key.

## What is in the archive

Seven files, all inside `apps.core`, `apps.liveclasses` and `apps.website` — no
models change, so `migrate` only ever adds what is missing.

| File | What it does |
|---|---|
| `apps/core/management/commands/diagnose_live_rooms.py` | new — the one-read diagnosis |
| `apps/core/checks.py` | `core.W010`–`W012` room-address warnings |
| `apps/liveclasses/livekit.py` | the address is repaired, or treated as missing; it can no longer raise |
| `apps/core/test_live_room_config.py` | new — 12 tests for the checks and the command |
| `apps/liveclasses/tests/test_liveclasses.py` | seven malformed addresses must not take the events page down |
| `apps/website/test_event_live.py` | the public list still builds with an unreadable address |
| `BACKEND-RELEASE-2026-11-03-room-diagnosis.md` | this file |

The frontend deploys on its own from `master` through Cloudflare Pages, so the
five reason sentences, the fresh-key retry, the automatic re-dial ladder, the
reachability check and the audio-only controls are live within a few minutes of
the push — whether or not this zip is unpacked yet.

## What was not verified here

The room's audio-only path and the dropped-connection notice were built against
the `livekit-client` 2.23 API and type-check and build, but no LiveKit server is
reachable from this machine, so they could not be exercised over a real call. The
re-dial ladder and the reachability line were exercised in a real browser against
a deliberately unreachable address at 280px, 320px, 390px, 414px and 1440px.
Everything else quoted above — the check output, the diagnosis lines, the reason
bands, the two fresh tokens — was run.
