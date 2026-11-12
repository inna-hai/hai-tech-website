/**
 * POST /buy/morning-notify?t=<signed token>
 * Morning notifyUrl for /buy/* purchases. The body is not trusted: the payment is
 * verified against Morning and then forwarded to the CRM. Always answers 200.
 */
import { handleMorningNotify } from '../_lib/buy-checkout.js';

export async function onRequestPost(context) {
  return handleMorningNotify(context);
}
