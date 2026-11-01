# Backend release 2026-11-01 — repair the half-applied overlay

Use this zip instead of `vaceup-backend-2026-11-01-team-and-storage.zip`. It
contains both of today's releases plus every backend file the 16:04
events/storage/mail release changed, because the server still has the older
version of those files.

## What went wrong

The live error is the proof:

```
AttributeError: 'Settings' object has no attribute 'CLOUDINARY_URL_REJECTED'
  File "/home/coqrpund/vaceup_api/apps/core/checks.py", line 38
```

`apps/core/checks.py` is the new file; `config/settings.py` next to it is the
old one. Checks run before every management command, so this stopped
`manage.py` itself. A second probe shows the same gap in the events code:
`GET /api/v1/website/events/excel-free-class/registrations/export/` answers
404, but that route exists in the release sent at 16:04.

The archive was extracted without overwriting: files that already existed
(`config/settings.py`, `config/storages.py`, `apps/website/views.py`,
`apps/website/models.py`, `requirements.txt`) stayed old, while files that were
new in the archive landed. This zip ships both releases in full, so one
overwriting extraction leaves the app consistent.

## What this release does

**1. `manage.py` runs again on a settings file that lags behind.** The config
checks now read every newer setting with a default, so a missing one skips its
warning instead of raising. A test pins it against a settings object that has
no Cloudinary keys at all.

**2. The storage diagnostic reported earlier.** The 503 names the empty AWS
setting, `core.W001` covers any partial object-storage block, and
`python manage.py storage_report` prints which setting reached the process —
never a value.

**3. The 16:04 events/storage/mail release, in full.** RSVP consent and the
roster export, Cloudinary for public images, R2/S3 for private media, the local
mail relay, and the settings/storages pair they depend on. The frontend already
deploys from `master`, so this brings the API back in line with it.

**4. The four new team profiles and the throttling savepoint fix.** As in
`vaceup-backend-2026-11-01-team-and-storage.zip`.

## What changed

| File | Change |
| --- | --- |
| `config/settings.py` | The version the code expects: Cloudinary block, `AWS_S3_CUSTOM_DOMAIN`, `SERVER_EMAIL`, `ADMIN_URL` repair. |
| `config/storages.py` | Cloudinary storage first, then bucket, then local disk; private media always signed. |
| `apps/website/views.py`, `models.py`, `serializers.py`, `emails.py`, `roster.py` | RSVP consent fields, confirmation mail, roster export and registration delete. |
| `apps/website/migrations/0005_eventregistration_consent_marketing.py` | The migration for the consent field. |
| `requirements.txt` | Adds `cloudinary` (only used when `CLOUDINARY_URL` is set). |
| `apps/core/checks.py` | Every newer setting read with a default, so checks cannot crash `manage.py`. |
| `apps/core/storage.py` | The 503 names the empty setting. |
| `apps/core/management/commands/storage_report.py` | **New.** Set/EMPTY per AWS setting; never prints a value. |
| `apps/core/test_media_and_links.py` | Covers the message, `core.W001`, the report, and a legacy settings object. |
| `apps/website/management/commands/seed_team_members.py` + `team_photos/*.jpg` | **New.** The four staff profiles with portraits. |
| `apps/core/throttling.py` | A rejected counter write stays inside its own savepoint. |
| `.env.example` | Documents the variables the restored settings read. Your `.env` is not touched. |

No existing file in this zip is older than what is on the server, and none of
them contains a credential.

## Apply

Back up the two config files first, so the site can be put back in one command
if anything looks wrong.

```bash
cd /home/coqrpund/vaceup_api
cp config/settings.py config/settings.py.bak-2026-11-01
cp config/storages.py config/storages.py.bak-2026-11-01

unzip -o vaceup-backend-2026-11-01-repair.zip
ls config/settings.py apps/website/views.py \
   apps/core/management/commands/storage_report.py \
   apps/website/migrations/0005_eventregistration_consent_marketing.py

source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py check
python manage.py storage_report
```

