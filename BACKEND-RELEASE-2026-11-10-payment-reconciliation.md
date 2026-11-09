# Backend release 2026-11-10 — a paid student gets access even if the webhook never arrived

A learner paid, their card was debited, and the dashboard still said the course was
owed with the lessons locked. This package makes that state impossible to stay stuck.

## Why it happened

A payment is only recorded as successful when one of two things tells the server
that Paystack captured the money:

1. **The webhook** — Paystack calls
   `https://api.vaceup.ng/api/v1/payments/webhook/` a few seconds after the charge.
   It only does that while the URL is registered on the **Paystack dashboard**
   (Settings → API Keys & Webhooks → Webhook URL), and it stops retrying after 72
   hours.
2. **The return page** — the buyer comes back to `/payment/callback` while still
   signed in, and that page asks the server to verify the reference.

If both are missed — the buyer closed the tab after paying, or the webhook is not
registered — the order stays `pending`, no `Enrollment` row is created, and the
student sees **Applications waiting for payment** with the course locked. The money
is in Paystack; only our record is wrong. Until now, the only repair was for the
learner to start checkout again, which nobody does after paying.

## What changed

**`apps/payments/services.py`** — `reconcile_payments(...)` re-runs the normal,
idempotent verification against Paystack for any order that is not marked
successful (`pending`, `abandoned` or `failed`). A payment only becomes successful
when Paystack confirms the amount, currency and reference, so this can never grant
access for money that was not captured, and it can never charge anyone a second
time.

**`apps/dashboard/member_views.py`** — when a student opens the dashboard overview
or **My courses**, and an accepted application still has no enrollment, the server
now asks Paystack about that student's open orders before building the response.
The repair therefore happens the moment the student looks at the screen that says
they owe. **Payment history** does the same for the last 90 days of orders, which
also repairs a direct purchase that never went through an application. The call is
bounded (5 orders, not repeated within 30 seconds) and a Paystack outage cannot
break the dashboard — the screen still loads, and the next open tries again.

**`apps/payments/management/commands/reconcile_payments.py`** — a command to settle
every open order at once, and to see exactly which student is affected.

No migration, no new dependency, no `.env` line.

## Install

Upload `vaceup-backend-2026-11-10-payment-reconciliation.zip` to `/home/coqrpund/`,
then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-10-payment-reconciliation.zip -d vaceup_api
cd vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
python manage.py check
```

`check` should print `System check identified no issues (0 silenced).` Then restart
the app (cPanel → Setup Python app → Restart).

## Fix the student who is already affected

Run the dry run first — it only reads, and it lists every unsettled order with the
student's email:

```
cd /home/coqrpund/vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
python manage.py reconcile_payments --days 60 --dry-run
```

Find the student's reference in that list, then run it for real:

```
python manage.py reconcile_payments --days 60
```

The output ends with how many orders were confirmed and enrolled and how many are
still unsettled, with their references. An order that stays unsettled was not
charged by Paystack (nothing to repair), or it is a pre-upgrade order that needs
the reference checked in the Paystack dashboard.

Alternatively, simply have the student open their dashboard: the same repair runs
on that request as well.

## Stop it happening again (Paystack dashboard, not `.env`)

In the **Paystack dashboard** → Settings → API Keys & Webhooks, set the Webhook URL
to exactly:

```
https://api.vaceup.ng/api/v1/payments/webhook/
```

The endpoint is live and answers an unsigned request with `401`, which is the
correct behaviour. Once the URL is saved, Paystack confirms every future charge
within seconds and the dashboard re-check becomes a rare backstop.

If the webhooks page shows deliveries failing with `401`, the **secret key** on the
server and the one Paystack signs with do not match (live key vs test key). In that
case the dashboard re-check still grants access — it only happens a little later.

Optional, for repairs without a dashboard visit: a cPanel cron every 15 minutes:

```
*/15 * * * * cd /home/coqrpund/vaceup_api && /home/coqrpund/virtualenv/vaceup_api/3.12/bin/python manage.py reconcile_payments --days 30 >> /home/coqrpund/reconcile.log 2>&1
```

## Verify it worked

1. Open **Admin → Payments**. The student's order should now read **Successful**
   with a paid date, not **Awaiting payment**.
2. Sign in as that student. **My courses** shows the course, and the lesson opens
   without the locked screen.
3. **My courses** no longer shows the course under **Applications waiting for
   payment**.

## Verified before shipping

- Full backend suite: **580 tests, OK (3 skipped)**, including nine new tests for
  this path: dashboard repair, overview repair, payment-history repair (with and
  without an application), provider outage, a genuinely unpaid checkout, no
  provider call when nothing is owed, the command, and running the command twice
  without double-enrolling.
- No model changes (`makemigrations --check` reports none).
