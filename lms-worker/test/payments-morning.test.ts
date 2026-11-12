import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as jose from 'jose';
import app from '../src/index';
import { _resetMorningTokenCache, signPurchaseToken } from '../src/utils/morning';
import { createFakeD1, makeExecCtx, mockFetch, MORNING_ENV, TOKEN_ROUTE } from './helpers';

const JWT_SECRET = 'jwt-test-secret';
const MORNING_PAY_URL = 'https://pay.morning.test/checkout/abc';

async function jwtFor(userId: string) {
  return new jose.SignJWT({ userId, email: 'kid@example.com', role: 'student' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function setup(extraEnv: Record<string, string> = {}) {
  const { d1, raw } = createFakeD1();
  raw.exec(`INSERT INTO users (id, email, password_hash, name, phone) VALUES ('u1', 'kid@example.com', 'x', 'דני כהן', '0501234567')`);
  raw.exec(`INSERT INTO courses (id, title, price, is_published, woo_product_id) VALUES ('python', 'קורס פייתון', 497, 1, 30680)`);
  raw.exec(`INSERT INTO coupons (id, code, discount_type, discount_value, max_uses, current_uses, is_active) VALUES ('cp1', 'SAVE20', 'percent', 20, 10, 0, 1)`);
  const env = { DB: d1, JWT_SECRET, CORS_ORIGIN: 'https://hai.tech', ...MORNING_ENV, ...extraEnv } as any;
  return { env, raw };
}

function makeDoc(ref: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-11111111', number: 70001, type: 320, status: 1, amount: 497,
    description: `קורס פייתון · הזמנה ${ref}`, remarks: `הזמנה ${ref}`,
    client: { name: 'דני כהן', emails: ['kid@example.com'], phone: '0501234567' },
    ...overrides,
  };
}

let ipCounter = 0;
function req(env: any, path: string, init: RequestInit = {}, exec = makeExecCtx()) {
  // Unique IP per request so the global in-memory rate limiter never interferes.
  const headers = new Headers(init.headers);
  headers.set('cf-connecting-ip', `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`);
  return app.request(`https://hai.tech${path}`, { ...init, headers }, env, exec.ctx);
}

async function createPayment(env: any, couponCode?: string) {
  const token = await jwtFor('u1');
  return req(env, '/lms/api/payments/create-payment/python', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(couponCode ? { couponCode } : {}),
  });
}

beforeEach(() => _resetMorningTokenCache());
afterEach(() => vi.unstubAllGlobals());

describe('POST /create-payment/:courseId (morning)', () => {
  it('creates a Morning payment form with the expected body', async () => {
    const { env } = setup();
    const f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: MORNING_PAY_URL }] });

    const res = await createPayment(env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.paymentUrl).toBe(MORNING_PAY_URL);
    expect(data.orderId).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
    expect(data.total).toBe('497.00');

    const tokenCall = f.find('/idp/v1/oauth/token')[0];
    expect(tokenCall.url).toBe('https://api.morning.co/idp/v1/oauth/token');
    expect(tokenCall.body).toEqual({ grant_type: 'client_credentials', client_id: 'test-key-id', client_secret: 'test-key-secret' });

    const [form] = f.find('/payments/form', 'POST');
    expect(form.url).toBe('https://api.greeninvoice.co.il/api/v1/payments/form');
    expect(form.headers.authorization).toBe('Bearer tok-123');
    const b = form.body;
    const ref = b.custom;
    expect(ref).toMatch(/^HT-[A-Z0-9]{10}$/);
    expect(data.ref).toBe(ref);
    expect(b).toMatchObject({
      description: `קורס פייתון · הזמנה ${ref}`,
      type: 320, amount: 497, currency: 'ILS', vatType: 0, lang: 'he', maxPayments: 1,
      pluginId: '05873f9d-7030-4b66-ad02-338edadee6fc',
      client: { name: 'דני כהן', emails: ['kid@example.com'], phone: '0501234567' },
      income: [{ description: 'קורס פייתון', quantity: 1, price: 497, currency: 'ILS', vatType: 1 }],
      remarks: `הזמנה ${ref}`,
      failureUrl: 'https://hai.tech/lms/course.html?id=python&payment=failed',
    });
    expect(b.group).toBeUndefined();
    expect(b.successUrl).toContain('https://hai.tech/lms/api/payments/morning/return?t=');
    expect(b.notifyUrl).toContain('https://hai.tech/lms/api/payments/morning/notify?t=');
    expect(decodeURIComponent(b.notifyUrl.split('t=')[1])).toBe(data.orderId);
    // No WooCommerce calls at all
    expect(f.calls.some((c) => c.url.includes('haitechdigitalcourses'))).toBe(false);
  });

  it('applies an LMS coupon server-side and increments its usage', async () => {
    const { env, raw } = setup();
    const f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: MORNING_PAY_URL }] });
    const res = await createPayment(env, 'save20');
    expect(res.status).toBe(200);
    const [form] = f.find('/payments/form', 'POST');
    expect(form.body.amount).toBe(398);
    expect(form.body.income[0].price).toBe(398);
    expect((raw.prepare("SELECT current_uses FROM coupons WHERE id='cp1'").get() as any).current_uses).toBe(1);
  });

  it('rejects non-LMS coupon codes (no WooCommerce fallback)', async () => {
    const { env } = setup();
    const f = mockFetch({ ...TOKEN_ROUTE });
    const res = await createPayment(env, 'WOOCODE');
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('קוד קופון לא תקין');
    expect(f.find('/payments/form')).toHaveLength(0);
    expect(f.calls.some((c) => c.url.includes('haitechdigitalcourses'))).toBe(false);
  });

  it('treats a Morning error response as a failure', async () => {
    const { env } = setup();
    mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: false, errorCode: 2403, errorDescription: 'bad' }] });
    const res = await createPayment(env);
    expect(res.status).toBe(500);
  });
});

