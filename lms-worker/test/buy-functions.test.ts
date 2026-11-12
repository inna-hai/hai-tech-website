import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-ignore — plain JS Pages Functions
import * as roblox from '../../functions/buy/roblox-may26.js';
// @ts-ignore
import * as mcCoding from '../../functions/buy/minecraft-summer-coding.js';
// @ts-ignore
import * as notify from '../../functions/buy/morning-notify.js';
// @ts-ignore
import * as thanks from '../../functions/buy/morning-thanks.js';
// @ts-ignore
import { _resetMorningTokenCache, signPurchaseToken } from '../../functions/_lib/morning.js';
import { mockFetch, MORNING_ENV, TOKEN_ROUTE } from './helpers';

const PAY_URL = 'https://pay.morning.test/checkout/xyz';

function ctx(request: Request, env: Record<string, string> = {}) {
  const pending: Promise<unknown>[] = [];
  return {
    request,
    env: { ...MORNING_ENV, ...env },
    waitUntil: (p: Promise<unknown>) => pending.push(p),
    flush: () => Promise.allSettled(pending),
  };
}

function post(path: string, fields: Record<string, string>) {
  return new Request(`https://hai.tech${path}`, { method: 'POST', body: new URLSearchParams(fields) });
}

beforeEach(() => _resetMorningTokenCache());
afterEach(() => vi.unstubAllGlobals());

