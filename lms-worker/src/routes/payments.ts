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

// ─────────────────────────────────────────────────────────────────────────────
// Welcome email helper
// ─────────────────────────────────────────────────────────────────────────────
async function sendWelcomeEmail(userName: string, userEmail: string, courseTitle: string, courseId: string) {
  try {
    const firstName = userName.split(' ')[0] || userName;
    const courseUrl = `https://hai.tech/lms/course.html?id=${courseId}`;
    const html = `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
        <img src="https://hai.tech/images/brand/logo-haitech-transparent.webp" alt="דרך ההייטק" style="height: 50px; margin-bottom: 16px; filter: brightness(0) invert(1);">
        <h1 style="color: white; margin: 0; font-size: 24px;">ברוכים הבאים! 🎉</h1>
      </div>
      <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
        <p style="font-size: 18px; color: #1e293b; margin: 0 0 8px;">היי <strong>${firstName}</strong>,</p>
        <p style="font-size: 16px; color: #475569; line-height: 1.7; margin: 0 0 24px;">
          נרשמת בהצלחה לקורס <strong>${courseTitle}</strong>! 🎓<br>
          אנחנו שמחים שבחרת ללמוד איתנו.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="color: #166534; margin: 0 0 12px;">📋 פרטי הקורס</h3>
          <p style="font-size: 14px; color: #334155; margin: 0;"><strong>קורס:</strong> ${courseTitle}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${courseUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 14px 40px; border-radius: 30px; text-decoration: none; font-size: 16px; font-weight: 700;">🚀 התחילו ללמוד</a>
        </div>
        <div style="background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
          <h4 style="color: #334155; margin: 0 0 8px;">💡 איך מתחילים?</h4>
          <ol style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-right: 20px;">
            <li>לחצו על הכפתור למעלה</li>
            <li>התחברו עם המייל שנרשמתם איתו</li>
            <li>התחילו מהשיעור הראשון — צפו בסרטון</li>
            <li>בצעו את המשימה ועברו לשיעור הבא</li>
          </ol>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
          <p style="color: #92400e; font-size: 14px; margin: 0;">💚 <strong>טיפ:</strong> אפשר לחזור לכל שיעור כמה פעמים שרוצים — הגישה לקורס היא לנצח!</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <div style="text-align: center;">
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">שאלות? אנחנו כאן בשבילכם 💚</p>
          <p style="margin: 8px 0 0;">
            <a href="https://wa.me/972533009742" style="color: #22c55e; text-decoration: none; font-size: 13px;">📱 WhatsApp: 053-300-9742</a>
            &nbsp;|&nbsp;
            <a href="mailto:info@hai.tech" style="color: #22c55e; text-decoration: none; font-size: 13px;">📧 info@hai.tech</a>
          </p>
        </div>
      </div>
    </div>`;

    await fetch('https://notify.hai.tech/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: userEmail,
        subject: `🎓 ברוכים הבאים לקורס ${courseTitle} — דרך ההייטק`,
        html,
      }),
    });
    console.log(`[WELCOME-EMAIL] Sent to ${userEmail} for course ${courseTitle}`);
  } catch (err) {
    console.error('[WELCOME-EMAIL] Failed:', err);
  }
}
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
    let finalPrice = price ? Number(price) : undefined;
    let wooCouponCode: string | undefined = couponCode || undefined;

    // Check if coupon is an LMS coupon (apply discount locally, don't pass to WooCommerce)
    if (couponCode) {
      const upperCode = couponCode.toUpperCase().trim();
      const lmsCoupon = await c.env.DB.prepare(
        'SELECT * FROM coupons WHERE code = ? AND is_active = 1'
      ).bind(upperCode).first() as {
        id: string; discount_type: string; discount_value: number;
        max_uses: number | null; current_uses: number;
      } | null;

      if (lmsCoupon) {
        // Apply LMS discount
        if (finalPrice) {
          if (lmsCoupon.discount_type === 'percent') {
            finalPrice = Math.round(finalPrice * (1 - lmsCoupon.discount_value / 100));
          } else {
            finalPrice = Math.max(0, finalPrice - lmsCoupon.discount_value);
          }
        }
        // Don't pass LMS coupon to WooCommerce
        wooCouponCode = undefined;
        // Increment usage
        await c.env.DB.prepare('UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?')
          .bind(lmsCoupon.id).run();
      }
    }

    const order = await createWooOrder({
      env: c.env,
      firstName, lastName: lastName || '', email, phone,
      productId: productId ? Number(productId) : undefined,
      courseName, price: finalPrice,
      couponCode: wooCouponCode,
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
    // Send welcome email
    sendWelcomeEmail(userName || 'תלמיד/ה', userEmail, course.title, courseId);
    return c.json({ success: true, free: true, message: 'נרשמת לקורס בהצלחה!' });
  }

  try {
    let finalPrice = course.price;
    let wooCouponCode: string | undefined = undefined;

    // Handle LMS coupon
    if (couponCode) {
      const upperCode = couponCode.toUpperCase().trim();
      const lmsCoupon = await c.env.DB.prepare(
        'SELECT * FROM coupons WHERE code = ? AND is_active = 1'
      ).bind(upperCode).first() as {
        id: string; discount_type: string; discount_value: number;
        max_uses: number | null; current_uses: number;
        course_id: string | null;
      } | null;

      if (lmsCoupon) {
        // Validate
        if (lmsCoupon.max_uses && lmsCoupon.current_uses >= lmsCoupon.max_uses) {
          return c.json({ error: 'קוד הקופון הגיע למגבלת השימוש' }, 400);
        }
        if (lmsCoupon.course_id && lmsCoupon.course_id !== courseId) {
          return c.json({ error: 'קוד הקופון לא תקף לקורס זה' }, 400);
        }
        // Apply discount
        if (lmsCoupon.discount_type === 'percent') {
          finalPrice = Math.round(course.price * (1 - lmsCoupon.discount_value / 100));
        } else {
          finalPrice = Math.max(0, course.price - lmsCoupon.discount_value);
        }
        // Increment usage
        await c.env.DB.prepare('UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?')
          .bind(lmsCoupon.id).run();

        // Free after coupon — enroll directly
        if (finalPrice <= 0) {
          const enrollmentId = crypto.randomUUID();
          await c.env.DB.prepare(
            'INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at) VALUES (?, ?, ?, ?, unixepoch())'
          ).bind(enrollmentId, userId, courseId, 'active').run();
          // Send welcome email
          sendWelcomeEmail(userName || 'תלמיד/ה', userEmail, course.title, courseId);
          return c.json({ success: true, free: true, message: 'הקופון הוחל — נרשמת לקורס בהצלחה!' });
        }
      } else {
        // Not an LMS coupon — pass to WooCommerce
        wooCouponCode = couponCode;
      }
    }

    const nameParts = (userName || '').split(' ');
    const order = await createWooOrder({
      env: c.env,
      firstName: nameParts[0] || 'לקוח',
      lastName: nameParts.slice(1).join(' ') || '',
      email: userEmail,
      productId: course.woo_product_id,
      courseName: course.title,
      price: finalPrice,
      couponCode: wooCouponCode,
      metaUserId: userId,
      metaCourseId: courseId,
    });

    const payUrl = await buildPayUrl(order.id, c.env);

    return c.json({
      success: true,
      orderId: order.id,
      total: order.total,
      paymentUrl: payUrl,
      returnUrl: `https://hai.tech/lms/course.html?id=${courseId}&payment=success`,
    });
  } catch (err: any) {
    console.error('Payment error:', err);
    return c.json({ error: err.message || 'שגיאה בתהליך התשלום' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Validate coupon code (checks LMS DB first, then WooCommerce)
// POST /lms/api/payments/validate-coupon
// ─────────────────────────────────────────────────────────────────────────────
paymentRoutes.post('/validate-coupon', async (c) => {
  const { code, productId, courseId } = await c.req.json();
  if (!code) return c.json({ valid: false, error: 'קוד קופון חסר' });

  const upperCode = code.toUpperCase().trim();

  // 1. Check LMS DB first
  const lmsCoupon = await c.env.DB.prepare(
    'SELECT * FROM coupons WHERE code = ? AND is_active = 1'
  ).bind(upperCode).first() as {
    id: string; code: string; discount_type: string; discount_value: number;
    max_uses: number | null; current_uses: number;
    valid_from: number | null; valid_until: number | null;
    course_id: string | null;
  } | null;

  if (lmsCoupon) {
    const now = Math.floor(Date.now() / 1000);
    if (lmsCoupon.valid_from && now < lmsCoupon.valid_from) {
      return c.json({ valid: false, error: 'קוד הקופון עדיין לא בתוקף' });
    }
    if (lmsCoupon.valid_until && now > lmsCoupon.valid_until) {
      return c.json({ valid: false, error: 'קוד הקופון פג תוקף' });
    }
    if (lmsCoupon.max_uses && lmsCoupon.current_uses >= lmsCoupon.max_uses) {
      return c.json({ valid: false, error: 'קוד הקופון הגיע למגבלת השימוש' });
    }
    if (lmsCoupon.course_id && courseId && lmsCoupon.course_id !== courseId) {
      return c.json({ valid: false, error: 'קוד הקופון לא תקף לקורס זה' });
    }

    return c.json({
      valid: true,
      source: 'lms',
      coupon: {
        code: lmsCoupon.code,
        discountType: lmsCoupon.discount_type === 'percent' ? 'percent' : 'fixed_cart',
        discountValue: lmsCoupon.discount_value,
      },
    });
  }

  // 2. Fallback to WooCommerce
  try {
    const auth = wooAuth(c.env.WOO_API_KEY, c.env.WOO_API_SECRET);
    const res = await fetch(`${WOO_SITE}/wp-json/wc/v3/coupons?code=${encodeURIComponent(upperCode)}`, {
      headers: { Authorization: auth },
    });

    if (!res.ok) return c.json({ valid: false, error: 'קוד קופון לא תקין' });

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
      source: 'woo',
      coupon: {
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: Number(coupon.amount),
      },
    });
  } catch {
    return c.json({ valid: false, error: 'קוד קופון לא תקין' });
  }
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

    const paid = ['processing', 'completed', 'on-hold'].includes(order.status);
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

    // Send welcome email
    const enrolledUser = await c.env.DB.prepare('SELECT name, email FROM users WHERE id = ?')
      .bind(lmsUserId).first() as { name: string; email: string } | null;
    const enrolledCourse = await c.env.DB.prepare('SELECT title FROM courses WHERE id = ?')
      .bind(lmsCourseId).first() as { title: string } | null;
    if (enrolledUser && enrolledCourse) {
      sendWelcomeEmail(enrolledUser.name, enrolledUser.email, enrolledCourse.title, lmsCourseId);
    }

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
  const paid = ['processing', 'completed', 'on-hold'].includes(order.status);

  // Auto-enroll if paid (fallback in case webhook didn't fire)
  if (paid) {
    let lmsUserId: string | null = null;
    let lmsCourseId: string | null = null;
    for (const meta of order.meta_data || []) {
      if (meta.key === 'lms_user_id') lmsUserId = meta.value;
      if (meta.key === 'lms_course_id') lmsCourseId = meta.value;
    }
    if (lmsUserId && lmsCourseId) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?'
      ).bind(lmsUserId, lmsCourseId).first();
      if (!existing) {
        const enrollmentId = crypto.randomUUID();
        await c.env.DB.prepare(
          'INSERT INTO enrollments (id, user_id, course_id, payment_id, status, enrolled_at) VALUES (?, ?, ?, ?, ?, unixepoch())'
        ).bind(enrollmentId, lmsUserId, lmsCourseId, String(order.id), 'active').run();
        console.log(`[Status Check] Auto-enrolled user ${lmsUserId} in course ${lmsCourseId} (order ${order.id})`);
      }
    }
  }

  return c.json({
    orderId: order.id,
    status: order.status,
    paid,
    total: order.total,
  });
});
