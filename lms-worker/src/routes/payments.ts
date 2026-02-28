/**
 * Payment Routes
 * Handles course purchases via WooCommerce + Morning (GreenInvoice)
 * 
 * Flow:
 * 1. Client calls POST /create-link or POST /create-payment/:courseId
 * 2. Worker creates WooCommerce order with course as line_item + coupon if provided
 * 3. Returns auto-login payment URL (HMAC token, 2-hour expiry)
 * 4. Customer pays via Morning payment form (credit card / Bit)
 * 5. WooCommerce fires webhook → worker enrolls user in course
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../index';
import { verifyToken } from './auth';

export const paymentRoutes = new Hono<{ Bindings: Env }>();

const WOO_SITE = 'https://haitechdigitalcourses.hai.tech';

/** Create WooCommerce Basic Auth header */
function wooAuth(key: string, secret: string): string {
  return 'Basic ' + btoa(`${key}:${secret}`);
}

/** HMAC-SHA256 using Web Crypto API (available in Cloudflare Workers) */
async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Build the auto-login payment URL */
async function buildPayUrl(orderId: number, env: Env): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const token = await hmacSha256(`${orderId}:${ts}`, env.HAITECH_PAY_SECRET);
  return `${WOO_SITE}/?haitech_pay=1&order_id=${orderId}&ts=${ts}&token=${token}`;
}

