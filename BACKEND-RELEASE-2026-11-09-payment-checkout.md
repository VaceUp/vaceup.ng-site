# Backend release 2026-11-09 — a checkout link that can actually start

A course purchase stopped opening Paystack. The button on **Review checkout** sent
the learner to the provider's own page, which answered:

> We could not start this transaction
> It's either because the link is incorrect or the transaction is already completed

The cause was ours, not the provider's. Paystack starts a checkout link **once**.
The server stored the first link on the pending order and handed the same link
back on every later attempt, so the second visit could never start.

## What changed

`apps/payments/services.py` now asks Paystack what became of the stored attempt
before the link is handed back:

- **Still open** (`pending`, `ongoing`, `processing`, `queued`) — the same link is
  returned, so a learner who is halfway through the page, or who pressed the
  button twice, keeps one order and one link.
- **Already paid** (`success`) — the payment is confirmed and the enrollment is
  granted here and now. This repairs an order whose return page or webhook was
  missed: the learner is told the order is confirmed instead of being sent back
  to a dead link. The amount, currency and reference are checked before anything
  is granted.
- **Finished or unknown** (`abandoned`, `failed`, `reversed`, or a reference the
  provider no longer knows) — the attempt is marked `abandoned` and a **fresh
  reference and link** are minted. A late payment on the old link is still
  verified by its reference, so no charge is ever lost.
- **Paid, but for a different amount, currency or reference** — the attempt is
  marked `failed` and no second charge is offered. The screen names the reference
  and asks the learner to contact the academy.

The frontend at `/checkout/` now has one sentence for the repaired case —
`Your earlier payment for this order is confirmed. Your enrollment is open.` — with
**Open my courses** and **Payment history**. It deploys with the site from `master`.

## Install this after the 2026-11-03 package

This archive is one Python file. It carries no migration, no new dependency and no
`.env` line.

Upload `vaceup-backend-2026-11-09-payment-checkout.zip` to `/home/coqrpund/`, then:

```
cd /home/coqrpund
unzip -o vaceup-backend-2026-11-09-payment-checkout.zip -d vaceup_api
cd vaceup_api
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
python manage.py check
```

`check` should print `System check identified no issues (0 silenced).` (the
pre-existing object-storage warning is not this release). Then restart the app
(cPanel → Setup Python app → Restart).

Do not edit `.env`. Nothing in this release reads a new setting.

## Prove it reached the server

1. Sign in as a student who has an unpaid order and open **Review checkout**.
   Press **Continue to Paystack**. The Paystack page should open and show the card
   form, not **We could not start this transaction**.
2. Close the Paystack page without paying and press the button again. The provider
   is asked about the earlier attempt: while it is still open the same link is
   reused, and once it has closed a fresh link is made. Either way the card form
   should open. (Before this release the second visit could only be the dead-link
   screen.)
3. If a learner was already debited on an order that never confirmed, have them
   open **Review checkout** and press the button once. The page answers
   `Your earlier payment for this order is confirmed. Your enrollment is open.`
   and their course is in **My courses**.

To inspect an order directly, use its reference:

```
python manage.py shell -c "
from apps.payments.models import Payment
for p in Payment.objects.filter(status='pending').order_by('-created_at')[:10]:
    print(p.reference, p.student.email, p.amount, p.authorization_url)
"
```

Any order still listed there after this release will be repaired the next time the
learner presses the button: confirmed and enrolled if Paystack says it was paid, or
replaced with a fresh link if it was not.

## Verified before shipping

- Full backend suite: **571 tests ran, OK (3 skipped)** — including three new tests
  for the repaired, abandoned and open cases.
- Frontend type-checks clean and the production export builds.
- The repaired flow was driven in a real browser against a local API: a pending
  order whose provider transaction had completed produced the confirmation
  sentence, a new active enrollment, and no console errors. The screenshot is
  `checkout-settled.png` in the preview work directory.
