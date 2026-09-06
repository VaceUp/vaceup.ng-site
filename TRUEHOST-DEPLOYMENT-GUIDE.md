# 🚀 VaceUp Backend — Truehost Deployment Guide (Step by Step)

Follow these steps **in order, top to bottom**. Don't skip. Every step is safe to repeat
(re-running a step never breaks anything — that's what "idempotent" means, and it matters
most in step 12 where we confirm your payment system cannot double-charge anyone).

**What we're doing:** replacing everything in your `api.vaceup.ng` folder with the fresh
backend code — while keeping your existing `.env` file, because it holds your database
name, user and password.

---

## Before you start (5 minutes)

1. On your computer, open the `backend/` folder of this project.
2. **Zip it correctly.** Select everything INSIDE `backend/` and zip it — so the zip
   contains `manage.py`, `config/`, `apps/`, `requirements.txt`, `passenger_wsgi.py` at
   its top level (NOT a folder called `backend` containing them).
3. **EXCLUDE these from the zip** (they must never be uploaded):
   - the `.env` file (we keep the one already on the server)
   - any `__pycache__` folders
   - any `.git` folder
   - `db.sqlite3` (your live database is MySQL, not this file)
   - `staticfiles/` and `media/` folders
   - the `tests/` folder (smaller upload; not needed live)

> 💡 On Windows: select the items → right-click → "Compress to ZIP file". Then open the
> zip and delete `.env`, `db.sqlite3` and any `__pycache__` folders you see inside it
> before uploading.

---

## Step 1 — Log in to Truehost cPanel

1. Go to your Truehost client area → **cPanel Login** (or `yourdomain.com/cpanel`).
2. Enter your cPanel username and password.

---

## Step 2 — Confirm your Python app exists

1. In cPanel search bar, type **"Setup Python App"** and open it.
2. You should see your existing app for `api.vaceup.ng`.
   - **If it exists:** click **Edit** (pencil) — don't change anything yet, just note:
     - the **Application Root** folder (e.g. `vaceup-api` or similar)
     - the **Python version** selected
   - **If it does NOT exist:** click **Create Application** and fill in:
     - Python version: **3.11** (or the highest 3.x available)
     - Application root: `vaceup-api`
     - Application URL: `api.vaceup.ng`
     - Application startup file: `passenger_wsgi.py`
     - Click **Create**.

> 📝 Remember this Application Root folder name — it's where all your files live. In
> this guide we call it `vaceup-api`.

---

## Step 3 — Back up what's there now (30 seconds of safety)

1. In cPanel, open **File Manager**.
2. Navigate to your home folder → `vaceup-api` (or the folder from Step 2).
3. Select **all files and folders**, then click **Compress** → choose `.zip` → name it
   `backup-before-update.zip` → Save.
4. Download that backup zip to your computer (right-click → Download).

> ✅ If anything goes wrong later, you can restore this.

---

## Step 4 — Remove the old code (keep `.env`!)

1. Still in File Manager inside `vaceup-api`:
2. Click the **Settings** button (top-right) → tick **"Show Hidden Files (dotfiles)"** → Save.
3. **You should now SEE your `.env` file.** If you don't, stop and redo this step — do not
   delete anything until you can see it.
4. Select **everything EXCEPT `.env`** and delete it.
   - Careful: also keep any `backup-before-update.zip` you created.
   - Typical items to delete: `apps`, `config`, `manage.py`, `requirements.txt`,
     `passenger_wsgi.py`, `passenger_wsgi.pyc`, `staticfiles`, `media`, `tmp`,
     `stderr.log`, old zip files, `__pycache__`.
5. When you're done, the folder should contain **only `.env`** (and your backup zip).

---

## Step 5 — Upload the new code

1. In File Manager, inside `vaceup-api`, click **Upload**.
2. Choose the zip you prepared in "Before you start".
3. Wait for the upload to reach 100%, then go back to File Manager.
4. Right-click the zip → **Extract** → extract into `vaceup-api` → Confirm.
5. **Verify the shape:** `manage.py`, `config/`, `apps/`, `requirements.txt` and
   `passenger_wsgi.py` should now sit directly inside `vaceup-api`, next to `.env`.
   - ❌ If you instead see a single folder (like `backend/`) containing them: open that
     folder, select all inside it, and use **Move** to bring them up into `vaceup-api`.
6. Delete the zip file you uploaded (keep the folder tidy).

---

## Step 6 — Install the Python packages

1. Go back to **Setup Python App** → click **Edit** on your app.
2. Scroll to **Configuration files** → the `requirements.txt` field should show
   `/home/USERNAME/vaceup-api/requirements.txt`.
3. Click **SAVE**, then click **Run Pip Install** (button near it).
4. Wait until it says the install completed successfully. This installs Django, DRF,
   Paystack support, MySQL driver, etc.

> ⚠️ If pip install fails with an error about a package, copy the exact error text —
> the fix is usually one missing system library, and support can help. The common one
> is `mysqlclient` — this project already avoids it by using `PyMySQL` (pure Python),
> so you should be fine.

---

## Step 7 — Point the app at your database (check `.env`, don't replace it)

