'use client';

// Paystack returns every payment to PAYSTACK_CALLBACK_URL, which the server's
// setup guide sets to https://vaceup.ng/payment/callback. That address had no
// page, so a completed payment landed on a 404. The return screen is the same
// one at /payment/success/; this route renders it so both addresses work, and
// an academy that never edits .env still sees its confirmation.
export { default } from '../success/page';
