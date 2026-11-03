# Backend release 2026-11-03 (3) — the hundred-seat room, the workspace, and mail that says when it cannot send

This package carries the server half of the new live room: every attendee can
publish, a raised hand survives a late join, the registration answer tells the
truth about email, and the admin Events screen can see whether this server can
send mail at all.

The frontend deploys on its own from `master`. The room itself — the gallery,
the stage, the workspace, the sound banner — is in that deploy. Unpack this
package for the server changes listed at the end.

## What the room now does

- **A hundred people, without a wall of faces.** Up to twelve tiles per page, a
  pager that says `1–12 of 104`, and a stage with a filmstrip. **Show everyone**
  is the first filmstrip control, so it cannot scroll out of reach when the
  strip is full. Measured in a real browser with 101 seats in one room: twelve
  tiles, the pager, the stage and no horizontal overflow at 1440, 414, 390, 320
  and 280 pixels.
- **A workspace, not just a video call.** Shared board, shared notes and class
  materials sit beside the video on a desktop and open as a full-screen sheet on
  a phone. Chat, raise hand and reactions use the same data channel. Two real
  peers were driven against a local LiveKit server, not a mock: a tutor's chat
  arrived named, a raised hand appeared on the learner's header, a board drawn
  by the tutor arrived whole on a learner who joined afterwards (1222 painted
  pixels on both, then 2117 after one more live stroke), and notes typed by the
  tutor appeared on the learner's screen.
- **Everyone can speak, show a camera and share a screen.** A student's seat is
  now minted with publish rights, exactly like the tutor's. A class is a
  conversation and a whiteboard, not a broadcast.
- **A raised hand survives a late join.** The hand is written into the
  participant's own metadata, so the server grant now includes
  `canUpdateOwnMetadata`; without it LiveKit refused the write and only people
  already watching saw the hand.

## The silent call: "camera works, voice does not"

The room asked the client library whether audio was playing. That library can
report playback as started once `startAudio()` settles even while the browser
has kept the audio graph suspended — the exact state behind a call you can see
but not hear. The room now checks the audio graph itself:

```ts
const graph = (live as unknown as { audioContext?: AudioContext }).audioContext;
if (graph && graph.state !== 'running') return true;
return !live.canPlaybackAudio;
```

When the graph is suspended the room shows a strip with one gold action:

> Your browser has paused the room's sound, so you can see people but not hear
> them. Press Enable sound.

Any tap or keypress also unlocks sound, so a person who presses a footer control
does not have to find the banner. Verified with two live peers — the tutor
publishing a microphone and the learner's playback deliberately withheld: the
strip appeared at 1440 and 390 pixels with no overflow, and cleared as soon as
the action was pressed. Before this change the same run never showed the strip.

## The board

Two faults were fixed and measured, not guessed:

- The sender painted a dot while everyone else received the whole line. The live
  stroke shared its points array with the stored stroke, so every move recorded
  the point twice and the tail became a zero-length segment. It now owns its
  array. Sender ink went from 14 pixels to 1296.
- A board that arrived while the workspace pane was closed had no size and was
  never repainted. It now repaints when it comes back into view and asks the room
  for the current board again, which covers both the held strokes and anything
  drawn while the pane was shut. Measured: a late joiner held exactly the same
  1222 painted pixels as the tutor.

## Registration email now says what it can do

Three honest answers replace one hopeful sentence:

| Situation | What the person sees |
|---|---|
| Mail is configured | "You are registered. A confirmation email is on its way." |
| Mail is not configured | "You are registered. The academy's email is not switched on yet, so save the joining link below — it is your seat." The joining link stays on screen. |
| A resend is requested while mail is off | `503` with: "The academy's email is not switched on, so no link could be sent. Use the personal link from your confirmation, or ask the academy to send it once its mail is set up." |

The admin **Events** screen also reads `GET /api/v1/website/events/mail-status/`
(admin only) and, when the server cannot send, shows a red banner naming the
first configuration error and the command that diagnoses it. The response
contains only static guidance from the configuration checker — no host, user,
password or server reply. Verified rendered at 1440 and 390 pixels with no
overflow.