describe('POST /validate-coupon (morning)', () => {
  it('returns invalid for unknown codes without calling WooCommerce', async () => {
    const { env } = setup();
    const f = mockFetch({});
    const res = await req(env, '/lms/api/payments/validate-coupon', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'WOOCODE' }),
    });
    expect(await res.json()).toEqual({ valid: false, error: 'קוד קופון לא תקין' });
    expect(f.calls).toHaveLength(0);
  });

  it('still validates LMS coupons', async () => {
    const { env } = setup();
    mockFetch({});
    const res = await req(env, '/lms/api/payments/validate-coupon', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'save20', courseId: 'python' }),
    });
    expect(await res.json()).toMatchObject({ valid: true, source: 'lms', coupon: { code: 'SAVE20', discountType: 'percent', discountValue: 20 } });
  });
});

describe('POST /morning/notify', () => {
  async function orderToken(env: any) {
    const f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: MORNING_PAY_URL }] });
    const data = (await (await createPayment(env)).json()) as any;
    const ref = f.find('/payments/form')[0].body.custom as string;
    vi.unstubAllGlobals();
    return { token: data.orderId as string, ref };
  }

  const notify = (env: any, token: string, body: string, exec = makeExecCtx()) =>
    req(env, `/lms/api/payments/morning/notify?t=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }, exec);

  const enrollments = (raw: any) => raw.prepare('SELECT user_id, course_id, payment_id, status FROM enrollments').all();

  it('rejects a bad signature (2xx, no Morning lookup, no enrollment)', async () => {
    const { env, raw } = setup();
    const { token } = await orderToken(env);
    const f = mockFetch({ ...TOKEN_ROUTE });
    const tampered = token.slice(0, -4) + (token.endsWith('0000') ? '1111' : '0000');
    const res = await notify(env, tampered, JSON.stringify({ documentId: 'doc-11111111' }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).ok).toBe(false);
    expect(f.find('/documents')).toHaveLength(0);
    expect(enrollments(raw)).toHaveLength(0);
  });

  it('rejects a token signed with another secret', async () => {
    const { env, raw } = setup();
    mockFetch({ ...TOKEN_ROUTE });
    const forged = await signPurchaseToken({ PAYMENT_LINK_SECRET: 'attacker' }, { ref: 'HT-ABCDEFGHJK', k: 'course', a: 1, ts: Math.floor(Date.now() / 1000), u: 'u1', c: 'python' });
    const res = await notify(env, forged, '{}');
    expect(((await res.json()) as any).ok).toBe(false);
    expect(enrollments(raw)).toHaveLength(0);
  });

  it('valid signature + Morning doc → enrollment with payment_id morning:<id> and CRM forward', async () => {
    const { env, raw } = setup();
    const { token, ref } = await orderToken(env);
    const f = mockFetch({
      ...TOKEN_ROUTE,
      'GET /documents/doc-11111111': () => [200, makeDoc(ref)],
      'POST /api/payments/morning/external': () => [200, { ok: true }],
    });
    const exec = makeExecCtx();
    const res = await notify(env, token, JSON.stringify({ documentId: 'doc-11111111' }), exec);
    await exec.flush();
    expect(await res.json()).toMatchObject({ ok: true, confirmed: true, enrollment: 'enrolled' });
    expect(enrollments(raw)).toEqual([{ user_id: 'u1', course_id: 'python', payment_id: 'morning:doc-11111111', status: 'active' }]);
    expect(f.find('/documents/search')).toHaveLength(0);

    const [crm] = f.find('crm.orma-ai.com/api/payments/morning/external', 'POST');
    expect(crm.headers['x-api-key']).toBe('test-crm-key');
    expect(crm.body).toMatchObject({ documentId: 'doc-11111111', ref, expectedAmount: 497, source: 'lms-course', customer: { email: 'kid@example.com' } });
    // Welcome + purchase notification emails
    expect(f.find('notify.hai.tech/send-email')).toHaveLength(2);
  });

  it('amount mismatch → no enrollment', async () => {
    const { env, raw } = setup();
    const { token, ref } = await orderToken(env);
    mockFetch({
      ...TOKEN_ROUTE,
      'GET /documents/doc-11111111': () => [200, makeDoc(ref, { amount: 1 })],
      'POST /documents/search': () => [200, { total: 1, items: [makeDoc(ref, { amount: 1 })] }],
    });
    const res = await notify(env, token, JSON.stringify({ documentId: 'doc-11111111' }));
    expect(await res.json()).toMatchObject({ ok: true, confirmed: false });
    expect(enrollments(raw)).toHaveLength(0);
  });

  it('doc without the ref or cancelled → no enrollment', async () => {
    const { env, raw } = setup();
    const { token, ref } = await orderToken(env);
    mockFetch({
      ...TOKEN_ROUTE,
      'POST /documents/search': () => [200, { items: [makeDoc('HT-OTHER00000'), makeDoc(ref, { status: 4 }), makeDoc(ref, { type: 300 })] }],
    });
    const res = await notify(env, token, '');
    expect(await res.json()).toMatchObject({ confirmed: false });
    expect(enrollments(raw)).toHaveLength(0);
  });

  it('duplicate notify → enrolled only once', async () => {
    const { env, raw } = setup();
    const { token, ref } = await orderToken(env);
    const f = mockFetch({ ...TOKEN_ROUTE, 'GET /documents/doc-11111111': () => [200, makeDoc(ref)] });
    const body = JSON.stringify({ documentId: 'doc-11111111' });
    const r1 = await notify(env, token, body);
    const r2 = await notify(env, token, body);
    expect(await r1.json()).toMatchObject({ enrollment: 'enrolled' });
    expect(await r2.json()).toMatchObject({ confirmed: true, enrollment: 'already' });
    expect(enrollments(raw)).toHaveLength(1);
    // Emails only sent for the first (new) enrollment
    expect(f.find('notify.hai.tech/send-email')).toHaveLength(2);
  });

  it('refuses to reuse a Morning document already linked to another enrollment', async () => {
    const { env, raw } = setup();
    raw.exec(`INSERT INTO users (id, email, password_hash, name) VALUES ('u2', 'other@example.com', 'x', 'אחר')`);
    raw.exec(`INSERT INTO enrollments (id, user_id, course_id, payment_id, status) VALUES ('e0', 'u2', 'python', 'morning:doc-11111111', 'active')`);
    const { token, ref } = await orderToken(env);
    mockFetch({ ...TOKEN_ROUTE, 'GET /documents/doc-11111111': () => [200, makeDoc(ref)] });
    const res = await notify(env, token, JSON.stringify({ documentId: 'doc-11111111' }));
    expect(await res.json()).toMatchObject({ enrollment: 'conflict' });
    expect(raw.prepare("SELECT COUNT(*) n FROM enrollments WHERE user_id='u1'").get()).toMatchObject({ n: 0 });
  });

  it('falls back to /documents/search when the body has no document id (form-encoded body)', async () => {
    const { env, raw } = setup();
    const { token, ref } = await orderToken(env);
    const f = mockFetch({ ...TOKEN_ROUTE, 'POST /documents/search': () => [200, { total: 1, items: [makeDoc(ref, { id: 'doc-22222222' })] }] });
    const res = await req(env, `/lms/api/payments/morning/notify?t=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'status=ok&foo=bar',
    });
    expect(await res.json()).toMatchObject({ ok: true, confirmed: true, enrollment: 'enrolled' });
    const [search] = f.find('/documents/search', 'POST');
    expect(search.url).toBe('https://api.greeninvoice.co.il/api/v1/documents/search');
    expect(search.body).toMatchObject({ description: ref, type: [320, 400, 305], page: 1, pageSize: 10 });
    expect(search.body.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.find('/documents/', 'GET')).toHaveLength(0);
    expect(enrollments(raw)[0]).toMatchObject({ payment_id: 'morning:doc-22222222' });
  });

  it('falls back to search when GET /documents/{id} fails', async () => {
    const { env, raw } = setup();
    const { token, ref } = await orderToken(env);
    mockFetch({
      ...TOKEN_ROUTE,
      'GET /documents/doc-11111111': () => [404, { errorCode: 2100 }],
      'POST /documents/search': () => [200, { items: [makeDoc(ref, { id: 'doc-33333333' })] }],
    });
    await notify(env, token, JSON.stringify({ id: 'doc-11111111' }));
    expect(enrollments(raw)[0]).toMatchObject({ payment_id: 'morning:doc-33333333' });
  });

  it('answers 2xx even when Morning is down', async () => {
    const { env, raw } = setup();
    const { token } = await orderToken(env);
    mockFetch({ 'POST /idp/v1/oauth/token': () => [500, { error: 'down' }] });
    const res = await notify(env, token, '{}');
    expect(res.status).toBe(200);
    expect(enrollments(raw)).toHaveLength(0);
  });
});

