# Backend release 2026-11-02 — image URLs the academy's own uploads could never reach

## What the admin saw

An image was chosen, the form saved, no error appeared, and the page showed a
broken picture. The team and founder cards fell back to initials, and the
event banner showed nothing.

## What was actually wrong

Nothing was wrong with the upload, and nothing was wrong with the Cloudinary
account. **Every image did reach Cloudinary.** The address the site asks for
was one the stored file could never answer.

Cloudinary reads the `.jpg` at the end of a picture address as the *format* of
the picture, not as part of its name. The storage code was putting the whole
filename, extension included, into the stored name. So a portrait saved as
`mary-anieama.jpg` sits in the account under the name `mary-anieama.jpg`, and
the address the site builds for it asks Cloudinary for a picture named
`mary-anieama` — which was never stored. Cloudinary answers 404, the browser
shows a broken image, and because the upload itself succeeded there is no
error anywhere to read.

Measured on the live account, four of the five team portraits and the event
banner are present and healthy; only the address was wrong:

```
site asks    404   .../vaceup/website/team/mary-anieama.jpg
actually at  200   .../vaceup/website/team/mary-anieama.jpg.jpg   97 KB
site asks    404   .../vaceup/website/team/freeborn-udoekwere.jpg
actually at  200   .../vaceup/website/team/freeborn-udoekwere.jpg.jpg   75 KB
site asks    404   .../vaceup/website/events/Free_3-Day_Excel_Training_Banner.png
actually at  200   .../vaceup/website/events/Free_3-Day_Excel_Training_Banner.png.png   1.67 MB
site asks    404   .../vaceup/course/thumbnails/Virtual-Assistant.jpeg
actually at  404   .../vaceup/course/thumbnails/Virtual-Assistant.jpeg.jpeg   0 KB
```

The last line is the one real gap: that course thumbnail is genuinely not in
Cloudinary — it was stored before Cloudinary took over public images. No
rename can bring it back, so it needs uploading again from the admin panel.

## The fix

Two files.

* `config/storages.py` — the stored name no longer carries the extension, and
  the extension is handed to Cloudinary as the format instead. New uploads land
  where the site's address points. The address itself does not change, so
  nothing that already works changes either.
* `apps/core/management/commands/repair_image_public_ids.py` — a new command
  that moves the pictures already stored under the old name onto the name the
  site asks for, then loads each address and reports the real HTTP status. It
  renames, it never deletes, and without `--apply` it writes nothing.

## Install

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
```

Upload `vaceup-backend-2026-11-02-image-urls.zip` to `/home/coqrpund/`, then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-02-image-urls.zip -d vaceup_api
cd vaceup_api
python manage.py check
```

No database change is in this release, so there is nothing to migrate.
Restart the app (cPanel → Setup Python app → Restart).

## Then move the existing pictures

Look first, change nothing:

```
python manage.py repair_image_public_ids
```

Expect a `RENAME` line for each team portrait and both event banners, a `LOADS`
line for anything already correct, and one `MISSING` line for the course
thumbnail. When the list looks right, do it:

```
python manage.py repair_image_public_ids --apply
```

Every line should end as `MOVED ... -> loads (200)`. `LOADS` means the address
the site uses now returns the picture.

This is the step that closes the long-standing "the team photos are gone"
report. They were never gone.

### The first version of that command reported all eight as missing

If you ran it before this correction, its output said
`absent from Cloudinary: 8`. That was the command being wrong, not the account.

`splitext()` returns an extension **with its leading dot** (`.jpg`), and the
Cloudinary builder adds its own dot before the format, so the command asked for
`mary-anieama.jpg..jpg` — two dots — got a 404, and called a healthy file
absent. The probe URL is now built from the extension without the dot.

Re-checked against the live account after the correction, from this machine:

