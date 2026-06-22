const WC_SITE = 'https://haitechdigitalcourses.hai.tech';
const PRICE_ILS = 497;

const TRACKS = {
  english: {
    title: 'קיץ במיינקראפט - אנגלית',
    label: 'אנגלית במיינקראפט',
    time: '10:00',
  },
  math: {
    title: 'קיץ במיינקראפט - מתמטיקה',
    label: 'מתמטיקה במיינקראפט',
    time: '11:30',
  },
  astronomy: {
    title: 'קיץ במיינקראפט - אסטרונומיה',
    label: 'אסטרונומיה במיינקראפט',
    time: '13:00',
  },
  coding: {
    title: 'קיץ במיינקראפט - תכנות',
    label: 'תכנות במיינקראפט',
    time: '14:30',
  },
  football: {
    title: 'קיץ במיינקראפט - כדורגל',
    label: 'כדורגל במיינקראפט',
    time: '16:00',
  },
};

export async function redirectToMinecraftSummerCheckout(trackKey, { env, request }) {
  const track = TRACKS[trackKey];
  if (!track) return new Response('Unknown summer track', { status: 404 });

  const wcKey = env.WOO_CONSUMER_KEY || env.WOO_API_KEY || 'ck_b206053e871dc496cb21312b88370d99ff4aadf5';
  const wcSecret = env.WOO_CONSUMER_SECRET || env.WOO_API_SECRET || 'cs_411effc674399295754f01cce70908da70039fa2';
  const auth = 'Basic ' + btoa(`${wcKey}:${wcSecret}`);

  const url = new URL(request.url);
  const refSource = url.searchParams.get('utm_source') || url.searchParams.get('s') || 'direct';
  const refCampaign = url.searchParams.get('utm_campaign') || 'minecraft-summer-2026';

  const body = {
    payment_method: 'greeninvoice-creditcard',
    payment_method_title: 'כרטיס אשראי / ביט',
    status: 'pending',
    customer_id: 354,
    fee_lines: [
      {
        name: track.title,
        total: PRICE_ILS.toFixed(2),
      },
    ],
    customer_note: `Source: ${refSource} | Campaign: ${refCampaign} | Track: ${track.label} | Time: ${track.time}`,
    meta_data: [
      { key: '_haitech_campaign', value: 'minecraft-summer-2026' },
      { key: '_haitech_track', value: trackKey },
      { key: '_haitech_track_label', value: track.label },
      { key: '_haitech_track_time', value: track.time },
      { key: '_haitech_source', value: refSource },
    ],
  };

  const wcRes = await fetch(`${WC_SITE}/wp-json/wc/v3/orders`, {
    method: 'POST',
    headers: {
      Authorization: auth,
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
