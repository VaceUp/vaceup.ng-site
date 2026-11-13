# Class recordings and structured dashboard emails

This is a source overlay for the current VaceUp backend. Install the backend
before deploying the matching frontend. It adds recording storage and event host
assignment; the frontend supplies the actual screen-and-room-audio capture.

## What changes

- Tutors and administrators can record native VaceUp classes. The shared room
  also supplies recording controls to event hosts and staff meeting hosts.
- Stopping a recording uploads it to private object storage. The tutor can also
  download the same video to their device. A failed upload retains the device
  copy and offers a retry; saved device files can be uploaded later.
- Every published recording part is retained. Recording another part does not
  overwrite earlier recordings, including each day of the Excel workshop.
- Students with an active or completed course enrollment can rewatch, including
  students who missed the live session. Outsiders cannot fetch recordings.
- Event recordings use the attendee's existing personal seat link, including
  after the event closes. Removing the registration revokes future replay access.
- Event editors can assign active tutors as hosts. Administrators retain host
  access. A tutor does not gain control over other events or courses.
- Campaigns, event broadcasts, confirmations, joining links, announcements,
  staff meeting invitations and class reminders now include structured HTML
  alongside the existing plain-text email. Author text is escaped. Paragraphs,
  lists, headings and links retain their structure.
- Campaign editors can preview an unsent draft's email design without sending
  a message or creating recipients. Existing mail queue, audience and suppression
  rules remain in effect.

## Install

1. Back up the currently deployed source and database.
2. Extract `vaceup-backend-2026-11-13-recordings-and-email.zip` over the backend
   application root. It contains no `.env`, database, media uploads or secrets.
3. Activate the Python environment shown by cPanel's Python application, then
   run these commands from the application root:

   ```sh
   python manage.py migrate
   python manage.py check
   ```

4. Restart the Python application in cPanel.
5. Deploy the matching frontend changes through the existing frontend pipeline.

The migrations are additive: `website.0010_event_hosts` creates the event host
relationship, and `liveclasses.0004_roomrecording` stores private recording parts.
No existing event, enrollment, class, registration or recording is rewritten.
The JSON email theme and the `apps/core/templates/email/base.html` template must
be installed with the Python files. They are included in the archive.

## Storage and browser requirements

Platform publication uses the existing private R2/S3 media storage, with the same
direct-upload and playback origin permissions used by lesson videos. Configure
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME`, and the
provider's `AWS_S3_ENDPOINT_URL` as appropriate. The new recording route verifies
the stored file's size and content type before making it available for replay.

LiveKit Egress is not required. Recording runs in the host's desktop browser.
The host chooses the classroom tab, an application window such as Excel, or a
screen. The selected video is combined with unmuted room audio, including the
host's microphone and subscribed participants. The host must keep the page open
until recording stops and publishing finishes or the device copy is downloaded.
Browsers without screen capture can watch recordings but cannot create them.

There is a 5 GiB limit per uploaded part. Split exceptionally long sessions into
parts. Publishing again adds another part; it does not replace an existing one.

## Today's Excel workshop

The public API was checked on 13 November 2026. `excel-free-class`, titled
`FREE 3-Day Excel Training`, is already online on LiveKit. Its start is
13 November at 8:00 PM Lagos time and its end is 15 November at 10:00 PM Lagos
time. Its existing attendee links can be kept.

After installing both releases:

1. In the admin dashboard, open Events and edit that workshop.
2. Under **Hosts and recording access**, select the tutor running the class and
   save. The tutor signs in with their own account and opens the event page.
3. Open the live room in a desktop browser and press **Record session**. Choose
   the classroom tab or Excel window in the browser's capture picker.
4. Press **Stop and save recording**. Keep the page open until publication is
   confirmed, and use **Download to device** for the local copy.
5. Attendees use **Recordings** inside the room, or their personal event link
   after the event has ended. The same link supports recovery of the joining
   email; recordings never become a public event-page video.

Already-open room pages need to be reloaded to receive the new interface.

## Verification and limits

The full SQLite backend suite ran 598 tests and reported `OK (skipped=3)`.
The frontend production export completed successfully. The real Chromium
recording harness captured synthetic screen video and room audio, downloaded
the video, exercised failed-upload recovery and verified replay playback and
the late-joining student's recording notice. It uses isolated test storage;
it does not record real participants or send email.

Scoped rendered checks passed for recording controls and email previews:
default/hover/focus contrast in light and dark runs, responsive widths
280/320/414, and the checked axe audits. The UI was also inspected visually.
Browser email previews are not proof of identical rendering in every inbox.

The repository-wide `node scripts/accuracy_report.mjs` reported **5/37**.
Its remaining failures include missing kit `examples/` fixtures and related
theme/spec/template inputs, so it does not certify this product. The report is
preserved at `artifacts/recording-accuracy-report.txt`; no global pass or
subjective aesthetic score is claimed.

The development environment reports existing incomplete object-storage
configuration. Storage credentials and an actual production upload still need
verification on the deployment server. The live site's event-room readiness
flag proves its LiveKit setup, not its recording storage.

## Email theme maintenance

The email adapter resolves the shared app brand colors into inline values for
email clients. After changing the source theme, regenerate and check it:

```sh
python scripts/build_email_theme.py
python scripts/build_email_theme.py --check
```

This release formats future deliveries. Email already in someone's inbox cannot
be restyled. It does not resend any previous campaign, registration email or
announcement.
