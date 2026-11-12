/**
 * Shared /buy/<slug> checkout for Pages Functions.
 *
 * PAYMENTS_PROVIDER = "morning" (default, also when unset):
 *   GET  /buy/<slug>  → small RTL billing-details form (name / phone / email; UTM kept as hidden fields)
 *   POST /buy/<slug>  → creates a Morning hosted payment form and redirects (303) to it
 *   Morning then calls /buy/morning-notify?t=… (notifyUrl) and redirects to /buy/morning-thanks?t=… (successUrl);
 *   both verify the payment with Morning and forward it to the CRM.
 * PAYMENTS_PROVIDER = "woocommerce": legacy WooCommerce pending-order redirect (GET only).
 */

import {
  createMorningPaymentForm,
  escapeHtml,
  extractCandidateDocumentId,
  findPaidMorningDocument,
  forwardPaymentToCrm,
  generateRef,
  signPurchaseToken,
  verifyPurchaseToken,
} from './morning.js';

const MC_SUMMER_PRICE_ILS = 497;
const mcTrack = (key, title, label, time) => ({
  title,
  label,
  time,
  price: () => MC_SUMMER_PRICE_ILS,
  maxPayments: 1,
  campaign: 'minecraft-summer-2026',
  source: `buy-minecraft-summer-${key}`,
});

export const PRODUCTS = {
  'roblox-may26': {
    // Price as advertised on /roblox-קבוצה-מאי-2026.html (₪995, "אפשר לחלק ל-2 תשלומים").
    // Override with env ROBLOX_MAY26_PRICE_ILS.
    title: 'קורס פיתוח משחקים ברובלוקס — קבוצה חדשה (12 מפגשי לייב)',
    label: 'קבוצת רובלוקס — 12 מפגשי לייב',
    price: (env) => (env.ROBLOX_MAY26_PRICE_ILS !== undefined && env.ROBLOX_MAY26_PRICE_ILS !== ''
      ? Number(env.ROBLOX_MAY26_PRICE_ILS) : 995),
    maxPayments: 2,
    campaign: 'roblox-group-may26',
    source: 'buy-roblox-may26',
    cycleId: 'fc6fee2c-80b5-4120-a68c-5a207d1441be',
  },
  'minecraft-summer-english': mcTrack('english', 'קיץ במיינקראפט - אנגלית', 'אנגלית במיינקראפט', '10:00'),
  'minecraft-summer-math': mcTrack('math', 'קיץ במיינקראפט - מתמטיקה', 'מתמטיקה במיינקראפט', '11:30'),
  'minecraft-summer-astronomy': mcTrack('astronomy', 'קיץ במיינקראפט - אסטרונומיה', 'אסטרונומיה במיינקראפט', '13:00'),
  'minecraft-summer-coding': mcTrack('coding', 'קיץ במיינקראפט - תכנות', 'תכנות במיינקראפט', '14:30'),
  'minecraft-summer-football': mcTrack('football', 'קיץ במיינקראפט - כדורגל', 'כדורגל במיינקראפט', '16:00'),
};

