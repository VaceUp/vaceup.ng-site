# Backend release 2026-11-01 — team profiles and the storage diagnostic

Delta overlay only. Every file listed here is new or changed by this release;
nothing else in `/home/coqrpund/vaceup_api/` is touched. This zip replaces
`vaceup-backend-2026-11-01-team-profiles.zip`: it contains everything that one
did, plus the storage diagnostic.

**The 2026-11-01 events/storage/mail overlay is already applied on the server
and this release builds on top of it.** Nothing from that release is re-shipped
here. No migration, and no new environment variable.

## What this release does

**1. The video-upload error names the empty setting.** `Media storage is not
configured on the server.` meant any one of three settings was blank, with no
way to tell which. The 503 now reads, for example,
`Media storage is not configured on the server: AWS_SECRET_ACCESS_KEY is empty.`
Only the setting names are printed, never a value.

**2. `manage.py check` warns before the first upload fails.** `core.W001` used
to fire only when the bucket name was set without both keys. It now fires for
any half-finished object-storage block — keys without a bucket, a bucket
without keys, or one key alone — and names all three settings to fix.

**3. The four new team members can be published from one command.** The staff
profiles supplied on 2026-11-01 — Stevens Flourish Breakthrough (Project
Manager), Mary Anieama (Content Writer), Marvellous Boluwatife Ogunleye (Graphic
Designer) and Freeborn Udoekwere (Graphic Designer) — ship as a Django command
with their portraits. Run it in report mode first, then with `--apply`. A name
that already exists is skipped, so running it twice creates nothing twice, and a
profile the academy has since edited in the admin is never overwritten.

**4. A rejected rate-limit write stays inside its own savepoint.** The database
counter behind every throttle now runs in its own `transaction.atomic()` block.
On MySQL a failed statement otherwise marks the whole surrounding transaction as
unusable, so one rejected counter update turned every later query in that
request into a 503.

## What changed

| File | Change |
| --- | --- |
| `apps/core/storage.py` | The 503 names every empty setting instead of printing one generic line. |
| `apps/core/checks.py` | `core.W001` covers any partial object-storage configuration, not just a missing key pair. |
| `apps/core/test_media_and_links.py` | Five new tests: the message names the empty settings, and `core.W001` fires for a bucket-only, keys-only and complete configuration. |
| `apps/website/management/commands/seed_team_members.py` | **New.** Publishes the four profiles. Reports what it would do unless `--apply` is given; skips any name that already exists. |
| `apps/website/management/commands/team_photos/*.jpg` | **New.** Four 800x800 face-centred portraits, 75-98 KB each. |
| `apps/website/test_team_seed.py` | **New.** Three tests: nothing is written without `--apply`; `--apply` publishes all four in order with photos; an edited profile is left alone on a re-run. |
| `apps/core/throttling.py` | The counter write runs in its own savepoint, so a failure cannot leave a caller's transaction unusable. |
| `apps/assignments/test_workflows.py` | Test-only. The download test consumed a streamed response and then closed it a second time, which dropped the MySQL connection inside the test transaction. |

## Apply

Upload the zip into the application root and extract it there, then run the
three `ls` lines. Each must print the file; if one is missing, stop — the upload
did not finish.

```bash
cd /home/coqrpund/vaceup_api
unzip -o vaceup-backend-2026-11-01-team-and-storage.zip
ls apps/core/storage.py apps/core/checks.py apps/website/management/commands/seed_team_members.py

source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
python manage.py check
```

`check` should print no `core.W001`. If it prints one, jump to *Why storage is
still unconfigured* before uploading a video.

Restart the Python application (cPanel → **Setup Python App** → the app rooted
at `vaceup_api`, URL `api.vaceup.ng` → **Restart**). A terminal run does not
reload the process the web server is using, so this step is required.

Then publish the team profiles:

```bash
# Report only. Expect four CREATE lines and no writes.
python manage.py seed_team_members

# Write them.
python manage.py seed_team_members --apply
```

Expected output of `--apply`:

```
CREATE Stevens Flourish Breakthrough - Project Manager (id 1)
CREATE Mary Anieama - Content Writer (id 2)
CREATE Marvellous Boluwatife Ogunleye - Graphic Designer (id 3)
CREATE Freeborn Udoekwere - Graphic Designer (id 4)
```