```
200   1.68 MB   .../vaceup/website/team/file_000000007bdc8211ab505748e6d46fa0.png.png   (Mercy)
200     88 KB   .../vaceup/website/team/stevens-flourish-breakthrough.jpg.jpg
200     97 KB   .../vaceup/website/team/mary-anieama.jpg.jpg
200     86 KB   .../vaceup/website/team/marvellous-ogunleye.jpg.jpg
200     75 KB   .../vaceup/website/team/freeborn-udoekwere.jpg.jpg
200    1.67 MB  .../vaceup/website/events/Free_3-Day_Excel_Training_Banner.png.png
200    1.67 MB  .../vaceup/website/events/Free_3-Day_Excel_Training_Banner_D33S6Pw.png.png
404        0 KB  .../vaceup/course/thumbnails/Virtual-Assistant.jpeg.jpeg
```

Seven of the eight are in the account and will be moved. The eighth, the
Virtual Assistant course thumbnail, is genuinely absent and needs re-uploading
from the admin panel — it predates Cloudinary, so no rename can recover it.

The command now also refuses to guess. It probes the CDN once before reading
any row, and if the server cannot reach Cloudinary it stops with the reason
instead of reporting every picture as missing. A connection failure and a 404
are no longer the same line of output.


## Getting the About page back to the wording you showed me

This one is a data edit, not a deploy — two minutes in the admin panel.

The live profile currently holds:

```
Page headline (hero_title) : (empty)     -> the About page already shows
                                           "Building Africa's Next Generation
                                           of Tech Innovators", exactly as before
Story (story)              : "Highest standards in curriculum design and
                             instruction."
Mission (mission)          : "Supportive communities where students grow
                             together."
```

Those two sentences are the *Excellence First* and *Community Driven* value
cards, which are written into the page itself and cannot be edited. They were
typed into the Story and Mission boxes as well, and the Story box is the one
the page reads for the paragraph under the headline. That is the only visible
difference from the screenshot.

To return to it:

1. Open the dashboard → **Website** → the About content form.
2. In **Story** ("The long paragraph visitors read first"), delete the
   sentence so the box is empty.
3. In **Mission**, delete the sentence too. Nothing on the live site reads
   that box today, so it only matters for keeping the form honest.
4. Save.

An empty Story box makes the page fall back to the published sentence —
"VaceUp Digital Academy was born from a simple belief: every African deserves
access to world-class technology education that leads to real careers." —
which is the line in your screenshot. If you would rather own the wording,
type that sentence into the Story box instead of leaving it empty; the result
on the page is the same.

## Why "undo last change" had nothing to undo

Your guess is right, and the reason is worth stating plainly.

The change history only records an edit that goes through the new save path.
It started counting the moment this code went onto the server, so it holds no
snapshot of anything edited before that — including the Story edit you want
undone. There was no earlier wording stored to put back, which is why the
panel said there were no changes so far rather than offering one to undo.

The history routes are live now (`website/revisions/` answers 401 for a
stranger, which means the address exists and is guarded, not missing), so the
save you make in step 4 above **will** be recorded. From that edit onward,
undo works for every change to the About page.

## What was verified

* Backend suite: **465 tests, OK** (3 skipped), run against SQLite.
* Three new storage tests pin the failure: the stored name drops the
  extension, a delivered address never repeats it, and an extension-free key
  still builds an address. Two older tests that had pinned the buggy name were
  corrected.
* The delivered address is unchanged by the storage fix — both the old and the
  new code build `.../mary-anieama.jpg`. Only the name the file is stored under
  changes, which is exactly why the repair command has to run.
* The corrected command was dry-run from this machine against the real
  account: it reported `waiting for --apply: 4` for the four team portraits its
  rows know about, and `absent from Cloudinary` only for two local test
  artefacts that genuinely are not in the account. Before the dot correction
  the same run wrongly reported all six as absent, which is how the bug was
  found.
* The seven live images were each fetched at the doubled name and returned
  200 with real byte counts, listed above.
* The live API was read to confirm the change history endpoints are present
  and guarded (401 without credentials) and that `hero_title` is empty, which
  is why the headline already matches your screenshot.
* Not verified yet: the team page with the pictures actually showing. That
  needs `--apply` on the server; run it and send the command's output.

