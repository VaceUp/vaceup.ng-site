# Backend release 2026-11-02 — the joining link every seat was missing

## What the academy saw

Someone registered for an online event and, when the hour arrived, had nothing
to open. The confirmation either carried no link or pointed at a meeting page
the academy had not filled in yet. On the website there was no place to enter
either: the event page described the event but never let a registered person
walk in.

And when planning an event, the only option offered was a box for an outside
link (Google Meet, Zoom). There was no way to say "use our own room".

## What changed

**Every seat got its own key.** Each registration now carries a private token
that no one else has. The joining link is

```
https://vaceup.ng/live/?event=<event-slug>&token=<that-seat's-token>
```

The token is the credential. An attendee never needs a VaceUp account, and the
real room address is never printed on a public page — only the link of someone
who holds a seat can reveal it.

**The confirmation email always prints it.** The moment a seat is taken the
person receives the link, even if the academy has not set the room up yet; that
same link starts working the second the room exists, so nobody has to be emailed
twice.

**A door on the website.** `https://vaceup.ng/live/` is the room. It shows the
waiting screen, the exact reason a link is not open yet ("The room opens at
Monday 02 November 2026 at 12:07 PM"), and a "Cannot find the email?" form that
re-sends the link to the address they registered with.

**The event page tells people how to enter.** An online, upcoming event now
shows a "Joining this event" band that says whether the room is open and, while
it is, puts an "Enter the room" button on the page.

**The setup form offers our own room.** Under *Where attendees join* there are
now two choices: *External link (Google Meet / Zoom)* and *VaceUp Live Room
(built in)*. With the built-in room chosen, no outside URL is ever needed.

**The roster stops guessing.** Each registration row now says "Joining link
emailed 2026-11-02 12:30" or "No joining link has reached them yet", the CSV
carries that column, and the roster drawer has a **Send joining link** button
that mails every seat at once and reports honestly how many went out.

**Nobody can fish for other people's seats.** The re-send form answers with the
same sentence whether or not that email registered, and it is limited to three
attempts a minute.

## One thing you have to do first: create the LiveKit project

The built-in room runs on LiveKit Cloud. Nothing works until the academy has an
account and its keys are in `.env`. This is a one-time, five-minute task.

1. Create a project on the LiveKit Cloud console (`cloud.livekit.io`). The free
   tier is enough to start.
2. Open that project's **API keys** page and create a key. Copy the **API key**
   and the **API secret** — the secret is shown once.
3. Copy the **URL** from the project's connect page. It looks like
   `wss://yourname-abcdefg.livekit.cloud`.
4. Add these three lines to `/home/coqrpund/vaceup_api/.env`. Use your own
   values — never copy the words `paste-` below:

```
LIVEKIT_API_KEY=paste-the-API-key-here
LIVEKIT_API_SECRET=paste-the-API-secret-here
LIVEKIT_WS_URL=wss://paste-your-project-url-here
```

5. Restart the app (cPanel → Setup Python app → Restart).

Until those three lines are in place, the built-in room still appears in the
admin, but anyone who opens it is told plainly that the academy has not switched
it on yet — nobody is left staring at a blank screen.

## Install

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
```

Upload `vaceup-backend-2026-11-02-live-rooms.zip` to `/home/coqrpund/`, then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-02-live-rooms.zip -d vaceup_api
cd vaceup_api
python manage.py check
python manage.py migrate website
```

`python manage.py check` should print `System check identified no issues (0 silenced).`
(If it warns about partly-configured object storage, that is the existing
storage warning and not this release.) The migration
adds four columns and then fills in a token for every registration that already
exists, so a seat taken before this release still gets a working link. On a
small roster it finishes in a few seconds; you should see

```
Applying website.0007_event_live_room_and_join_token... OK
```

Then restart the app (cPanel → Setup Python app → Restart).

No new package is needed: the room token is signed with PyJWT, which is already
installed for logins.

## Prove it reached the server

```
python manage.py diagnose_email_delivery --send-test
```

It asks for an address you control, then sends one message there. That must
report the mail was accepted — the joining link is worth nothing if the server
cannot send.

Then register a real seat through the website and read the email you get. The
line to look for is

```
Your personal joining link: https://vaceup.ng/live/?event=...&token=...
```

Open that link in the browser. Before the room is switched on it says so; after
you have added the LiveKit keys it puts you in the room.

## Optional: change how early the door opens

Two more lines in the same `.env`, if the defaults do not suit the academy:

```
EVENT_JOIN_EARLY_MINUTES=15
EVENT_JOIN_GRACE_MINUTES=30
```

The first is how early before the start an attendee may walk in; the second is
how long after the end the room stays open. Leave both out to keep 15 and 30.

## How to run an event with the built-in room

1. Admin → Events → **Plan an event** (or open an existing one).
2. Tick **Online event**.
3. Under **Where attendees join** pick **VaceUp Live Room (built in)**.
4. Leave **Room name** empty unless you want a specific name — one room per
   event is the normal case, and it is shared by every attendee.
5. Tick **Publish on the website**.
6. Save. Open the event's **Registrations** drawer and press **Send joining
   link** to reach everyone already registered. New registrants get the link
   automatically.

On the day: open the event page while signed in as an administrator and press
**Enter the room** — a host sees extra controls (screen share) that attendees do
not. Attendees only ever need the link in their email.
