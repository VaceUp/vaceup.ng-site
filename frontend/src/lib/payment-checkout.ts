import type { Payment } from './api';

/** Never create a client-priced fallback charge or redirect to an arbitrary host. */
export function paymentRedirect(payment: Payment, quotedTotal: string): string {
  if (payment.status !== 'pending' || !payment.reference || Number(payment.amount) !== Number(quotedTotal) || payment.currency !== 'NGN') {
    throw new Error('The payment order does not match this checkout. Refresh the order and review the total.');
  }
  let destination: URL;
  try { destination = new URL(payment.authorization_url); }
  catch { throw new Error('A secure payment link was not returned. Refresh checkout and try again.'); }
  if (destination.protocol !== 'https:' || destination.hostname !== 'checkout.paystack.com' || destination.username || destination.password || destination.port) {
    throw new Error('The payment link could not be verified. Contact support before paying.');
  }
  return destination.href;
}
