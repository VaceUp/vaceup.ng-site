# Backend release 2026-11-02 — About undo history, learner photos, the bucket probe

Delta overlay only. Every file listed at the bottom is new or changed by this
release; nothing else in `/home/coqrpund/vaceup_api/` is touched. This builds on
the 2026-11-01 team-and-storage overlay, which is already applied. It does not
re-ship anything from that release.

Two migrations run on install: `accounts.0005` and `website.0006`.

## What this release does

**1. Every About-page edit can be undone.** The admin who changed the About text
during testing had no way back: the form only ever held the newest wording. Each
save to the academy profile or a team profile now stores the text it replaced in
`website.ContentRevision`, and the Site Profile screen gains **Undo last change**,
per-row **Undo text**, and a **Change history** drawer with a **Restore this
wording** button on every entry. Restoring records its own revision, so undoing a
restore is possible too. Photos are deliberately excluded — no restore can move a
portrait back to a different person.

**2. The About page has an editable headline.** `AcademyProfile.hero_title` is the
big line at the top of `/about`. Left blank it falls back to the published
headline, so clearing the field is itself the way back to the original wording.

**3. Learners can add their own picture.** `POST /accounts/me/avatar/` accepts a
JPEG, PNG, WebP or GIF up to 5 MB, stores it through the public image storage, and
the account screen shows real byte progress while it goes. A failed or cancelled
upload leaves the previous picture in place.

**4. A lesson video upload says where it stopped.** The admin drawer now runs the
upload as three named steps — ask the academy for a link, send the file to the
bucket, attach it to the lesson — with a bar driven by the bytes actually left the
browser, the current speed and an estimate. If nothing moves for 20 seconds it
says so instead of looking frozen, and it offers **Cancel upload** and **Try this
upload again**. A failure names the step it died on and what that means, and the
message now appears inside the Private video block rather than at the top of a
drawer that has scrolled past it.

**5. `python manage.py storage_probe` answers the bucket question from the
server.** It signs a URL, writes a tiny object, reads it back and deletes it,
printing PASS or FAIL per step. This separates "the credentials are wrong" from
"the bucket has no CORS rule for the site", which look identical in the browser.
It never prints a key, secret or signed URL.

**6. `python manage.py restore_team_photos` puts the team portraits back.**
Run without `--apply` it prints what it would do. With `--apply` it writes each
bundled portrait through whichever storage is active now and reports the real
HTTP status of the resulting URL. It never deletes anything and never touches a
name, role or bio.

## Install

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
```

Upload `vaceup-backend-2026-11-02-about-history.zip` to `/home/coqrpund/`, then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-02-about-history.zip -d vaceup_api
cd vaceup_api
python manage.py migrate accounts
python manage.py migrate website
python manage.py check
```

Restart the app (cPanel → Setup Python app → Restart). Then confirm:

```
python manage.py storage_probe
python manage.py restore_team_photos
python manage.py restore_team_photos --apply
```

`storage_probe` must end with every step PASS before a learner or admin uploads a
video. If it fails at the write, the problem is the credentials or the bucket
name in `.env`, not the site.

## The private bucket block in `.env`

Do not edit the file in place on a live line. Add these as their own lines, one
setting per line, and put nothing after the value — an inline comment becomes part
of the setting and the endpoint is then treated as unset.

```
AWS_STORAGE_BUCKET_NAME=<your private bucket name>
AWS_ACCESS_KEY_ID=<your R2 access key id>
AWS_SECRET_ACCESS_KEY=<your R2 secret access key>
AWS_S3_ENDPOINT_URL=https://<your account hash>.r2.cloudflarestorage.com
AWS_S3_REGION_NAME=auto
```

The names matter: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, not
`AWS_ACCESS_KEY` / `AWS_SECRET`. With the wrong names the app sees a bucket with no
keys and `manage.py check` reports `core.W001`.

In the R2 bucket, the CORS policy must allow the site to send `PUT`:

```json
[
  {
    "AllowedOrigins": ["https://vaceup.ng", "https://www.vaceup.ng", "https://app.vaceup.ng"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Without it the browser's PUT is blocked and the upload stops at step 2 with the
bucket-refused message, even though the credentials are correct.

## Files in the zip

Paths are relative to `/home/coqrpund/vaceup_api/`, which is where the archive
extracts.

```
apps/accounts/models.py
apps/accounts/serializers.py
apps/accounts/urls.py
apps/accounts/views.py
apps/accounts/migrations/0005_user_avatar_user_avatar_updated_at.py
apps/core/management/commands/storage_probe.py
apps/website/admin.py
apps/website/models.py
apps/website/revisions.py
apps/website/serializers.py
apps/website/urls.py
apps/website/views.py
apps/website/migrations/0006_academyprofile_hero_title_contentrevision.py
apps/website/management/commands/restore_team_photos.py
```

The four test modules the same commit touched — `apps/accounts/tests/test_avatar.py`,
`apps/website/test_revisions.py`, `apps/website/test_team_seed.py` and
`apps/core/test_media_and_links.py` — ride along in the archive. They are never
imported by the running site, so leaving them is harmless.

## What was verified

463 backend tests pass on `config.settings_test`. The frontend builds clean for
production and `tsc --noEmit` reports nothing. In a running browser against a
local copy of the API: a 3 MB lesson video was uploaded with the bar climbing
through every percent, the confirming step at 100% and the attached message; an
upload whose connection stalled was caught by the 20-second warning, cancelled,
and retried to completion; an About-page edit was undone and the change history
showed both entries with their replaced fields; the account photo journey saved
and rendered; `/team` and `/about` were rendered at 1440 and 390 pixels with no
horizontal overflow and no content lost under reduced motion.

Not verified here, and still open: the bucket probe against the real R2
credentials (only you can run it on the server), and lesson video playback through
Cloudflare Stream.
