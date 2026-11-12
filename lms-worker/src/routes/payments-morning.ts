/**
 * Morning (GreenInvoice) direct payment handlers — PAYMENTS_PROVIDER=morning (default).
 *
 * Flow:
 *  1. POST /create-payment/:courseId (logged-in LMS user) or POST /create-link (public
 *     marketing pages via /payment-button.js) → creates a Morning hosted payment form
 *     (POST /payments/form) and returns { paymentUrl, orderId }.
 *     `orderId` is a signed purchase token (see utils/morning.ts) — no DB state needed.
 *  2. Customer pays on Morning. Morning redirects to successUrl (/morning/return) and
 *     POSTs notifyUrl (/morning/notify). The course page also polls /status/:orderId.
 *  3. All three run the SAME verification: valid token signature + a matching Morning
 *     document (by id from the notify body if present, else by searching the ref).
 *     Only then the user is enrolled (idempotent, payment_id = 'morning:<docId>') and
 *     the payment is forwarded to the CRM (/api/payments/morning/external).
 *
 * WooCommerce coupon fallback is intentionally dropped: only LMS-DB coupons are valid.
 */

import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env } from '../index';
import { verifyToken } from './auth';
import { sendWelcomeEmail, sendPaymentLeadToCRM, sendPurchaseNotification } from '../utils/payment-notify';
import {
  createMorningPaymentForm,
  extractCandidateDocumentId,
  findPaidMorningDocument,
  forwardPaymentToCrm,
  generateRef,
  looksLikePurchaseToken,
  signPurchaseToken,
  verifyMorningWebhookSignature,
  verifyPurchaseToken,
  type MorningDocument,
  type PurchaseContext,
} from '../utils/morning';

type Ctx = Context<{ Bindings: Env }>;

const INVALID_COUPON = 'קוד קופון לא תקין';

export function isMorningProvider(env: Env): boolean {
  const p = (env.PAYMENTS_PROVIDER || '').trim().toLowerCase();
  return p !== 'woocommerce';
}

function siteUrl(env: Env): string {
  return (env.PUBLIC_SITE_URL?.trim() || 'https://hai.tech').replace(/\/+$/, '');
}

function apiBase(env: Env): string {
  return `${siteUrl(env)}/lms/api/payments`;
}

/** Run a promise in the background (waitUntil when available). */
function background(c: Ctx, p: Promise<unknown>): void {
  const safe = p.catch((err) => console.error('[MORNING] background task failed:', err));
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    /* no execution context (tests / local) — let it float */
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

// ─────────────────────────────────────────────────────────────────────────────
// Coupons (LMS DB only)
// ─────────────────────────────────────────────────────────────────────────────
interface LmsCoupon {
  id: string; code: string; discount_type: string; discount_value: number;
  max_uses: number | null; current_uses: number;
  valid_from: number | null; valid_until: number | null;
  course_id: string | null;
}

type CouponResult = { ok: true; coupon: LmsCoupon } | { ok: false; error: string };

async function resolveLmsCoupon(env: Env, code: string, courseId?: string | null): Promise<CouponResult> {
  const upper = String(code).toUpperCase().trim();
  const coupon = (await env.DB.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1')
    .bind(upper).first()) as LmsCoupon | null;
  if (!coupon) return { ok: false, error: INVALID_COUPON };
  const now = Math.floor(Date.now() / 1000);
  if (coupon.valid_from && now < coupon.valid_from) return { ok: false, error: 'קוד הקופון עדיין לא בתוקף' };
  if (coupon.valid_until && now > coupon.valid_until) return { ok: false, error: 'קוד הקופון פג תוקף' };
  if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) return { ok: false, error: 'קוד הקופון הגיע למגבלת השימוש' };
  if (coupon.course_id && courseId && coupon.course_id !== courseId) return { ok: false, error: 'קוד הקופון לא תקף לקורס זה' };
  return { ok: true, coupon };
}

function applyDiscount(price: number, coupon: LmsCoupon): number {
  if (coupon.discount_type === 'percent') return Math.round(price * (1 - coupon.discount_value / 100));
  return Math.max(0, price - coupon.discount_value);
}

