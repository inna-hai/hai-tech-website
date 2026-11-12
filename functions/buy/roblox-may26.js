/**
 * GET/POST /buy/roblox-may26
 *
 * Default (PAYMENTS_PROVIDER unset or "morning"): billing-details form → Morning hosted
 * payment form (see functions/_lib/buy-checkout.js). CRM cycle fc6fee2c-80b5-4120-a68c-5a207d1441be.
 *
 * LEGACY (PAYMENTS_PROVIDER=woocommerce): creates a fresh pending WooCommerce order for the Roblox Group May 2026
 * cohort (product 40158) and 302-redirects directly to the WC payment page,
 * bypassing the cart UI.
 *
 * Why a function: WooCommerce always redirects ?add-to-cart=ID through /cart/.
 * Pre-creating the order via REST gives us a /checkout/order-pay/<id>/?pay_for_order
 * URL that lands the customer straight on the payment form.
 */

import { handleBuy } from '../_lib/buy-checkout.js';

const PRODUCT_ID = 40158;
const WC_SITE = 'https://haitechdigitalcourses.hai.tech';

export async function onRequestGet(context) {
  return handleBuy('roblox-may26', context, legacyWooRedirect);
}

export async function onRequestPost(context) {
  return handleBuy('roblox-may26', context, legacyWooRedirect);
}

// Legacy WooCommerce path (PAYMENTS_PROVIDER=woocommerce). Credentials come from env only.
async function legacyWooRedirect({ env, request }) {
  const wcKey = env.WOO_CONSUMER_KEY || env.WOO_API_KEY;
  const wcSecret = env.WOO_CONSUMER_SECRET || env.WOO_API_SECRET;
  if (!wcKey || !wcSecret) return new Response('WooCommerce credentials not configured', { status: 500 });
  const auth = 'Basic ' + btoa(`${wcKey}:${wcSecret}`);

  // Carry UTM/source/referrer for attribution into the WC order notes
  const url = new URL(request.url);
  const refSource = url.searchParams.get('utm_source') || url.searchParams.get('s') || 'direct';
  const refCampaign = url.searchParams.get('utm_campaign') || 'roblox-group-may26';

  const body = {
    status: 'pending',
    line_items: [{ product_id: PRODUCT_ID, quantity: 1 }],
    customer_note: `Source: ${refSource} | Campaign: ${refCampaign}`,
    meta_data: [
      { key: '_haitech_campaign', value: 'roblox-group-may26' },
      { key: '_haitech_cycle_id', value: 'fc6fee2c-80b5-4120-a68c-5a207d1441be' },
      { key: '_haitech_source', value: refSource },
    ],
  };

  const wcRes = await fetch(`${WC_SITE}/wp-json/wc/v3/orders`, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!wcRes.ok) {
    const text = await wcRes.text();
    return new Response(`WC error ${wcRes.status}: ${text.slice(0, 400)}`, { status: 502 });
  }

  const order = await wcRes.json();
  if (!order.payment_url) {
    return new Response('No payment_url in WC response', { status: 502 });
  }

  return Response.redirect(order.payment_url, 302);
}
