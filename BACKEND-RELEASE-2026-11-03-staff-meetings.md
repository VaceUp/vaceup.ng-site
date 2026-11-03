# Backend release 2026-11-03 — staff meetings held inside VaceUp

An administrator or a tutor books a colleague into a call and the call happens in
the platform: no Meet link is traded, no outside account is needed, and the room's
private name is never printed anywhere. The room is a LiveKit room, so it runs on
the LiveKit project your keys already point at.

This package also carries the fix for the failure a booked meeting hits when the
server never told the browser where to dial — read **The room that would not
open** below before you restart the app, because it needs one line in `.env`.

Everything below was verified on this machine before it was committed: the backend
suite ran 547 tests and passed (3 skipped), the frontend type-checks and builds with
no errors (67 pages, compiled in 27.9s) and lints with warnings only, and the whole
flow — booking, the invitation in the mail relay, both dashboards, the meeting page
and the live room — was driven through a real browser at 1440px and 390px. The two
room-address cases below were then re-driven in a live browser against a real server,
and every sentence quoted here is the text the rendered page actually showed.

## Install this after the 2026-11-02 package

This archive depends on it. The meeting API raises its refusals through
`apps.website.join.JoinDenied` and mails invitations through
`apps.accounts.mail_delivery`, both of which arrived in the Jitsi and bulk-mail
release. If that one is already unpacked on the server, you are fine. If it is
not, deploy `vaceup-backend-2026-11-02-jitsi-and-bulk-mail.zip` first.

## What is in it

**A new app: `apps.meetings`.** Two tables — `Meeting` (title, agenda, host, start,
length, status) and `MeetingParticipant` (who was invited, when the invitation went
out, when they walked in). Migration `0001` creates both and touches nothing else.

**Nobody outside the meeting can guess the room.** LiveKit guards a room by its
name, so the name carries a random code that nobody outside the meeting has:
`vaceup-meeting-<id>-<code>`. That name is never serialized to the frontend, never
rendered on a page and never written into an email. What a person gets instead is a
short-lived token that the server mints from their own account, and the only door is
`https://vaceup.ng/meeting/?meeting=<id>`.

**Who may enter, and when.** The room opens 15 minutes before the booked hour and
closes 30 minutes after it ends, so an early arrival is not locked out and a call
that runs long is not cut. The person who booked it is never locked out — they can
open it early to check it and get back in after the window if the call simply ran
long. Anyone removed from the invitation list loses access immediately, because
being on that list *is* the access.

**The invitation is an email and a dashboard entry.** Each person you choose gets
one plain-text email — subject `Meeting invitation: <title>` — carrying the title,
the day and time, the length, the agenda if you wrote one, and the link above. If
the relay refuses an address, the screen says which one rather than claiming a mail
went out: `Mailed: Chidi Tutor.` or `Could not mail: Ada Okonkwo — they still see
the meeting in their dashboard.` The meeting is in their dashboard either way.

**Calling it off tells people.** **Call it off** cancels the meeting and emails
every invitee (`Called off: <title>`). **End the meeting** just closes the door so
nobody can walk back into a finished call; the screen spells that difference out.

**Readiness is said up front.** If the server cannot open a room, the Staff
meetings screen opens with a sentence naming the exact `.env` line that is missing —
for instance
`Meetings are not switched on for this academy yet. Add LIVEKIT_WS_URL to the server's .env file and restart the app.`
— and adds that bookings still work, so an unset-up server does not read as a broken
meeting.

## The room that would not open

The first cut of this release tested only the two LiveKit keys. A server carrying
the keys but no room address therefore answered "ready", handed the browser an
empty address, and the person who pressed **Open the room** got the LiveKit
client's own words in a red band:

```
The live room could not be reached (Failed to construct 'URL': Invalid URL).
```

That is library text, so it names nothing the academy can act on. This package
replaces it at each of the three layers:

- **The address is repaired before it leaves the server.** `LIVEKIT_WS_URL` may be
  written `wss://your-project.livekit.cloud`, `https://your-project.livekit.cloud`
  (which is what the LiveKit dashboard prints) or a bare host. An `https://` value
  becomes `wss://` and a bare host is given the `wss://` prefix, so the browser
  always receives a socket address. Anything that cannot be a host at all — a
  blank, a stray sentence, an `ftp://` value — counts as missing rather than being
  passed through.
- **A missing address now means the room is not switched on.** The three places
  that previously looked only for the keys — staff meetings, an event's VaceUp Live
  Room, and live-class breakout rooms — check the address as well, and each of them
  names the line to add.
- **The browser stops quoting the library.** If the server hands out an address the
  browser genuinely cannot dial, the room says so in one line and leaves **Try
  again** on the screen; a real connection failure reads "The live room could not be
  reached. Check your connection, then press Try again." The client's own error
  text now goes to the browser console, where it is useful to whoever is fixing the
  server.

## Where it is on screen

The frontend deploys on its own from `master`, so these are already live:

- The admin navigation, under *Communications*, has a **Staff Meetings** entry.
  A learner who opens it is told meetings are for the academy's own people and to
  use My courses for their live classes.
- **Book a meeting** opens the form: *What is the meeting called*, *What you want
  to cover (optional)*, *Starts (your timezone)*, *How long, in minutes*, and a
  picker titled *Who is in the room (N chosen)* listing every other active admin
  and tutor. **Book it and mail the invitations** does both at once.
- Each row in the list says who booked it, the window, who is invited and whether
  each of them has walked in — `Walked in` with the date and time, `Invited, not in yet`, or
  `In the meeting, but the invitation email did not go out`.