async function incrementCouponUse(env: Env, couponId: string): Promise<void> {
  await env.DB.prepare('UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?').bind(couponId).run();
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrollment (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
type EnrollOutcome = 'enrolled' | 'already' | 'conflict' | 'skipped';

async function enrollFromMorningPayment(
  c: Ctx,
  p: { userId: string; courseId: string; doc: MorningDocument; amount: number; ref: string },
): Promise<EnrollOutcome> {
  const db = c.env.DB;
  const paymentId = `morning:${p.doc.id}`;

  // A Morning document may only ever unlock one enrollment.
  const byPayment = (await db.prepare('SELECT id, user_id, course_id FROM enrollments WHERE payment_id = ?')
    .bind(paymentId).first()) as { id: string; user_id: string; course_id: string } | null;
  if (byPayment) {
    if (byPayment.user_id === p.userId && byPayment.course_id === p.courseId) return 'already';
    console.error(`[MORNING] ${paymentId} already used by another enrollment (${byPayment.id}) — refusing ${p.userId}/${p.courseId}`);
    return 'conflict';
  }

  const user = (await db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?')
    .bind(p.userId).first()) as { id: string; name: string; email: string; phone?: string | null } | null;
  const course = (await db.prepare('SELECT id, title FROM courses WHERE id = ?')
    .bind(p.courseId).first()) as { id: string; title: string } | null;
  if (!user || !course) {
    console.error(`[MORNING] Paid ${p.ref} but user/course missing (${p.userId}/${p.courseId})`);
    return 'skipped';
  }

  const existing = (await db.prepare('SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ?')
    .bind(p.userId, p.courseId).first()) as { id: string; status: string } | null;
  if (existing) {
    if (existing.status === 'active') return 'already';
    // Re-activate a previously inactive enrollment (UNIQUE(user_id, course_id) prevents a 2nd row).
    await db.prepare('UPDATE enrollments SET status = ?, payment_id = ? WHERE id = ?')
      .bind('active', paymentId, existing.id).run();
  } else {
    try {
      await db.prepare(
        'INSERT INTO enrollments (id, user_id, course_id, payment_id, status, enrolled_at) VALUES (?, ?, ?, ?, ?, unixepoch())'
      ).bind(crypto.randomUUID(), p.userId, p.courseId, paymentId, 'active').run();
    } catch (err) {
      // Concurrent notify/return/status — UNIQUE(user_id, course_id) won the race.
      console.warn(`[MORNING] Enrollment insert raced for ${p.ref}:`, (err as Error).message);
      return 'already';
    }
  }

  console.log(`[MORNING] Enrolled ${p.userId} in ${p.courseId} (${paymentId}, ${p.ref})`);
  background(c, sendWelcomeEmail(user.name || 'תלמיד/ה', user.email, course.title, p.courseId));
  background(c, sendPurchaseNotification({
    name: user.name, email: user.email, phone: user.phone, courseTitle: course.title,
    amount: p.doc.amount ?? p.amount, orderRef: `${p.ref} (מסמך ${p.doc.number ?? p.doc.id})`,
  }));
  return 'enrolled';
}

/**
 * Shared verification used by notify, return and status.
 * Returns the confirmed Morning document (or null) and the enrollment outcome.
 */
async function confirmPurchase(
  c: Ctx,
  ctx: PurchaseContext,
  opts: { candidateDocId?: string | null; forwardAlways: boolean },
): Promise<{ doc: MorningDocument | null; outcome: EnrollOutcome | null }> {
  const doc = await findPaidMorningDocument(c.env, ctx, opts.candidateDocId);
  if (!doc) return { doc: null, outcome: null };

  let outcome: EnrollOutcome | null = null;
  let userId = ctx.u;
  if (!userId && ctx.em && ctx.c) {
    const u = (await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(ctx.em.toLowerCase().trim()).first()) as { id: string } | null;
    userId = u?.id;
  }
  if (userId && ctx.c) {
    outcome = await enrollFromMorningPayment(c, { userId, courseId: ctx.c, doc, amount: ctx.a, ref: ctx.ref });
  }

  if (opts.forwardAlways || outcome === 'enrolled') {
    const email = doc.client?.emails?.[0] || ctx.em;
    background(c, forwardPaymentToCrm(c.env, {
      documentId: doc.id,
      ref: ctx.ref,
      expectedAmount: ctx.a,
      source: ctx.k === 'course' ? 'lms-course' : 'lms-public-link',
      description: doc.description,
      customer: {
        name: doc.client?.name,
        email: email || undefined,
        phone: doc.client?.mobile || doc.client?.phone || undefined,
      },
    }));
  }
  return { doc, outcome };
}

async function buildUrls(env: Env, ctx: PurchaseContext) {
  const token = await signPurchaseToken(env, ctx);
  const t = encodeURIComponent(token);
  const base = apiBase(env);
  return {
    token,
    successUrl: `${base}/morning/return?t=${t}`,
    notifyUrl: `${base}/morning/notify?t=${t}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /create-payment/:courseId  (logged-in LMS user)
// ─────────────────────────────────────────────────────────────────────────────
export async function morningCreatePayment(c: Ctx) {
  let token = getCookie(c, 'auth_token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  }
  if (!token) return c.json({ error: 'יש להתחבר כדי לרכוש קורס' }, 401);

  let userId: string;
  let user: { email: string; name: string; phone: string | null };
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    userId = payload.userId;
    const row = (await c.env.DB.prepare('SELECT email, name, phone FROM users WHERE id = ?')
      .bind(userId).first()) as typeof user | null;
    if (!row) return c.json({ error: 'משתמש לא נמצא' }, 404);
    user = row;
  } catch {
    return c.json({ error: 'טוקן לא תקין' }, 401);
  }

  const courseId = c.req.param('courseId') as string;
  let couponCode: string | null = null;
  try { const b = (await c.req.json()) as any; couponCode = b?.couponCode || null; } catch { /* no body */ }

  const existingEnrollment = await c.env.DB.prepare(
    'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = ?'
  ).bind(userId, courseId, 'active').first();
  if (existingEnrollment) return c.json({ error: 'כבר רשום לקורס זה' }, 400);

  const course = (await c.env.DB.prepare('SELECT id, title, price FROM courses WHERE id = ? AND is_published = 1')
    .bind(courseId).first()) as { id: string; title: string; price: number } | null;
  if (!course) return c.json({ error: 'קורס לא נמצא' }, 404);

  const enrollFree = async (message: string) => {
    await c.env.DB.prepare(
      'INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at) VALUES (?, ?, ?, ?, unixepoch())'
    ).bind(crypto.randomUUID(), userId, courseId, 'active').run();
    background(c, sendWelcomeEmail(user.name || 'תלמיד/ה', user.email, course.title, courseId));
    return c.json({ success: true, free: true, message });
  };

  if (!course.price || course.price === 0) return enrollFree('נרשמת לקורס בהצלחה!');

  let finalPrice = course.price;
  if (couponCode) {
    const res = await resolveLmsCoupon(c.env, couponCode, courseId);
    if (!res.ok) return c.json({ error: res.error }, 400);
    finalPrice = applyDiscount(course.price, res.coupon);
    await incrementCouponUse(c.env, res.coupon.id);
    if (finalPrice <= 0) return enrollFree('הקופון הוחל — נרשמת לקורס בהצלחה!');
  }

  try {
    sendPaymentLeadToCRM(c.env, {
      name: user.name || 'לקוח',
      email: user.email,
      phone: user.phone || undefined,
      interest: course.title,
      source: 'purchase-form',
      message: `רכישת קורס: ${course.title}` + (couponCode ? ` (קופון: ${couponCode})` : ''),
    }, `[PAYMENT-LEAD] Sent to CRM: ${user.name} (${user.email}) — ${course.title}`);
  } catch { /* ignore */ }

  try {
    const ctx: PurchaseContext = {
      ref: generateRef(), k: 'course', a: finalPrice, ts: Math.floor(Date.now() / 1000), u: userId, c: courseId,
    };
    const { token: orderToken, successUrl, notifyUrl } = await buildUrls(c.env, ctx);
    const coursePage = `${siteUrl(c.env)}/lms/course.html?id=${encodeURIComponent(courseId)}`;
    const paymentUrl = await createMorningPaymentForm(c.env, {
      ref: ctx.ref,
      title: course.title,
      amount: finalPrice,
      client: { name: user.name || user.email, email: user.email, phone: user.phone || undefined },
      successUrl,
      failureUrl: `${coursePage}&payment=failed`,
      notifyUrl,
      maxPayments: 1,
    });
    return c.json({
      success: true,
      orderId: orderToken,
      ref: ctx.ref,
      total: finalPrice.toFixed(2),
      paymentUrl,
      returnUrl: `${coursePage}&payment=success`,
    });
  } catch (err: any) {
    console.error('[MORNING] create-payment error:', err);
    return c.json({ error: 'שגיאה בתהליך התשלום' }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /create-link  (public marketing pages — /payment-button.js)
// Body: { productId?, courseName?, price?, listPrice?, firstName, lastName?, email, phone?, couponCode? }
// ─────────────────────────────────────────────────────────────────────────────
export async function morningCreateLink(c: Ctx) {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { productId, courseName, firstName, lastName, email, phone, couponCode } = body || {};
  if (!email || !firstName || !String(email).includes('@')) return c.json({ error: 'שם ואימייל הם שדות חובה' }, 400);

  // Map the legacy WooCommerce product id to an LMS course (authoritative price/title).
  type CourseRow = { id: string; title: string; price: number };
  let course: CourseRow | null = null;
  if (productId) {
    try {
      course = (await c.env.DB.prepare('SELECT id, title, price FROM courses WHERE woo_product_id = ?')
        .bind(Number(productId)).first()) as CourseRow | null;
    } catch (err) {
      console.warn('[MORNING] woo_product_id lookup failed:', (err as Error).message);
    }
  }

  // Base (pre-coupon) price: LMS course price if mapped, else the page's list price.
  const clientBase = Number(body?.listPrice ?? body?.price);
  const basePrice = course && course.price > 0 ? Number(course.price) : clientBase;
  const title = String(course?.title || courseName || '').trim();
  if (!title || !(basePrice > 0)) {
    return c.json({ error: productId ? 'מוצר לא מוכר — חסר שם קורס ומחיר' : 'נדרש מוצר או שם + מחיר' }, 400);
  }

  let finalPrice = basePrice;
  if (couponCode) {
    const res = await resolveLmsCoupon(c.env, couponCode, course?.id);
    if (!res.ok) return c.json({ error: res.error }, 400);
    finalPrice = applyDiscount(basePrice, res.coupon);
    if (finalPrice <= 0) return c.json({ error: 'לא ניתן לבצע תשלום על סכום 0 — צרו איתנו קשר' }, 400);
    await incrementCouponUse(c.env, res.coupon.id);
  }

  const fullName = `${firstName} ${lastName || ''}`.trim();
  try {
    sendPaymentLeadToCRM(c.env, {
      name: fullName, email, phone: phone || undefined, interest: title, source: 'purchase-form',
      message: `רכישה: ${title}` + (couponCode ? ` (קופון: ${couponCode})` : ''),
    }, `[PAYMENT-LEAD] Sent to CRM: ${firstName} (${email})`);
  } catch { /* ignore */ }

  try {
    const ctx: PurchaseContext = {
      ref: generateRef(), k: 'link', a: finalPrice, ts: Math.floor(Date.now() / 1000),
      em: String(email).toLowerCase().trim(),
      ...(course ? { c: course.id } : {}),
    };
    const { token: orderToken, successUrl, notifyUrl } = await buildUrls(c.env, ctx);
    const paymentUrl = await createMorningPaymentForm(c.env, {
      ref: ctx.ref,
      title,
      amount: finalPrice,
      client: { name: fullName, email: String(email).trim(), phone: phone || undefined },
      successUrl,
      failureUrl: `${apiBase(c.env)}/morning/failed`,
      notifyUrl,
      maxPayments: 1,
    });
    return c.json({ success: true, orderId: orderToken, ref: ctx.ref, total: finalPrice.toFixed(2), paymentUrl });
  } catch (err: any) {
    console.error('[MORNING] create-link error:', err);
    return c.json({ error: 'שגיאה ביצירת קישור תשלום' }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /validate-coupon  (LMS DB only — no WooCommerce fallback)
// ─────────────────────────────────────────────────────────────────────────────
export async function morningValidateCoupon(c: Ctx) {
  let body: any = {};
  try { body = await c.req.json(); } catch { /* empty */ }
  const { code, courseId } = body || {};
  if (!code) return c.json({ valid: false, error: 'קוד קופון חסר' });
  const res = await resolveLmsCoupon(c.env, code, courseId);
  if (!res.ok) return c.json({ valid: false, error: res.error });
  return c.json({
    valid: true,
    source: 'lms',
    coupon: {
      code: res.coupon.code,
      discountType: res.coupon.discount_type === 'percent' ? 'percent' : 'fixed_cart',
      discountValue: res.coupon.discount_value,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /status/:orderId  (polled by lms/course.html; orderId = signed token)
// ─────────────────────────────────────────────────────────────────────────────
const lastStatusCheck = new Map<string, number>();
const STATUS_MIN_INTERVAL_MS = 10_000;

export async function morningStatus(c: Ctx) {
  const orderId = c.req.param('orderId') || '';
  if (!looksLikePurchaseToken(orderId)) {
    // Legacy numeric WooCommerce ids are only served when PAYMENTS_PROVIDER=woocommerce.
    return c.json({ error: 'הזמנה לא נמצאה', paid: false }, 404);
  }
  const ctx = await verifyPurchaseToken(c.env, orderId);
  if (!ctx) return c.json({ error: 'הזמנה לא נמצאה', paid: false }, 404);

  const pending = { orderId: ctx.ref, status: 'pending', paid: false, total: ctx.a.toFixed(2) };
  const paidRes = { orderId: ctx.ref, status: 'paid', paid: true, total: ctx.a.toFixed(2) };

  // Fast path: already enrolled (by notify/return) → no Morning call.
  if (ctx.u && ctx.c) {
    const enrolled = await c.env.DB.prepare(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = ?'
    ).bind(ctx.u, ctx.c, 'active').first();
    if (enrolled) return c.json(paidRes);
  }

  // Throttle Morning lookups per purchase (the page polls every 5s).
  const now = Date.now();
  const last = lastStatusCheck.get(ctx.ref) || 0;
  if (now - last < STATUS_MIN_INTERVAL_MS) return c.json(pending);
  lastStatusCheck.set(ctx.ref, now);
  if (lastStatusCheck.size > 5000) lastStatusCheck.clear();

  try {
    const { doc, outcome } = await confirmPurchase(c, ctx, { forwardAlways: false });
    if (!doc) return c.json(pending);
    if (outcome === 'conflict') return c.json(pending);
    return c.json(paidRes);
  } catch (err) {
    console.error('[MORNING] status check failed:', err);
    return c.json(pending);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /morning/notify?t=<token>   (Morning notifyUrl — body is NOT trusted)
// Always answers 2xx: Morning disables webhooks after repeated failures.
// ─────────────────────────────────────────────────────────────────────────────
export async function morningNotify(c: Ctx) {
  let raw = '';
  try { raw = await c.req.text(); } catch { /* ignore */ }

  const secret = c.env.MORNING_WEBHOOK_SECRET?.trim();
  const sigHeader = c.req.header('x-webhook-signature');
  if (secret && sigHeader) {
    const okSig = await verifyMorningWebhookSignature(raw, sigHeader, secret).catch(() => false);
    if (!okSig) console.warn('[MORNING notify] x-webhook-signature mismatch (ignored — doc lookup is authoritative)');
  }

  const ctx = await verifyPurchaseToken(c.env, c.req.query('t'));
  if (!ctx) {
    console.warn('[MORNING notify] invalid or missing token');
    return c.json({ ok: false, error: 'invalid token' }, 200);
  }

  try {
    const candidate = extractCandidateDocumentId(raw);
    const { doc, outcome } = await confirmPurchase(c, ctx, { candidateDocId: candidate, forwardAlways: true });
    if (!doc) {
      console.warn(`[MORNING notify] ${ctx.ref}: no matching paid document yet`);
      return c.json({ ok: true, confirmed: false });
    }
    return c.json({ ok: true, confirmed: true, enrollment: outcome });
  } catch (err) {
    console.error(`[MORNING notify] ${ctx.ref} error:`, err);
    return c.json({ ok: true, confirmed: false });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /morning/return?t=<token>   (Morning successUrl)
// ─────────────────────────────────────────────────────────────────────────────
function htmlPage(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(title)} | דרך ההייטק</title>
<style>body{font-family:Arial,Helvetica,sans-serif;background:#f5f3ff;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;border-radius:20px;padding:36px 28px;max-width:440px;width:92%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.12)}
h1{color:#1e1b4b;font-size:1.5rem;margin:0 0 12px}p{color:#475569;line-height:1.7}
a.btn{display:inline-block;margin-top:16px;background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700}</style>
</head><body><div class="card">${bodyHtml}</div></body></html>`;
}

export async function morningReturn(c: Ctx) {
  const ctx = await verifyPurchaseToken(c.env, c.req.query('t'));
  if (!ctx) {
    return c.html(htmlPage('קישור לא תקין', '<h1>הקישור אינו תקין</h1><p>אם ביצעתם תשלום, אישור יישלח אליכם במייל. לשאלות: info@hai.tech</p><a class="btn" href="https://hai.tech/">לאתר</a>'), 400);
  }

  let confirmed = false;
  try {
    const { doc, outcome } = await confirmPurchase(c, ctx, { forwardAlways: true });
    confirmed = !!doc && outcome !== 'conflict';
  } catch (err) {
    console.error(`[MORNING return] ${ctx.ref} error:`, err);
  }

  if (ctx.k === 'course' && ctx.c) {
    const page = `${siteUrl(c.env)}/lms/course.html?id=${encodeURIComponent(ctx.c)}`;
    if (confirmed) return c.redirect(`${page}&payment=success`, 302);
    return c.redirect(`${page}&payment=processing&order=${encodeURIComponent(c.req.query('t') || '')}`, 302);
  }

  const courseLink = ctx.c ? `<a class="btn" href="${siteUrl(c.env)}/lms/course.html?id=${encodeURIComponent(ctx.c)}">כניסה לקורס</a>` : `<a class="btn" href="${siteUrl(c.env)}/">חזרה לאתר</a>`;
  const body = confirmed
    ? `<h1>🎉 תודה! התשלום התקבל</h1><p>מספר הזמנה: <b dir="ltr">${escapeHtml(ctx.ref)}</b><br>קבלה נשלחה לכתובת המייל שהזנתם. ניצור איתכם קשר בהקדם.</p>${courseLink}`
    : `<h1>תודה! התשלום בעיבוד</h1><p>מספר הזמנה: <b dir="ltr">${escapeHtml(ctx.ref)}</b><br>אישור וקבלה יישלחו למייל בדקות הקרובות. לשאלות: info@hai.tech</p>${courseLink}`;
  return c.html(htmlPage('תודה על הרכישה', body));
}

// GET /morning/failed  (Morning failureUrl for public links)
export async function morningFailed(c: Ctx) {
  return c.html(htmlPage('התשלום לא הושלם', '<h1>התשלום לא הושלם</h1><p>לא בוצע חיוב. אפשר לחזור לעמוד ולנסות שוב, או לפנות אלינו ב-WhatsApp 053-300-9742.</p><a class="btn" href="javascript:history.go(-2)">חזרה</a>'));
}
