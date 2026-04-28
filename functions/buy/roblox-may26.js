/**
 * GET /buy/roblox-may26
 *
 * Creates a fresh pending WooCommerce order for the Roblox Group May 2026
 * cohort (product 40158) and 302-redirects directly to the WC payment page,
 * bypassing the cart UI.
 *
 * Why a function: WooCommerce always redirects ?add-to-cart=ID through /cart/.
 * Pre-creating the order via REST gives us a /checkout/order-pay/<id>/?pay_for_order
 * URL that lands the customer straight on the payment form.
 */

const PRODUCT_ID = 40158;
const WC_SITE = 'https://haitechdigitalcourses.hai.tech';

export async function onRequestGet({ env, request }) {
  const wcKey = env.WOO_CONSUMER_KEY || 'ck_b206053e871dc496cb21312b88370d99ff4aadf5';
  const wcSecret = env.WOO_CONSUMER_SECRET || 'cs_411effc674399295754f01cce70908da70039fa2';
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
