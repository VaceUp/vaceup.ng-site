# Backend release 2026-11-02 — the Jitsi room and the bulk mail run

Two packages, one archive. They share `models.py`, `views.py` and `serializers.py`,
so they cannot be split into two overlays without one of them carrying a file
that is half-finished. Everything below was verified on this machine before it
was committed: 87 website tests and 85 accounts/messaging tests pass, the
frontend type-checks and builds, and both the Jitsi room and the mail run were
driven through a real browser against a real local mail relay.

## What changed

**A room the academy can pick per event.** Under *Where attendees join* there are
now three choices instead of two, named exactly as the screen shows them:

| What you see | What it means |
|---|---|
| External link (Google Meet / Zoom) | unchanged — you paste the meeting URL |
| VaceUp Live Room — Jitsi (nothing to set up) | **new** — needs no key and no account |
| VaceUp Live Room — LiveKit (needs our keys) | unchanged — needs the LiveKit keys in `.env` |

The Jitsi choice runs on the public `meet.jit.si` by default, so it works the
moment this is deployed. Nothing about the LiveKit option was removed; both stay
in the list and each event keeps its own choice.

**A Jitsi room cannot be guessed at.** A Jitsi room is guarded only by its name,
so the room is not `vaceup-event-<slug>` — that is public. Each event now carries
a private code and the room is `vaceup-event-<slug>-<code>`. The code is never
shown on a page, in a CSV, or in the admin; the only way to get it is to hold a
seat. Migration 0008 fills the code in for every event that already exists.

**The host does not need a seat link.** A signed-in administrator opens the room
from the event's own row — *Open the live room* — and enters at any time, before
the event or after it. Attendees still need the personal link from their email
and still can only enter inside the join window.

**The roster gets a mail run.** In an event's *Registrations* drawer, press
**Mail everyone**. You write one subject and one message; the server mails every
registrant, and each person's copy carries their own joining link. Two hundred
people are not one request: the run goes out in batches of 25 and the panel keeps
asking for the next batch, so a long roster cannot outlast the server's timeout.
Each row is stamped the moment it is reached, so:

- **Stop after this batch** halts the run and the next run picks up where it
  stopped.
- The button counts only the people this click will actually reach — "Send to
  the 33 not yet emailed", not "Send to 58".
- Once everyone has been reached it says so and offers nothing to press.

**The website publishes the contact details once.** The About screen in the admin
no longer carries a fixed paragraph of phone and email that fought with the
footer. The footer is the one place the academy's contact details are printed.

**Staff get the account screen learners have.** Admin → *Your account* shows the
name, the email, the account type and the password change. There is no theme
switch there, because the admin panel does not have one.

**Messaging is in the admin navigation.** The same inbox the learner sees, opened
from inside the admin: the directory on the left, the thread on the right, 15
second polling on an open thread.

## One line for `.env`

Open `/home/coqrpund/vaceup_api/.env` and add this single line. It is the
default, so the app behaves the same without it — write it anyway, because then
moving to your own Jitsi host later is a one-line edit and a restart.

```
JITSI_DOMAIN=meet.jit.si
```

Do not change any line that is already in there. If the mail-relay block from the
previous release is still in place, nothing else is needed for the mail run:

```
EMAIL_BACKEND=apps.accounts.local_smtp.EmailBackend
EMAIL_HOST=localhost
EMAIL_PORT=25
EMAIL_USE_TLS=False
EMAIL_USE_SSL=False
EMAIL_TIMEOUT=20
```

## Install

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
```

Upload `vaceup-backend-2026-11-02-jitsi-and-bulk-mail.zip` to `/home/coqrpund/`,
then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-02-jitsi-and-bulk-mail.zip -d vaceup_api
cd vaceup_api
python manage.py check
python manage.py migrate website
```

`python manage.py check` should print `System check identified no issues (0 silenced).`
(An existing warning about partly-configured object storage is not this release.)

The archive also carries migration `0007`, so it installs correctly whether or not
you applied the live-rooms release. `migrate website` should print

```
Applying website.0008_event_jitsi_room_secret... OK
Applying website.0009_eventregistrant_broadcast_marker... OK
```

(If `0007` was not applied on the server yet you will see that line first. All
three add columns and backfill existing rows; on a normal roster they take
seconds.)

Then restart the app (cPanel → Setup Python app → Restart).

No new package is needed. The Jitsi room is opened by an embed script loaded from
the Jitsi host in the browser, and the mail run goes through the local relay that
is already configured.

## Prove it reached the server

```
python manage.py diagnose_email_delivery --send-test
```

Send one to an address you control. The mail run is worth nothing if the server
cannot deliver, so do this before you mail a roster.

Then, in the admin:

1. Events → open an online event → **Where attendees join** → **VaceUp Live Room
   (Jitsi)** → Save.
2. Open that event's **Registrations** drawer. Press **Mail everyone**, type a
   subject and a short note, and send. Watch the counter move; it should say how
   many went out and how many are left.
3. Read one of the emails on a real inbox. It carries that person's own link:
   `https://vaceup.ng/live/?event=...&token=...`. Open it — the Jitsi room should
   fill the screen.
4. Sign in as an administrator, go to Events, and press **Open the live room**.
   You should get in without a token.

The mail run also has an API behind the drawer, if you ever need to drive it from
a script: `POST /api/v1/website/events/<slug>/broadcast/` with `subject`,
`message`, optional `batch` (1–50, default 25), `only_unmailed` (default true)
and `include_link` (default true). It answers with `sent`, `failed`, `remaining`
and `done`.

## What ships on the website side

The frontend is not in this archive. It deploys on its own from `master` through
Cloudflare Pages, which happens as soon as the commit is pushed — the Jitsi room,
the mail drawer, the admin account screen and the messaging tab are all live
within a few minutes of the push, whether or not you have unpacked this zip yet.

That ordering matters once: until the backend is deployed, an event set to Jitsi
will not exist to pick, and the mail button will report an error rather than
silently doing nothing. Deploy the zip first, then reload the admin.