describe('/buy/<slug> Pages Functions (morning)', () => {
  it('GET renders an RTL billing form preserving UTM params', async () => {
    const f = mockFetch({});
    const res = await roblox.onRequestGet(ctx(new Request('https://hai.tech/buy/roblox-may26?utm_source=fb&utm_campaign=may')));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('method="POST" action="/buy/roblox-may26"');
    expect(html).toContain('name="utm_source" value="fb"');
    expect(html).toContain('name="utm_campaign" value="may"');
    expect(html).toContain('₪995');
    expect(f.calls).toHaveLength(0);
  });

  it('POST validates input', async () => {
    mockFetch({});
    const res = await roblox.onRequestPost(ctx(post('/buy/roblox-may26', { name: 'א', phone: '12', email: 'bad' })));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('נא להזין שם מלא');
  });

  it('POST builds the Morning payment form (roblox: 995, 2 payments) and redirects', async () => {
    const f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: PAY_URL }] });
    const res = await roblox.onRequestPost(ctx(post('/buy/roblox-may26', {
      name: 'רינה לוי', phone: '052-1234567', email: 'rina@example.com', utm_source: 'fb', utm_campaign: 'may',
    })));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(PAY_URL);
    const [form] = f.find('/payments/form', 'POST');
    expect(form.url).toBe('https://api.greeninvoice.co.il/api/v1/payments/form');
    const b = form.body;
    const ref = b.custom;
    expect(ref).toMatch(/^HT-[A-Z0-9]{10}$/);
    expect(b).toMatchObject({
      type: 320, amount: 995, currency: 'ILS', vatType: 0, lang: 'he', maxPayments: 2,
      client: { name: 'רינה לוי', emails: ['rina@example.com'], phone: '052-1234567' },
      income: [{ quantity: 1, price: 995, currency: 'ILS', vatType: 1 }],
    });
    expect(b.description).toContain(`הזמנה ${ref}`);
    expect(b.description).not.toContain('cycle');
    expect(b.successUrl).toMatch(/^https:\/\/hai\.tech\/buy\/morning-thanks\?t=/);
    expect(b.notifyUrl).toMatch(/^https:\/\/hai\.tech\/buy\/morning-notify\?t=/);
    expect(b.failureUrl).toBe('https://hai.tech/buy/roblox-may26?payment=failed&utm_source=fb&utm_campaign=may');
    expect(f.calls.some((c) => c.url.includes('haitechdigitalcourses'))).toBe(false);
  });

  it('minecraft summer track uses 497 and the track title', async () => {
    const f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: PAY_URL }] });
    const res = await mcCoding.onRequestPost(ctx(post('/buy/minecraft-summer-coding', { name: 'רינה לוי', phone: '0521234567', email: 'rina@example.com' })));
    expect(res.status).toBe(303);
    const b = f.find('/payments/form')[0].body;
    expect(b.amount).toBe(497);
    expect(b.maxPayments).toBe(1);
    expect(b.income[0].description).toBe('קיץ במיינקראפט - תכנות');
  });

  it('notify verifies with Morning and forwards to the CRM with cycleId; bad token is rejected', async () => {
    const f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: PAY_URL }] });
    await roblox.onRequestPost(ctx(post('/buy/roblox-may26', { name: 'רינה לוי', phone: '0521234567', email: 'rina@example.com', utm_source: 'fb' })));
    const form = f.find('/payments/form')[0].body;
    const ref = form.custom;
    const notifyUrl = form.notifyUrl as string;
    vi.unstubAllGlobals();

    const g = mockFetch({
      ...TOKEN_ROUTE,
      'GET /documents/doc-aaaaaaaa': () => [200, { id: 'doc-aaaaaaaa', type: 320, status: 1, amount: 995, description: form.description }],
      'POST /api/payments/morning/external': () => [200, { ok: true }],
    });
    const c1 = ctx(new Request(notifyUrl, { method: 'POST', body: JSON.stringify({ documentId: 'doc-aaaaaaaa' }) }));
    const r1 = await notify.onRequestPost(c1);
    await c1.flush();
    expect(await r1.json()).toEqual({ ok: true, confirmed: true });
    const [crm] = g.find('crm.orma-ai.com/api/payments/morning/external', 'POST');
    expect(crm.headers['x-api-key']).toBe('test-crm-key');
    expect(crm.body).toMatchObject({
      documentId: 'doc-aaaaaaaa', ref, expectedAmount: 995, source: 'buy-roblox-may26',
      cycleId: 'fc6fee2c-80b5-4120-a68c-5a207d1441be',
      customer: { name: 'רינה לוי', email: 'rina@example.com', phone: '0521234567' },
    });

    // Tampered token
    const bad = notifyUrl.replace(/.{4}$/, '0000');
    const r2 = await notify.onRequestPost(ctx(new Request(bad, { method: 'POST', body: '{}' })));
    expect(r2.status).toBe(200);
    expect(((await r2.json()) as any).ok).toBe(false);
  });

  it('notify with amount mismatch does not forward to the CRM', async () => {
    const token = await signPurchaseToken(MORNING_ENV, { ref: 'HT-AAAAAAAAAA', k: 'buy', p: 'minecraft-summer-math', a: 497, ts: Math.floor(Date.now() / 1000) });
    const f = mockFetch({
      ...TOKEN_ROUTE,
      'POST /documents/search': () => [200, { items: [{ id: 'doc-bbbbbbbb', type: 320, status: 1, amount: 10, description: 'x · הזמנה HT-AAAAAAAAAA' }] }],
    });
    const res = await notify.onRequestPost(ctx(new Request(`https://hai.tech/buy/morning-notify?t=${encodeURIComponent(token)}`, { method: 'POST', body: '' })));
    expect(await res.json()).toEqual({ ok: true, confirmed: false });
    expect(f.find('/api/payments/morning/external')).toHaveLength(0);
  });

  it('thank-you page runs the same verification', async () => {
    const token = await signPurchaseToken(MORNING_ENV, { ref: 'HT-CCCCCCCCCC', k: 'buy', p: 'minecraft-summer-math', a: 497, ts: Math.floor(Date.now() / 1000), em: 'a@b.co' });
    const f = mockFetch({
      ...TOKEN_ROUTE,
      'POST /documents/search': () => [200, { items: [{ id: 'doc-cccccccc', type: 320, status: 1, amount: 497, description: 'קיץ · הזמנה HT-CCCCCCCCCC' }] }],
    });
    const c = ctx(new Request(`https://hai.tech/buy/morning-thanks?t=${encodeURIComponent(token)}`));
    const res = await thanks.onRequestGet(c);
    await c.flush();
    expect(await res.text()).toContain('התשלום התקבל');
    expect(f.find('/api/payments/morning/external')[0].body).toMatchObject({ source: 'buy-minecraft-summer-math', documentId: 'doc-cccccccc' });
  });

  it('PAYMENTS_PROVIDER=woocommerce keeps the legacy redirect and requires env credentials (no hardcoded keys)', async () => {
    const f = mockFetch({ 'POST /wp-json/wc/v3/orders': () => [201, { id: 1, payment_url: 'https://haitechdigitalcourses.hai.tech/pay/1' }] });
    const noCreds = await roblox.onRequestGet(ctx(new Request('https://hai.tech/buy/roblox-may26'), { PAYMENTS_PROVIDER: 'woocommerce' }));
    expect(noCreds.status).toBe(500);
    expect(f.calls).toHaveLength(0);
    const ok = await roblox.onRequestGet(ctx(new Request('https://hai.tech/buy/roblox-may26'), { PAYMENTS_PROVIDER: 'woocommerce', WOO_CONSUMER_KEY: 'k', WOO_CONSUMER_SECRET: 's' }));
    expect(ok.status).toBe(302);
    expect(f.calls[0].headers.authorization).toBe('Basic ' + btoa('k:s'));
  });
});