1. In File Manager, right-click `.env` → **Edit** → confirm these lines exist and look
   right (DON'T change your DB name/user/password — they're already correct):
   ```
   DB_NAME=vaceup
   DB_USER=vaceup
   DB_PASSWORD=••••••(your existing password)
   DB_HOST=127.0.0.1
   DB_PORT=3306
   SECRET_KEY=••••••(keep your existing one!)
   ALLOWED_HOSTS=api.vaceup.ng,vaceup.ng,www.vaceup.ng
   CORS_ALLOWED_ORIGINS=https://vaceup.ng,https://www.vaceup.ng
   DEBUG=False
   PAYSTACK_SECRET_KEY=sk_live_•••• (add if empty — from your Paystack dashboard)
   PAYSTACK_PUBLIC_KEY=pk_live_•••• (add if empty)
   PAYSTACK_CALLBACK_URL=https://vaceup.ng/payment/success
   ```
2. Click **Save Changes**.
3. **If you had to add PAYSTACK keys**, that's fine — adding lines to `.env` doesn't
   break anything else.

---

## Step 8 — Run migrations (safe to repeat)

1. In **Setup Python App** → Edit → find the command box near the top (or use cPanel
   **Terminal**).
2. If using the Python app page: there's usually a button/field to run a command with
   the app's virtualenv. Run:

   ```bash
   python manage.py migrate
   ```

   (In Terminal, first activate the virtualenv — the exact line is shown on the Python
   app page, something like `source /home/USERNAME/virtualenv/vaceup-api/3.11/bin/activate && cd /home/USERNAME/vaceup-api`.)

3. You'll see migrations apply (the first time) or "No migrations to apply" (if already
   done). **Both outcomes are fine — that's idempotency.**

> 🔒 This is safe to run every deploy. Django tracks which migrations have already run
> in your database and only applies new ones.

---

## Step 9 — Collect static files (for the Django admin styling)

```bash
python manage.py collectstatic --noinput
```

Say **yes** if it asks to overwrite. Safe to repeat.

---

## Step 10 — Create/reconfirm your admin user

If you already have an admin login, skip this. Otherwise:

```bash
python manage.py createsuperuser
```

Follow the prompts (email + password). This is the login for `api.vaceup.ng/admin`.

---

## Step 11 — Restart the app

1. **Setup Python App** → click **Restart** on your application.
2. Visit **https://api.vaceup.ng/api/v1/healthz/** in your browser.
3. You should see a small JSON health message. 🎉

> If you see "Internal Server Error": open File Manager → `vaceup-api` → `stderr.log`
> → read the LAST lines — they say exactly what's wrong. 90% of the time it's a missing
> line in `.env` or pip install didn't finish.

---

## Step 12 — Payment webhooks (money safety — read fully)

Your payment system is built **idempotently**, which means money can never be
double-counted no matter how many times Paystack calls, or how many times you redeploy:

- Every payment has a **unique reference** (stored with a database constraint —
  duplicates are impossible).
- Confirming a payment twice does **nothing** the second time — enrollment is only
  granted once per student per course.
- The Paystack webhook processor is written to never raise, and re-processing the same
  event changes nothing.

To finish the setup:

1. Log in to your **Paystack dashboard** → Settings → **API Keys & Webhooks**.
2. Set **Webhook URL** to: `https://api.vaceup.ng/api/v1/payments/webhook/`
   (Check the exact webhook path on the payments router in the code if this 404s.)
3. Confirm the **Secret Key** there matches `PAYSTACK_SECRET_KEY` in your `.env`.
4. Confirm `PAYSTACK_CALLBACK_URL` in `.env` is
   `https://vaceup.ng/payment/success` (that's where buyers land after paying — the
   frontend page verifies and shows their enrollment).

> 🔁 Redeploying the backend NEVER affects past payments — references live in the
> database, not in the code.

---

## Step 13 — Frontend check

1. Visit **https://vaceup.ng** — homepage loads.
2. Go through: register → pick a course → apply → pay (use Paystack test mode first if
   you switched keys) → land on payment success → dashboard.
3. If the frontend says payments are unavailable, the backend is down or CORS is wrong —
   check `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` in `.env` and that Step 11 succeeded.

---

## Quick troubleshooting table

| Symptom | Where to look | Usual fix |
|---|---|---|
| 500 on all API routes | `vaceup-api/stderr.log` (last lines) | Missing `.env` key, or pip install incomplete |
| "No module named..." | stderr.log | Re-run **Run Pip Install** (Step 6) |
| Database errors | stderr.log | Check DB_* lines in `.env`; run `python manage.py migrate` |
| CORS errors in browser console | `.env` | `CORS_ALLOWED_ORIGINS=https://vaceup.ng,https://www.vaceup.ng` |
| Admin has no styling | — | Re-run Step 9 (collectstatic) |
| Changes not appearing | — | Restart the app (Step 11) — Passenger caches |

---

## Redeploying in the future (the 2-minute version)

1. Zip new backend (excluding `.env`, `__pycache__`, `db.sqlite3`, `tests`).
2. Upload → Extract into `vaceup-api` (overwrite).
3. Run Pip Install (requirements may have changed).
4. `python manage.py migrate` (only new migrations run).
5. Restart the app. Done — payments, users and courses are untouched.
