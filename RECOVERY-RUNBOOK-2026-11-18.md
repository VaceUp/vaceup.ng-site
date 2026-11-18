# Backend recovery runbook — foreign zip extracted over the app folder

The 500 errors came from the server: another application's zip was extracted
into the VaceUp backend folder, overlaying foreign files (and possibly the
`.env`). Delta zips cannot remove files that do not belong to VaceUp, so the
folder must be restored from a clean copy, not patched.

## The recovery artifact

`vaceup-backend-2026-11-18-full.zip` (sha256
`8bbdfe023a8b0ef7c42570c55db0e36371127acef28371b17680dc488ea3ab11`) is the
complete VaceUp backend source tree — 415 files: all apps, config, every
migration, requirements, Docker/k8s/nginx files, media. It excludes the live
`.env` on purpose. `.env.production` is included as a value reference.

## Recovery steps (cPanel, in order)

1. **Back up before touching anything.** Compress the entire corrupted app
   folder as-is (e.g. `corrupted-backup-2026-11-18.tar.gz`) and download it.
   It contains the only copy of the current `.env` if that file was
   overwritten by the foreign zip.

2. **Inspect the current `.env` before deleting anything.** Open the backed-up
   folder's `.env` and check these VaceUp markers:
   - `DB_NAME` / `DB_USER` naming the VaceUp MySQL database
   - `FRONTEND_BASE_URL=https://vaceup.ng`
   - `ALLOWED_HOSTS` containing the backend domain
   - `AWS_*` keys if object storage was configured
   If the file belongs to the other application instead, the VaceUp `.env`
   must be rebuilt from `.env.production` (inside the recovery zip) plus the
   secrets only you hold: the MySQL password, the Paystack secret key, SMTP
   credentials, SENTRY_DSN, and any AWS keys.

3. **Empty the app folder.** Delete everything inside the VaceUp Python app
   directory (the folder itself can stay — cPanel passenger needs its path).
   The backup from step 1 is the safety net.

4. **Extract the full zip into the empty folder.** The zip's root mirrors the
   application root: `manage.py` sits at the top level.

5. **Restore `.env`.** Copy the correct `.env` from step 2 back into the
   folder. If it was overwritten, start from `.env.production` in the zip:
   copy it to `.env`, then fill in the real DB password, Paystack secret,
   SMTP credentials and AWS keys. Never commit or email this file.

6. **Reinstall dependencies with the venv's pip:**
   ```sh
   /path/to/venv/bin/pip install -r requirements.txt
   ```

7. **Apply migrations and run the checks:**
   ```sh
   /path/to/venv/bin/python manage.py migrate
   /path/to/venv/bin/python manage.py check
   ```
   `check` must end without issues. Any import error at this point means a
   foreign file survived step 3 — re-run step 3 and 4 for that path.

8. **Verify the challenge email path while you are in the shell:**
   ```sh
   /path/to/venv/bin/python manage.py challenge_email_selftest --to you@example.com
   ```
   It prints the exact configuration problem if SMTP or environment values
   are broken, instead of a bare 500.

9. **Restart the Python application** from the cPanel Setup Python App page
   (Restart button), then load the site and the API health endpoint
   (`/api/v1/healthz/`) in a browser.

10. **Fix the other application the same way** — extract that app's own
    correct zip into its own folder. Do not share one folder between apps.

11. **Re-verify the VaceUp flows end to end:** open the challenge page, log in
    from a different device (the failing case), and watch the app log under
    the cPanel Python page while doing it — any remaining 500 now has a
    stack trace in the log file, which names the file and line.

## Why the deltas did not fix it earlier

The 11-14/11-15/11-18 zips are overlays: they write correct VaceUp files but
leave foreign files in place. Python imports resolve against whatever is in
the folder, so one foreign `apps/...` module or a replaced `.env` is enough
to break a working deployment — and it explains why the failure looked
device-dependent while it was actually request-dependent.