## Why storage is still unconfigured

The upload path reads exactly three settings. All three must be non-empty:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_STORAGE_BUCKET_NAME
```

Run this to see which ones the running application actually receives. It prints
booleans and hosts only — never a key or a secret:

```bash
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
python manage.py shell -c "from django.conf import settings as s; print('id set:', bool(s.AWS_ACCESS_KEY_ID)); print('secret set:', bool(s.AWS_SECRET_ACCESS_KEY)); print('bucket set:', bool(s.AWS_STORAGE_BUCKET_NAME)); print('region:', s.AWS_S3_REGION_NAME); print('r2 endpoint set:', bool(s.AWS_S3_ENDPOINT_URL)); print('uses r2 host:', (s.AWS_S3_ENDPOINT_URL or '').endswith('r2.cloudflarestorage.com')); print('OBJECT_STORAGE_CONFIGURED:', s.OBJECT_STORAGE_CONFIGURED)"
```

Then read the result against these four causes, most common first:

1. **A process variable shadows `.env`.** `django-environ` keeps a real
   environment variable over the same name in `.env`. If cPanel's **Setup Python
   App → Environment variables** has any of the three listed with an empty value,
   the `.env` line is ignored. Delete the empty row there, or fill it in, then
   restart.
2. **A comment or stray text is part of the value.** Anything after `=` is the
   value — `AWS_STORAGE_BUCKET_NAME=vaceup-media  # r2 bucket` is a bucket named
   `vaceup-media  # r2 bucket`, not `vaceup-media`. The line must hold the value
   and nothing else.
3. **The names are different.** Keys pasted under `R2_ACCESS_KEY_ID`,
   `AWS_KEY` or `BUCKET_NAME` are read by nothing. The three names above are the
   only ones this code reads.
4. **Only part of the block was pasted.** A bucket name without both keys keeps
   media on local disk — public images still work, lesson videos do not. This is
   exactly what `core.W001` now reports.

### The block to paste into `.env`

Placeholders only; replace the angle-bracket parts. Cloudflare R2 dashboard →
**Manage R2 API Tokens** gives the Access Key ID, the Secret Access Key and the
account ID used in the endpoint.

```dotenv
AWS_ACCESS_KEY_ID=<r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>
AWS_STORAGE_BUCKET_NAME=<bucket-name>
AWS_S3_REGION_NAME=auto
AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
```

If the bucket is on AWS S3 instead, leave `AWS_S3_ENDPOINT_URL` blank and set
`AWS_S3_REGION_NAME` to the bucket's real region (for example `eu-west-1`).
After editing `.env`, restart the application again, then re-run the probe: it
must print `OBJECT_STORAGE_CONFIGURED: True`.

## Verify

```bash
# Storage: after the restart, an upload should succeed. The probe above must say True.
curl -s -o /dev/null -w "%{http_code}\n" https://api.vaceup.ng/api/v1/lessons/1/video-upload-url/
# 401 without a staff token is correct: the route exists and is protected.

# Team profiles:
curl -s https://api.vaceup.ng/api/v1/website/team/ | python -c "import json,sys; d=json.load(sys.stdin); print(d['count']); [print(m['name'], '-', m['role_title'], '-', m['image']) for m in d['results']]"
```

Expect `count` to include the four names, each with an image URL. Open
`https://vaceup.ng/team` to see them under the staff roster.

## If something looks wrong

- **The toast still says "Media storage is not configured on the server." with
  no setting named:** the server is running the old `storage.py`. Re-extract the
  zip and restart the app.
- **The toast names a setting that is filled in `.env`:** cause 1 above — a
  process variable from cPanel is shadowing the file.
- **`check` prints `core.W005`:** `AWS_S3_ENDPOINT_URL` is not a URL. It is
  being ignored, so signing goes to AWS S3. Delete any trailing text on the line.
- **The upload URL is issued but the browser PUT returns 403:** the R2 token
  lacks write access to this bucket. Re-issue the token with Object Read & Write
  on that bucket only.
- **A team name is missing from the report:** the file listed above did not
  upload. **A name says SKIP:** that person is already on the team page; edit
  them in the admin under Website → Team members.
- **A profile has no photo:** the command prints `WARNING: … is missing`. The
  profile is still created; add the photo in the admin.