/** Create WooCommerce order with WooCommerce native coupon support */
async function createWooOrder(params: {
  env: Env;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  productId?: number;      // WooCommerce product ID (preferred)
  courseName?: string;     // Fallback: fee_lines name
  price?: number;          // Fallback: fee_lines price
  couponCode?: string;     // WooCommerce coupon code
  metaUserId?: string;     // LMS user ID (stored as meta for webhook)
  metaCourseId?: string;   // LMS course ID (stored as meta for webhook)
}): Promise<{ id: number; order_key: string; total: string }> {
  const { env, firstName, lastName, email, phone, productId, courseName, price, couponCode, metaUserId, metaCourseId } = params;

  const body: any = {
    payment_method: 'greeninvoice-creditcard',
    payment_method_title: 'כרטיס אשראי / ביט',
    status: 'pending',
    customer_id: 354, // crm-payments WP user
    billing: {
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone || '',
    },
    meta_data: [
      ...(metaUserId ? [{ key: 'lms_user_id', value: metaUserId }] : []),
      ...(metaCourseId ? [{ key: 'lms_course_id', value: metaCourseId }] : []),
    ],
  };

  if (productId) {
    body.line_items = [{ product_id: productId, quantity: 1 }];
  } else if (courseName && price) {
    body.fee_lines = [{ name: courseName, total: price.toFixed(2) }];
  } else {
    throw new Error('Must provide productId or (courseName + price)');
  }

  if (couponCode) {
    body.coupon_lines = [{ code: couponCode }];
  }

  const auth = wooAuth(env.WOO_API_KEY, env.WOO_API_SECRET);
  const response = await fetch(`${WOO_SITE}/wp-json/wc/v3/orders`, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`WooCommerce order failed: ${errText}`);
  }

  return response.json() as Promise<{ id: number; order_key: string; total: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Create payment link (no auth required — for marketing pages)
// POST /lms/api/payments/create-link
// Body: { productId, courseName, price, firstName, lastName, email, phone?, couponCode? }
// ─────────────────────────────────────────────────────────────────────────────
paymentRoutes.post('/create-link', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { productId, courseName, price, firstName, lastName, email, phone, couponCode } = body;

  if (!email || !firstName) return c.json({ error: 'שם ואימייל הם שדות חובה' }, 400);
  if (!productId && (!courseName || !price)) return c.json({ error: 'נדרש מוצר או שם + מחיר' }, 400);

  try {
    const order = await createWooOrder({
      env: c.env,
      firstName, lastName: lastName || '', email, phone,
      productId: productId ? Number(productId) : undefined,
      courseName, price: price ? Number(price) : undefined,
      couponCode: couponCode || undefined,
    });

    const payUrl = await buildPayUrl(order.id, c.env);

    return c.json({
      success: true,
      orderId: order.id,
      total: order.total,
      paymentUrl: payUrl,
    });
  } catch (err: any) {
    console.error('create-link error:', err);
    return c.json({ error: err.message || 'שגיאה ביצירת קישור תשלום' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED: Create payment for logged-in LMS user
// POST /lms/api/payments/create-payment/:courseId
// ─────────────────────────────────────────────────────────────────────────────
paymentRoutes.post('/create-payment/:courseId', async (c) => {
  // Verify auth token
  let token = getCookie(c, 'auth_token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  }
  if (!token) return c.json({ error: 'יש להתחבר כדי לרכוש קורס' }, 401);

  let userId: string;
  let userEmail: string;
  let userName: string;
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    userId = payload.userId;
    const user = await c.env.DB.prepare('SELECT email, name FROM users WHERE id = ?')
      .bind(userId).first() as { email: string; name: string } | null;
    if (!user) return c.json({ error: 'משתמש לא נמצא' }, 404);
    userEmail = user.email;
    userName = user.name;
  } catch { return c.json({ error: 'טוקן לא תקין' }, 401); }

  const courseId = c.req.param('courseId');
  let couponCode: string | null = null;
  try { const b = await c.req.json(); couponCode = b.couponCode || null; } catch {}

  // Check if already enrolled
  const existingEnrollment = await c.env.DB.prepare(
    'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = ?'
  ).bind(userId, courseId, 'active').first();
  if (existingEnrollment) return c.json({ error: 'כבר רשום לקורס זה' }, 400);

  // Get course details from LMS DB
  const course = await c.env.DB.prepare(
    'SELECT id, title, price, woo_product_id FROM courses WHERE id = ? AND is_published = 1'
  ).bind(courseId).first() as { id: string; title: string; price: number; woo_product_id?: number } | null;
  if (!course) return c.json({ error: 'קורס לא נמצא' }, 404);

  // Free course — enroll directly
  if (!course.price || course.price === 0) {
    const enrollmentId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at) VALUES (?, ?, ?, ?, unixepoch())'
    ).bind(enrollmentId, userId, courseId, 'active').run();
    return c.json({ success: true, free: true, message: 'נרשמת לקורס בהצלחה!' });
  }

  try {
    const nameParts = (userName || '').split(' ');
    const order = await createWooOrder({
      env: c.env,
      firstName: nameParts[0] || 'לקוח',
      lastName: nameParts.slice(1).join(' ') || '',
      email: userEmail,
      productId: course.woo_product_id,
      courseName: course.title,
      price: course.price,
      couponCode: couponCode || undefined,
      metaUserId: userId,
      metaCourseId: courseId,
    });

    const payUrl = await buildPayUrl(order.id, c.env);

    return c.json({ success: true, orderId: order.id, total: order.total, paymentUrl: payUrl });
  } catch (err: any) {
    console.error('Payment error:', err);
    return c.json({ error: err.message || 'שגיאה בתהליך התשלום' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Validate coupon code
// POST /lms/api/payments/validate-coupon
// ─────────────────────────────────────────────────────────────────────────────
paymentRoutes.post('/validate-coupon', async (c) => {
  const { code, productId } = await c.req.json();
  if (!code) return c.json({ valid: false, error: 'קוד קופון חסר' });

  const auth = wooAuth(c.env.WOO_API_KEY, c.env.WOO_API_SECRET);
  const res = await fetch(`${WOO_SITE}/wp-json/wc/v3/coupons?code=${encodeURIComponent(code)}`, {
    headers: { Authorization: auth },
  });

  if (!res.ok) return c.json({ valid: false, error: 'שגיאה בבדיקת קופון' });

  const coupons = await res.json() as any[];
  if (!coupons.length) return c.json({ valid: false, error: 'קוד קופון לא תקין' });

  const coupon = coupons[0];
  const now = new Date();
  if (coupon.date_expires && new Date(coupon.date_expires) < now) {
    return c.json({ valid: false, error: 'קוד הקופון פג תוקף' });
  }
  if (coupon.usage_count >= coupon.usage_limit && coupon.usage_limit > 0) {
    return c.json({ valid: false, error: 'קוד הקופון הגיע למגבלת השימוש' });
  }

  return c.json({
    valid: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discount_type,  // percent / fixed_cart
      discountValue: Number(coupon.amount),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WooCommerce Webhook — order status updated
// POST /lms/api/payments/wc-webhook  (also accessible as /lms/api/webhooks/wc-webhook)
// ─────────────────────────────────────────────────────────────────────────────
paymentRoutes.post('/wc-webhook', async (c) => {
  c.res.headers.set('x-ok', '1');

  try {
    const order = await c.req.json() as any;
    if (!order?.id) return c.json({ ok: true });

    const paid = ['processing', 'completed'].includes(order.status);
    if (!paid) return c.json({ ok: true, ignored: true });

    // Extract LMS user/course IDs from order meta
    let lmsUserId: string | null = null;
    let lmsCourseId: string | null = null;
    for (const meta of order.meta_data || []) {
      if (meta.key === 'lms_user_id') lmsUserId = meta.value;
      if (meta.key === 'lms_course_id') lmsCourseId = meta.value;
    }

    if (!lmsUserId || !lmsCourseId) {
      // Public payment (marketing page) — may not have LMS meta
      // Try to enroll by email if user exists
      const email = order.billing?.email;
      if (email) {
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
          .bind(email).first() as { id: string } | null;
        if (user) lmsUserId = user.id;
      }
    }

    if (!lmsUserId || !lmsCourseId) {
      console.log(`[WC Webhook] Order ${order.id} paid but no LMS meta — skipping enrollment`);
      return c.json({ ok: true });
    }

    // Check if already enrolled
    const existing = await c.env.DB.prepare(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?'
    ).bind(lmsUserId, lmsCourseId).first();
    if (existing) return c.json({ ok: true, alreadyEnrolled: true });

    // Enroll user
    const enrollmentId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO enrollments (id, user_id, course_id, payment_id, status, enrolled_at) VALUES (?, ?, ?, ?, ?, unixepoch())'
    ).bind(enrollmentId, lmsUserId, lmsCourseId, String(order.id), 'active').run();

    console.log(`[WC Webhook] Enrolled user ${lmsUserId} in course ${lmsCourseId} (order ${order.id})`);
    return c.json({ ok: true, enrolled: true });
  } catch (err) {
    console.error('[WC Webhook] Error:', err);
    return c.json({ ok: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Payment status check
// GET /lms/api/payments/status/:orderId
// ─────────────────────────────────────────────────────────────────────────────
paymentRoutes.get('/status/:orderId', async (c) => {
  const orderId = c.req.param('orderId');
  const auth = wooAuth(c.env.WOO_API_KEY, c.env.WOO_API_SECRET);

  const res = await fetch(`${WOO_SITE}/wp-json/wc/v3/orders/${orderId}`, {
    headers: { Authorization: auth },
  });

  if (!res.ok) return c.json({ error: 'הזמנה לא נמצאה' }, 404);

  const order = await res.json() as any;
  return c.json({
    orderId: order.id,
    status: order.status,
    paid: ['processing', 'completed'].includes(order.status),
    total: order.total,
  });
});