describe('GET /status/:orderId and /morning/return (morning)', () => {
  it('status runs the same verification and enrolls; return redirects to the course page', async () => {
    const { env, raw } = setup();
    let f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: MORNING_PAY_URL }] });
    const data = (await (await createPayment(env)).json()) as any;
    const ref = f.find('/payments/form')[0].body.custom;
    vi.unstubAllGlobals();

    f = mockFetch({ ...TOKEN_ROUTE, 'POST /documents/search': () => [200, { items: [makeDoc(ref)] }] });
    const st = await req(env, `/lms/api/payments/status/${data.orderId}`);
    expect(await st.json()).toMatchObject({ orderId: ref, status: 'paid', paid: true, total: '497.00' });
    expect(raw.prepare('SELECT payment_id FROM enrollments').all()).toEqual([{ payment_id: 'morning:doc-11111111' }]);

    // Return URL: already enrolled → still confirms and redirects with payment=success
    const ret = await req(env, `/lms/api/payments/morning/return?t=${encodeURIComponent(data.orderId)}`);
    expect(ret.status).toBe(302);
    expect(ret.headers.get('location')).toBe('https://hai.tech/lms/course.html?id=python&payment=success');
    expect(raw.prepare('SELECT COUNT(*) n FROM enrollments').get()).toMatchObject({ n: 1 });
  });

  it('numeric (WooCommerce) order ids are not looked up in morning mode', async () => {
    const { env } = setup();
    const f = mockFetch({});
    const st = await req(env, '/lms/api/payments/status/12345');
    expect(st.status).toBe(404);
    expect(((await st.json()) as any).paid).toBe(false);
    expect(f.calls).toHaveLength(0);
  });

  it('PAYMENTS_PROVIDER=woocommerce keeps the legacy WooCommerce status path', async () => {
    const { env } = setup({ PAYMENTS_PROVIDER: 'woocommerce', WOO_API_KEY: 'k', WOO_API_SECRET: 's' });
    const f = mockFetch({ 'GET /wp-json/wc/v3/orders/12345': () => [200, { id: 12345, status: 'pending', total: '497.00', meta_data: [] }] });
    const st = await req(env, '/lms/api/payments/status/12345');
    expect(await st.json()).toEqual({ orderId: 12345, status: 'pending', paid: false, total: '497.00' });
    expect(f.calls[0].url).toBe('https://haitechdigitalcourses.hai.tech/wp-json/wc/v3/orders/12345');
  });
});