- **Open the room** takes the host or an invited colleague into the VaceUp Live
  Room: mute, camera off, screen share, leave, a self view and a participant grid.
  The header says `Opening the room…`, then `Hosting · 3 people` or `In the room ·
  3 people`, and if the connection drops it says so and reconnects instead of
  going blank.

## One line to add to `.env`

The `.env` file stays yours to edit — this is the text for you to paste, and it is
one new line only. Open `/home/coqrpund/vaceup_api/.env` and add:

```
LIVEKIT_WS_URL=wss://your-project.livekit.cloud
```

Put your own project address where the placeholder is. LiveKit Cloud prints it on
the same project page that lists your API key and secret. If what you have reads
`https://your-project.livekit.cloud` instead, paste that — this release converts an
`https://` value into `wss://` before the browser sees it, and a bare host gets the
`wss://` prefix, so all three forms work.

This is the line that was missing when a booked meeting refused to open. Without
it the booking still saves, the invitation still mails, and the screen reads
`Meetings are not switched on for this academy yet. Add LIVEKIT_WS_URL to the server's .env file and restart the app.`
rather than opening an empty room.

`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` stay exactly as they already are;
`apps.meetings` reads the same three lines that live classes already use. If a key
is missing as well, the same sentence names every missing line at once.

Two further lines are worth adding because they make the join window a setting
instead of a default. These *are* the defaults, so the app behaves identically
without them:

```
MEETING_LEAD_MINUTES=15
MEETING_GRACE_MINUTES=30
```

Do not change any line that is already in `.env`, and do not delete anything.

## Install

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
```

Upload `vaceup-backend-2026-11-03-staff-meetings.zip` to `/home/coqrpund/`, then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-03-staff-meetings.zip -d vaceup_api
cd vaceup_api
python manage.py check
python manage.py migrate meetings
```

`python manage.py check` should print `System check identified no issues (0 silenced).`
(A pre-existing warning about partly-configured object storage is not this release.)

`python manage.py migrate meetings` should print

```
Applying meetings.0001_initial... OK
```

It creates two new tables. It does not touch an existing row anywhere else.

Then restart the app (cPanel → Setup Python app → Restart).

No new package is needed on either side. The token is minted with PyJWT, which is
already installed for the rest of the API; the LiveKit SDK is not used on the
server at all. In the browser the room is built on `livekit-client`, which has been
a frontend dependency since the live-classes work and ships in the bundle.

This pass also replaces four files outside `apps.meetings` —
`apps/liveclasses/livekit.py`, `apps/liveclasses/services.py`,
`apps/liveclasses/views.py` and `apps/website/join.py` — because the same address
feeds live classes and event rooms. None of them changes a model, so
`migrate meetings` remains the only database step.

## Prove it reached the server

1. Sign in as an administrator, open **Staff Meetings**. If the screen opens with
   `Meetings are not switched on for this academy yet`, it names the `.env` line
   that is missing — add exactly that line, restart, and the band goes away before
   you go on.
2. Press **Book a meeting**, give it a name, set a start time a few minutes out,
   tick a tutor and send. It should answer `Booked. Mailed: <their name>.` If it
   says `Could not mail:` instead, the meeting still exists and shows in their
   dashboard, but run `python manage.py diagnose_email_delivery --send-test` and
   read what the relay says.
3. Sign in as that tutor. The meeting is in their **Staff Meetings** list and the
   invitation is in their inbox. Once the window opens, **Open the room** should
   fill the screen and show both of you.
4. Book a second meeting and press **Call it off**. The invitee should receive
   `Called off: <title>`.
5. If a room still will not open, ask the server what address it is handing out:

   ```
   python manage.py shell -c "from apps.liveclasses.livekit import livekit_ws_url; print(livekit_ws_url())"
   ```

   It prints the line a browser dials. A `wss://…` value is correct even when
   `.env` holds the `https://…` form the LiveKit dashboard shows, and a bare host
   comes back with the `wss://` prefix already on it. A blank line means the value
   is not being read at all, which is exactly what the Staff meetings band is
   telling you.

## The API behind it

All under `/api/v1/meetings/`, all requiring a signed-in account. A person only
ever sees meetings they host or were invited to.

| Call | What it does |
|---|---|
| `GET /meetings/readiness/` | whether this server can open a room at all |
| `GET /meetings/colleagues/` | the admins and tutors who may be invited (staff only) |
| `GET /meetings/` | my meetings, paginated |
| `POST /meetings/` | book one: `title`, `agenda`, `starts_at`, `duration_minutes`, `invitees` |
| `PATCH /meetings/<id>/` | change it (host only, while it is still scheduled) |
| `POST /meetings/<id>/token/` | the LiveKit credentials for this person |
| `POST /meetings/<id>/end/` | close the room |
| `POST /meetings/<id>/cancel/` | call it off and mail everyone invited |

A booking takes up to 25 invitees. `duration_minutes` is 5 to 480.

## What ships on the website side

The frontend is not in this archive. It deploys on its own from `master` through
Cloudflare Pages as soon as the commit is pushed, so the room's two new sentences,
the Staff meetings guide line and the event form's LiveKit hint are live within a few
minutes of the push — whether or not you have unpacked this zip yet.

Either half on its own behaves. With the new frontend and the old backend, an empty
address now reads `This server is not giving out a room address the browser can dial,
so the meeting cannot open. The academy needs its LiveKit settings checked.` instead
of the library's `Invalid URL`. With the new backend and the old frontend, the server
refuses before the browser has to guess, and repairs the address when it can. Paste
the `.env` line, unpack the zip, restart, then reload the admin.
