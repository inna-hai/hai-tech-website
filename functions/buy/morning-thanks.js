/**
 * GET /buy/morning-thanks?t=<signed token>
 * Morning successUrl for /buy/* purchases — verifies the payment (same as notify) and shows a thank-you page.
 */
import { handleMorningThanks } from '../_lib/buy-checkout.js';

export async function onRequestGet(context) {
  return handleMorningThanks(context);
}
