# Backend release 2026-11-01 — the four new team profiles

Delta overlay only. Every file listed here is new or changed by this release;
nothing else in `/home/coqrpund/vaceup_api/` is touched.

**The 2026-11-01 events/storage/mail overlay is already applied on the server
and this release builds on top of it.** Nothing from that release is re-shipped
here.

## What this release does

**1. The four new team members can be published from one command.** The staff
profiles supplied on 2026-11-01 — Stevens Flourish Breakthrough (Project
Manager), Mary Anieama (Content Writer), Marvellous Boluwatife Ogunleye (Graphic
Designer) and Freeborn Udoekwere (Graphic Designer) — ship as a Django command
with their portraits. Run it in report mode first, then with `--apply`. A name
that already exists is skipped, so running it twice creates nothing twice, and a
profile the academy has since edited in the admin is never overwritten.

**2. A rejected rate-limit write stays inside its own savepoint.** The database
counter behind every throttle now runs in its own `transaction.atomic()` block.
On MySQL a failed statement otherwise marks the whole surrounding transaction as
unusable, so one rejected counter update turned every later query in that
request into a 503. The retry policy is unchanged: a deadlock is retried only
inside a transaction this code owns, never a caller's.

There is no migration and no new environment variable in this release.

## What changed

| File | Change |
| --- | --- |
| `apps/website/management/commands/seed_team_members.py` | **New.** Publishes the four profiles. Reports what it would do unless `--apply` is given; skips any name that already exists. |
| `apps/website/management/commands/team_photos/*.jpg` | **New.** Four 800x800 face-centred portraits, 75-98 KB each. |
| `apps/core/throttling.py` | The counter write runs in its own savepoint, so a failure cannot leave a caller's transaction unusable. |
| `apps/website/test_team_seed.py` | **New.** Three tests: nothing is written without `--apply`; `--apply` publishes all four in order with photos; an edited profile is left alone on a re-run. |
| `apps/assignments/test_workflows.py` | Test-only. The download test consumed a streamed response and then closed it a second time, which dropped the MySQL connection inside the test transaction. |

## Apply

The three `ls` lines are the pre-flight: each must print the file. If any one is
missing, stop — the upload did not finish.

```bash
cd /home/coqrpund/vaceup_api
ls apps/website/management/commands/seed_team_members.py
ls apps/website/management/commands/team_photos/stevens-flourish-breakthrough.jpg
ls apps/core/throttling.py

# Report only. Expect four CREATE lines and no writes.
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
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

## Verify

```bash
curl -s https://api.vaceup.ng/api/v1/website/team/ | python -c "import json,sys; d=json.load(sys.stdin); print(d['count']); [print(m['name'], '-', m['role_title'], '-', m['image']) for m in d['results']]"
```

Expect `count` to include the four names, and each to print a Cloudinary image
URL (or a `/media/` URL if Cloudinary is not configured on the server). Open
`https://vaceup.ng/team` to see them under the staff roster.

## If something looks wrong

- **A name is missing from the report:** the file listed above did not upload.
- **A name says SKIP:** that person is already on the team page. Edit them in the
  admin under Website -> Team members; the command will not touch them.
- **A profile has no photo:** the command prints `WARNING: … is missing`. The
  profile is still created; add the photo in the admin.
- **The API returns fewer than four names:** the command was run without
  `--apply`. Re-run it with `--apply`.