`migrate` should print `No migrations to apply` or apply `website.0005`; either
is correct. `check` should no longer crash. Then restart the Python app in
cPanel (**Setup Python App** → app rooted at `vaceup_api`, URL `api.vaceup.ng` →
**Restart**) — the terminal runs a separate process, so the site keeps the old
code until this is done.

If the site does not come back, restore the two files and restart:

```bash
cp config/settings.py.bak-2026-11-01 config/settings.py
cp config/storages.py.bak-2026-11-01 config/storages.py
```

## Publish the team profiles

```bash
# Report only. Expect four CREATE lines and no writes.
python manage.py seed_team_members

# Write them.
python manage.py seed_team_members --apply
```

Expected:

```
CREATE Stevens Flourish Breakthrough - Project Manager (id 1)
CREATE Mary Anieama - Content Writer (id 2)
CREATE Marvellous Boluwatife Ogunleye - Graphic Designer (id 3)
CREATE Freeborn Udoekwere - Graphic Designer (id 4)
```

Names already on the page print `SKIP`, and a profile edited in the admin is
never overwritten.

## Storage settings

All three of these must be non-empty in the process that serves the API. A
variable set in cPanel's **Setup Python App → Environment variables** overrides
the same name in `.env`, so an empty row there wins over a filled line in the
file.

```dotenv
AWS_ACCESS_KEY_ID=<r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>
AWS_STORAGE_BUCKET_NAME=<bucket-name>
AWS_S3_REGION_NAME=auto
AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
```

No trailing comment on any line. For plain AWS S3, leave `AWS_S3_ENDPOINT_URL=`
blank and set `AWS_S3_REGION_NAME` to the bucket's real region.

`storage_report` must end with `Private media  bucket` and no `ACTION:` line.

### The bucket needs a CORS rule for browser uploads

The admin uploads a video straight from the browser to the bucket with a signed
PUT, so the bucket must allow that origin. R2 has no CORS rule by default, and
the browser then rejects the PUT before it is sent — the form shows "the server
could not be reached", even though the API answered normally.

Cloudflare dashboard → R2 → the bucket → **Settings** → **CORS Policy** → Edit →
paste:

```json
[
  {
    "AllowedOrigins": ["https://vaceup.ng", "https://www.vaceup.ng"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

No restart is needed; the rule applies to the next upload. A signed URL that is
issued but answers 403 on PUT instead means the R2 API token lacks Object Read &
Write on that bucket.

## Verify

```bash
python manage.py check
python manage.py storage_report

# Routes that were missing before this release:
curl -s -o /dev/null -w "%{http_code}\n" https://api.vaceup.ng/api/v1/website/events/excel-free-class/registrations/export/
# 401 without a staff token is correct. 404 means views.py did not overwrite.

curl -s https://api.vaceup.ng/api/v1/website/team/ | python -c "import json,sys; d=json.load(sys.stdin); print(d['count']); [print(m['name'], '-', m['role_title']) for m in d['results']]"
```

Then upload a lesson video from the admin. The toast is either gone or naming
the one setting still empty.

## If something looks wrong

- **`manage.py` still shows the AttributeError:** `config/settings.py` did not
  overwrite. Check it mentions `CLOUDINARY_URL_REJECTED`:
  `grep -c CLOUDINARY_URL_REJECTED config/settings.py` must print a number
  above zero.
- **The export route still answers 404:** `apps/website/views.py` did not
  overwrite. Re-run `unzip -o` from `/home/coqrpund/vaceup_api`.
- **The site 500s after restart:** restore the two backups above and restart;
  send me the first 30 lines of the error log.
- **`check` prints `core.W005`:** `AWS_S3_ENDPOINT_URL` holds text that is not a
  URL; remove anything after the real value.
- **The upload URL is signed but the browser PUT returns 403:** the R2 token
  lacks Object Read & Write on that bucket.
