# Backend release 2026-10-31 — curriculum brief

Delta overlay only. Every file listed here is new or changed by this release;
nothing else in `/home/coqrpund/vaceup_api/` is touched. No database migration
is needed: no model changed, only the curriculum data and the code that writes
it.

## What this release fixes

The catalogue in the repository and on the server did not carry the curriculum
brief. Measured before this release:

- The seed data collapsed every module's topic list into **one placeholder
  lesson per module** (56 lessons for 100 modules), instead of one lesson per
  topic (388).
- The admin "import catalogue" button read a saved copy of the old
  ten-programme catalogue (`original_catalog.json`) with its own prices
  (₦50,000 / ₦60,000 / ₦65,000), durations ("2 Months", "3 Months"), a
  "Kids Academy" category and a condensed outline. It could create a second,
  different version of the academy next to the brief.
- The live site (verified through `api.vaceup.ng`) carries 6 published courses
  with an older AI-authored curriculum: 8 modules x 3 lessons, different module
  titles, Data Analysis with 12 modules instead of 8, Web Development with 8
  instead of 10, every module at week 1, and prices ₦50,000 / ₦60,000 / ₦65,000
  instead of the brief's ₦70,000 / ₦80,000.

## What changed

| File | Change |
| --- | --- |
| `apps/courses/curriculum.py` | Verbatim transcription of the brief: 12 courses, 100 modules, every topic bullet, every module note, the learning-outcome paragraphs, and the brief's prices and durations. |
| `apps/courses/curriculum_sync.py` | New. Shared reconciliation core: match modules and lessons by title, create what the brief has and the catalogue lacks, renumber safely under the unique `(course, order)` and `(module, order)` constraints, and rename a matched module to the brief's title. |
| `apps/courses/management/commands/seed_curriculum.py` | Rewritten on top of the shared core. Creates drafts only, refuses published courses, reports what it added, and prints the per-course module and lesson counts. |
| `apps/courses/management/commands/sync_curriculum.py` | New. Reports the difference between a live course and the brief. Writes only with `--apply`; removes non-brief modules only with `--replace-modules`; changes prices only with `--set-prices`. |
| `apps/courses/management/commands/import_homepage_catalog.py` | Preview line now shows modules and lessons; the summary reports them. |
| `apps/courses/catalog.py` | Reads `CURRICULUM` instead of the stale JSON, and builds the modules and lessons for any course it creates. Cover images are kept as a small map; the two coding programmes have no cover on the original site and are created without one. |
| `apps/courses/original_catalog.json` | **Deleted from the repository.** The file is no longer read. It stays on the server unless you remove it (command below). |
| `apps/courses/views.py` | The import response now states how many modules and lessons were created. |
| `apps/courses/test_curriculum_seed.py`, `test_curriculum_sync.py`, `test_authoring.py`, `apps/adminpanel/tests.py` | Tests for the brief parity, the sync command against the live 8x3 shape, and the catalogue import. |

## Verification (measured, not assumed)

- `python manage.py test --settings=config.settings_test` → `Ran 395 tests in 16.580s` / `OK (skipped=3)`.
- Brief comparison harness → 12 courses, 100 modules, 385 topic bullets, 22
  module notes on both sides, `MISMATCHES: 0`.
- `makemigrations --check --dry-run` → `No changes detected`.
- `check_no_secrets.py` → `clean (981 tracked files scanned)`.
- `python -m compileall apps/courses` → no errors.
- Catalogue preview read live through the running API: 12 rows, 100 modules,
  388 lessons, prices ₦70,000 / ₦80,000 / ₦50,000, durations "8 Weeks" /
  "10 Weeks".
- Admin screen rendered and inspected at 1440 and 390 (Curriculum catalogue
  section): 12 rows, no horizontal overflow, no clipped text.

## What the brief does not contain

Five courses list module titles only, with no topic bullets, so they are seeded
with their modules and **zero lessons**: Graphic Design (adult), Web
Development (adult), Graphic Design for Kids, UI/UX Design for Kids, and Web
Development for Kids. Their content has to be written by the tutors; nothing
was invented for them.

## Apply on cPanel

1. Upload `vaceup-backend-2026-10-31-curriculum.zip` to `/home/coqrpund/` and
   extract it over the application root:

   ```bash
   cd /home/coqrpund
   unzip -o vaceup-backend-2026-10-31-curriculum.zip -d /home/coqrpund/vaceup_api
   ```

2. Optional, only if you want the superseded data file gone:

   ```bash
   rm -f /home/coqrpund/vaceup_api/apps/courses/original_catalog.json
   ```

3. Activate the environment and check the code arrived:

   ```bash
   source /home/coqrpund/vaceup_api/venv/bin/activate
   cd /home/coqrpund/vaceup_api
   python --version
   python manage.py check
   python -c "from apps.courses.curriculum import CURRICULUM, expected_lessons; print(len(CURRICULUM), sum(len(i['modules']) for i in CURRICULUM), sum(expected_lessons(i) for i in CURRICULUM))"
   ```

   The last line must print `12 100 388`.

4. See what the live catalogue is missing, without writing anything:

   ```bash
   python manage.py sync_curriculum
   ```

   Read the report. `+ module missing` / `+ lesson missing` lines are what the
   brief adds; `- module not in the brief` lines are what `--replace-modules`
   would remove. A module any student has opened is marked `(kept)` and is
   never removed.

5. Write the brief into the published courses:

   ```bash
   python manage.py sync_curriculum --apply --replace-modules
   ```

   Add `--set-prices` only when you are ready for live courses to change price
   to the brief's ₦70,000 / ₦80,000 / ₦50,000. Existing buyers keep the price
   they paid; the change applies to new checkouts.

6. Create the courses that do not exist yet, as unpublished drafts:

   ```bash
   python manage.py seed_curriculum
   python manage.py seed_curriculum --apply --instructor-email <active tutor email>
   ```

7. Housekeeping and restart:

   ```bash
   python manage.py migrate
   python manage.py check_release_routes
   python manage.py collectstatic --noinput
   ```

   Then restart the Python app in cPanel.

## Read this before step 5

Adding lessons to a course a student is already enrolled in **lowers their
recorded progress percentage**, because progress is lessons completed divided by
lessons in the course. A student at 100% on 24 lessons shows about 39% once the
course carries 62. Enrollments already marked completed stay completed, and
issued certificates are not revoked. The new percentage appears the next time
that student marks a lesson complete.

## Smoke checks after the restart

- `GET /api/v1/courses/?page_size=100` — the published courses are still listed.
- `GET /api/v1/courses/virtual-assistant/` — `modules` is the brief's 8 titles
  and the first module carries 8 lessons.
- Admin > Courses > Curriculum catalogue — 12 rows, each showing its module and
  lesson counts.
- One student sign-in: the dashboard still opens and progress bars render.