describe('POST /create-link (morning, public marketing pages)', () => {
  it('maps a legacy Woo product id to the LMS course price and enrolls by email on payment', async () => {
    const { env, raw } = setup();
    let f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: MORNING_PAY_URL }] });
    const res = await req(env, '/lms/api/payments/create-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // Client-side price is ignored when the product maps to an LMS course
      body: JSON.stringify({ productId: '30680', courseName: 'x', price: 1, firstName: 'דני', lastName: 'כהן', email: 'KID@example.com', phone: '0501234567' }),
    });
    const data = (await res.json()) as any;
    expect(data.paymentUrl).toBe(MORNING_PAY_URL);
    const form = f.find('/payments/form')[0].body;
    expect(form.amount).toBe(497);
    expect(form.income[0].description).toBe('קורס פייתון');
    expect(form.failureUrl).toBe('https://hai.tech/lms/api/payments/morning/failed');
    const ref = form.custom;
    vi.unstubAllGlobals();

    f = mockFetch({ ...TOKEN_ROUTE, 'POST /documents/search': () => [200, { items: [makeDoc(ref)] }] });
    const exec = makeExecCtx();
    const n = await req(env, `/lms/api/payments/morning/notify?t=${encodeURIComponent(data.orderId)}`, { method: 'POST', body: '' }, exec);
    await exec.flush();
    expect(await n.json()).toMatchObject({ confirmed: true, enrollment: 'enrolled' });
    expect(raw.prepare('SELECT user_id, course_id FROM enrollments').all()).toEqual([{ user_id: 'u1', course_id: 'python' }]);
    expect(f.find('/api/payments/morning/external')[0].body).toMatchObject({ source: 'lms-public-link', ref });
  });

  it('unmapped product id without name+price → 400', async () => {
    const { env } = setup();
    mockFetch({ ...TOKEN_ROUTE });
    const res = await req(env, '/lms/api/payments/create-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: '99999', firstName: 'דני', email: 'a@b.co' }),
    });
    expect(res.status).toBe(400);
  });

  it('unmapped product uses listPrice and applies LMS coupon once', async () => {
    const { env } = setup();
    const f = mockFetch({ ...TOKEN_ROUTE, 'POST /payments/form': () => [201, { success: true, errorCode: 0, url: MORNING_PAY_URL }] });
    await req(env, '/lms/api/payments/create-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: '40070', courseName: 'קייטנת פסח', price: 398, listPrice: 497, couponCode: 'SAVE20', firstName: 'דני', email: 'a@b.co' }),
    });
    expect(f.find('/payments/form')[0].body.amount).toBe(398);
  });
});