export function isMorningProvider(env) {
  return String(env.PAYMENTS_PROVIDER || '').trim().toLowerCase() !== 'woocommerce';
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

function page(title, inner) {
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(title)} | דרך ההייטק</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#f5f3ff;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;border-radius:20px;padding:32px 26px;max-width:440px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.12)}
h1{color:#1e1b4b;font-size:1.4rem;margin:0 0 6px}.sub{color:#7c3aed;font-weight:600;margin:0 0 4px}
.price{font-size:2rem;font-weight:800;color:#1e1b4b;margin:6px 0 18px}p{color:#475569;line-height:1.7}
label{display:block;font-size:.9rem;font-weight:600;color:#374151;margin-bottom:4px}
input{width:100%;padding:11px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:1rem;box-sizing:border-box;margin-bottom:14px}
input:focus{border-color:#7c3aed;outline:none}
button,a.btn{display:block;width:100%;text-align:center;box-sizing:border-box;padding:14px;background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#fff;border:none;border-radius:12px;font-size:1.1rem;font-weight:700;cursor:pointer;text-decoration:none}
.err{background:#fef2f2;color:#b91c1c;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:.9rem}
.secure{text-align:center;font-size:.78rem;color:#9ca3af;margin-top:12px}
</style></head><body><div class="card">${inner}</div></body></html>`;
}

export function renderBuyForm(slug, product, env, { error, values = {} } = {}) {
  const price = product.price(env);
  const v = (k) => escapeHtml(values[k] || '');
  const inner = `
<h1>הרשמה ותשלום</h1>
<div class="sub">${escapeHtml(product.title)}</div>
<div class="price">₪${escapeHtml(price)}</div>
${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
<form method="POST" action="/buy/${escapeHtml(slug)}">
  <label for="name">שם מלא (לקבלה) *</label>
  <input id="name" name="name" type="text" required minlength="2" autocomplete="name" value="${v('name')}">
  <label for="phone">טלפון *</label>
  <input id="phone" name="phone" type="tel" required autocomplete="tel" dir="ltr" placeholder="050-0000000" value="${v('phone')}">
  <label for="email">אימייל (לשליחת הקבלה) *</label>
  <input id="email" name="email" type="email" required autocomplete="email" dir="ltr" value="${v('email')}">
  <input type="hidden" name="utm_source" value="${v('utm_source')}">
  <input type="hidden" name="utm_campaign" value="${v('utm_campaign')}">
  <button type="submit">המשך לתשלום מאובטח ←</button>
</form>
<div class="secure">🔒 תשלום מאובטח דרך Morning | כרטיס אשראי / ביט${product.maxPayments > 1 ? ` | עד ${product.maxPayments} תשלומים` : ''}</div>`;
  return page(product.title, inner);
}

function normalizePhone(p) {
  return String(p || '').replace(/[-\s()]/g, '');
}

function validate({ name, phone, email }) {
  if (!name || name.trim().length < 2) return 'נא להזין שם מלא';
  if (/<[^>]*>|javascript:/i.test(name)) return 'שם לא תקין';
  if (!/^(05\d{8}|9725\d{8}|\+9725\d{8}|0[2-9]\d{7})$/.test(normalizePhone(phone))) return 'נא להזין מספר טלפון תקין';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) return 'נא להזין כתובת אימייל תקינה';
  return null;
}

/** GET/POST /buy/<slug> */
export async function handleBuy(slug, context, legacyWooRedirect) {
  const { request, env } = context;
  const product = PRODUCTS[slug];
  if (!product) return new Response('Unknown product', { status: 404 });

  if (!isMorningProvider(env)) {
    if (request.method !== 'GET' || !legacyWooRedirect) return new Response('Method Not Allowed', { status: 405 });
    return legacyWooRedirect(context);
  }

  const url = new URL(request.url);
  const price = product.price(env);
  if (!(price > 0)) {
    console.error(`[BUY ${slug}] price not configured`);
    return html(page('שגיאה', '<h1>ההרשמה אינה זמינה כרגע</h1><p>נא לפנות אלינו ב-WhatsApp 053-300-9742 או info@hai.tech</p>'), 503);
  }

  if (request.method === 'GET') {
    const values = {
      utm_source: url.searchParams.get('utm_source') || url.searchParams.get('s') || '',
      utm_campaign: url.searchParams.get('utm_campaign') || '',
      name: url.searchParams.get('name') || '',
      phone: url.searchParams.get('phone') || '',
      email: url.searchParams.get('email') || '',
    };
    const error = url.searchParams.get('payment') === 'failed' ? 'התשלום לא הושלם ולא בוצע חיוב. אפשר לנסות שוב.' : undefined;
    return html(renderBuyForm(slug, product, env, { values, error }));
  }

  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let form;
  try { form = await request.formData(); } catch { form = new FormData(); }
  const values = {
    name: String(form.get('name') || '').trim(),
    phone: String(form.get('phone') || '').trim(),
    email: String(form.get('email') || '').trim(),
    utm_source: String(form.get('utm_source') || '').trim().slice(0, 80),
    utm_campaign: String(form.get('utm_campaign') || '').trim().slice(0, 80),
  };
  const error = validate(values);
  if (error) return html(renderBuyForm(slug, product, env, { values, error }), 400);

  const origin = url.origin;
  const ctx = {
    ref: generateRef(),
    k: 'buy',
    p: slug,
    a: price,
    ts: Math.floor(Date.now() / 1000),
    em: values.email.toLowerCase(),
    n: values.name,
    ph: values.phone,
    s: values.utm_source || 'direct',
    cp: values.utm_campaign || product.campaign,
  };

  try {
    const token = encodeURIComponent(await signPurchaseToken(env, ctx));
    const back = new URLSearchParams({ payment: 'failed' });
    if (values.utm_source) back.set('utm_source', values.utm_source);
    if (values.utm_campaign) back.set('utm_campaign', values.utm_campaign);
    const paymentUrl = await createMorningPaymentForm(env, {
      ref: ctx.ref,
      title: product.title,
      amount: price,
      client: { name: values.name, email: values.email, phone: values.phone },
      successUrl: `${origin}/buy/morning-thanks?t=${token}`,
      failureUrl: `${origin}/buy/${slug}?${back.toString()}`,
      notifyUrl: `${origin}/buy/morning-notify?t=${token}`,
      maxPayments: product.maxPayments || 1,
    });
    return new Response(null, { status: 303, headers: { Location: paymentUrl, 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error(`[BUY ${slug}] Morning error:`, err);
    return html(renderBuyForm(slug, product, env, { values, error: 'שגיאה ביצירת התשלום. נסו שוב בעוד רגע או פנו אלינו ב-WhatsApp 053-300-9742.' }), 502);
  }
}

/** Verify a /buy purchase with Morning and forward it to the CRM. Returns the doc or null. */
export async function confirmBuyPurchase(context, ctx, candidateDocId) {
  const { env } = context;
  const product = PRODUCTS[ctx.p];
  if (ctx.k !== 'buy' || !product) return null;
  const doc = await findPaidMorningDocument(env, ctx, candidateDocId);
  if (!doc) return null;
  const forward = forwardPaymentToCrm(env, {
    documentId: doc.id,
    ref: ctx.ref,
    expectedAmount: ctx.a,
    source: product.source,
    description: `${product.title} | Source: ${ctx.s || 'direct'} | Campaign: ${ctx.cp || product.campaign}`,
    ...(product.cycleId ? { cycleId: product.cycleId } : {}),
    customer: {
      name: ctx.n || doc.client?.name,
      email: ctx.em || doc.client?.emails?.[0],
      phone: ctx.ph || doc.client?.mobile || doc.client?.phone,
    },
  });
  if (typeof context.waitUntil === 'function') context.waitUntil(forward);
  else await forward;
  return doc;
}

/** POST /buy/morning-notify?t=…  — always 2xx (Morning disables failing webhooks). */
export async function handleMorningNotify(context) {
  const { request, env } = context;
  let raw = '';
  try { raw = await request.text(); } catch { /* ignore */ }
  const json = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const ctx = await verifyPurchaseToken(env, new URL(request.url).searchParams.get('t'));
  if (!ctx || ctx.k !== 'buy') {
    console.warn('[BUY notify] invalid or missing token');
    return json({ ok: false, error: 'invalid token' });
  }
  try {
    const doc = await confirmBuyPurchase(context, ctx, extractCandidateDocumentId(raw));
    return json({ ok: true, confirmed: !!doc });
  } catch (err) {
    console.error(`[BUY notify] ${ctx.ref}:`, err);
    return json({ ok: true, confirmed: false });
  }
}

/** GET /buy/morning-thanks?t=…  — Morning successUrl. */
export async function handleMorningThanks(context) {
  const { request, env } = context;
  const ctx = await verifyPurchaseToken(env, new URL(request.url).searchParams.get('t'));
  if (!ctx || ctx.k !== 'buy') {
    return html(page('קישור לא תקין', '<h1>הקישור אינו תקין</h1><p>אם ביצעתם תשלום, קבלה נשלחה אליכם במייל. לשאלות: info@hai.tech</p><a class="btn" href="/">לאתר</a>'), 400);
  }
  let doc = null;
  try { doc = await confirmBuyPurchase(context, ctx, null); } catch (err) { console.error(`[BUY thanks] ${ctx.ref}:`, err); }
  const product = PRODUCTS[ctx.p];
  const inner = doc
    ? `<h1>🎉 תודה! התשלום התקבל</h1><div class="sub">${escapeHtml(product?.title || '')}</div><p>מספר הזמנה: <b dir="ltr">${escapeHtml(ctx.ref)}</b><br>קבלה נשלחה לכתובת המייל שהזנתם. ניצור איתכם קשר בהקדם עם כל הפרטים.</p><a class="btn" href="/">חזרה לאתר</a>`
    : `<h1>תודה! התשלום בעיבוד</h1><div class="sub">${escapeHtml(product?.title || '')}</div><p>מספר הזמנה: <b dir="ltr">${escapeHtml(ctx.ref)}</b><br>אישור וקבלה יישלחו למייל בדקות הקרובות. לשאלות: WhatsApp 053-300-9742</p><a class="btn" href="/">חזרה לאתר</a>`;
  return html(page('תודה על ההרשמה', inner));
}