The RSVP success panel branches on the same `email_ready` flag, so it no longer
promises an email the server cannot send.

## Checks run for this release

- Backend: `python manage.py test apps.liveclasses apps.website.test_event_live
  apps.website.tests` — **100 tests, OK**.
- Frontend: `tsc --noEmit` clean; static export builds 67 pages.
- Room render: 101-seat single peer, 104-seat two-peer run, widths 1440, 414,
  390, 320, 280; mobile tools sheet at 280; camera and microphone toggles.
- Two-peer sync: chat, raised hand, board late-join and live stroke, notes.
- Sound: two peers, playback withheld, strip shown at 1440 and 390 and cleared
  on press.
- Admin mail banner: rendered at 1440 and 390, no horizontal overflow.

Not in this release: **recording** (the server has no LiveKit egress service to
record with, so a button would be a dead control) and the **breakout-room
screen** (the endpoints exist, but the per-person token round-trip and the room
UI have not been through the two-peer test above). Both are deliberate
omissions rather than hidden switches.

## Mail `.env` lines — paste these yourself

Nothing in this package edits `.env`. If event mail is still not leaving the
server, these are the lines for the TrueHost local relay. Paste them as-is, with
no quotes and no trailing comments, and delete any duplicate `EMAIL_*` lines
already in the file:

```
EMAIL_BACKEND=apps.accounts.local_smtp.EmailBackend
EMAIL_HOST=localhost
EMAIL_PORT=25
EMAIL_USE_TLS=False
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=no-reply@vaceup.ng
```

Do not add `EMAIL_HOST_USER` or `EMAIL_HOST_PASSWORD` for this relay. Then run:

```
python manage.py diagnose_email_delivery --send-test
```

That command reports whether the local relay accepted the message, and its
guidance is the same text the admin banner shows. Separately: the LiveKit key
and secret that were exposed in an earlier diagnostic still need rotating in the
LiveKit console and in `.env`; this package never prints or stores either value.

## Install

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
```

Upload `vaceup-backend-2026-11-03-hundred-seat-room.zip` to
`/home/coqrpund/`, then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-03-hundred-seat-room.zip -d vaceup_api
cd vaceup_api
python manage.py check
python manage.py migrate website
python manage.py migrate meetings
```

There are no new migrations in this package; the two `migrate` lines only apply
what an earlier package may have missed. `check` should end with
`System check identified no issues (0 silenced).` apart from the pre-existing
object-storage warnings.

Restart the app (cPanel → Setup Python app → Restart), then:

```
python manage.py diagnose_live_rooms
python manage.py diagnose_email_delivery --send-test
```

The first should end with `/api/v1/website/events/ -> HTTP 200` and
`Staff meetings: ready.` The second is the mail answer.

## What is in the archive

| File | Why it changed |
|---|---|
| `apps/liveclasses/livekit.py` | raised hands may update their own metadata; the seat names its bearer and whether it is the host |
| `apps/liveclasses/services.py` | every attendee may publish; breakout join and leave return the full seat shape |
| `apps/liveclasses/views.py` | breakout join and leave return the same seat shape |
| `apps/liveclasses/tests/test_liveclasses.py` | publish rights and seat shape are asserted |
| `apps/website/views.py` | `email_ready` on registration, honest `503` on resend, admin `mail-status` |
| `apps/website/tests.py` | mail-status and registration answers |
| `apps/website/test_event_live.py` | resend behaviour when mail is off |
| `BACKEND-RELEASE-2026-11-03-hundred-seat-room.md` | this file |

No models change. No new Python package. The frontend keeps the room on
`livekit-client`, already a dependency.

## Prove it

1. Open a class from the dashboard and enter the room. The header should count
   the people, the gallery should page at twelve, and the workspace should open
   with Board, Notes and Materials.
2. Have a second person join from another device. Type in Notes and draw on the
   board from one screen; both should appear on the other.
3. If a phone shows the room but stays silent, the gold **Enable sound** strip
   should be visible. Press it. If the strip is absent and there is still no
   sound, tell me the phone and browser — that is a different layer.
4. Register for a test event. If the academy's mail is off, the success panel
   should keep the joining link on screen and say so. The admin Events screen
   should carry the red banner.
