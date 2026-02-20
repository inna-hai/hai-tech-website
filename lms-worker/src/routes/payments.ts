/**
 * Payment Routes
 * Handles course purchases via Green Invoice
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../index';
import { verifyToken } from './auth';

export const paymentRoutes = new Hono<{ Bindings: Env }>();

// Green Invoice API base URL
const GREEN_INVOICE_API = 'https://api.greeninvoice.co.il/api/v1';

// Get JWT token for Green Invoice API
async function getGreenInvoiceToken(apiKey: string, apiSecret: string): Promise<string> {
  const response = await fetch(`${GREEN_INVOICE_API}/account/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: apiKey,
      secret: apiSecret,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get Green Invoice token');
  }

  const data = await response.json() as { token: string };
  return data.token;
}

// Create payment link for a course
paymentRoutes.post('/create-payment/:courseId', async (c) => {
  // Verify user is logged in
  let token = getCookie(c, 'auth_token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return c.json({ error: 'יש להתחבר כדי לרכוש קורס' }, 401);
  }

  let userId: string;
  let userEmail: string;
  let userName: string;

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    userId = payload.userId;
    
    // Get user details
    const user = await c.env.DB.prepare(
      'SELECT email, name FROM users WHERE id = ?'
    ).bind(userId).first() as { email: string; name: string } | null;
    
    if (!user) {
      return c.json({ error: 'משתמש לא נמצא' }, 404);
    }
    
    userEmail = user.email;
    userName = user.name;
  } catch (err) {
    return c.json({ error: 'טוקן לא תקין' }, 401);
  }

  const courseId = c.req.param('courseId');
  
  // Get coupon code from request body
  let couponCode: string | null = null;
  try {
    const body = await c.req.json();
    couponCode = body.couponCode || null;
  } catch {
    // No body or invalid JSON - that's fine
  }

  // Check if already enrolled
  const existingEnrollment = await c.env.DB.prepare(
    'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = ?'
  ).bind(userId, courseId, 'active').first();

  if (existingEnrollment) {
    return c.json({ error: 'כבר רשום לקורס זה' }, 400);
  }

  // Get course details
  const course = await c.env.DB.prepare(
    'SELECT id, title, price, description FROM courses WHERE id = ? AND is_published = 1'
  ).bind(courseId).first() as { id: string; title: string; price: number; description: string } | null;

  if (!course) {
    return c.json({ error: 'קורס לא נמצא' }, 404);
  }

  let finalPrice = course.price;
  let appliedCoupon: string | null = null;

  // Apply coupon if provided
  if (couponCode) {
    const now = Math.floor(Date.now() / 1000);
    const coupon = await c.env.DB.prepare(`
      SELECT * FROM coupons 
      WHERE code = ? 
      AND is_active = 1
      AND (valid_from IS NULL OR valid_from <= ?)
      AND (valid_until IS NULL OR valid_until >= ?)
      AND (max_uses IS NULL OR current_uses < max_uses)
      AND (course_id IS NULL OR course_id = ?)
    `).bind(couponCode.toUpperCase(), now, now, courseId).first() as {
      id: string;
      code: string;
      discount_type: string;
      discount_value: number;
    } | null;

    if (coupon) {
      if (coupon.discount_type === 'percent') {
        finalPrice = Math.round(course.price * (1 - coupon.discount_value / 100));
      } else {
        finalPrice = Math.max(0, course.price - coupon.discount_value);
      }
      appliedCoupon = coupon.code;

      // Increment coupon usage
      await c.env.DB.prepare(
        'UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?'
      ).bind(coupon.id).run();
    }
  }

  if (!finalPrice || finalPrice === 0) {
    // Free course (or 100% discount) - enroll directly
    const enrollmentId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at)
      VALUES (?, ?, ?, 'active', unixepoch())
    `).bind(enrollmentId, userId, courseId).run();

    return c.json({ 
      success: true, 
      free: true,
      message: 'נרשמת לקורס בהצלחה!' 
    });
  }

  try {
    // Get Green Invoice token
    const giToken = await getGreenInvoiceToken(
      c.env.GREEN_INVOICE_API_KEY,
      c.env.GREEN_INVOICE_SECRET
    );

    // Create payment form (PaymentForm - דף תשלום)
    const incomeDescription = appliedCoupon 
      ? `${course.title} (קופון: ${appliedCoupon})`
      : course.title;

    const paymentResponse = await fetch(`${GREEN_INVOICE_API}/payments/form`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${giToken}`,
      },
      body: JSON.stringify({
        description: course.title,
        type: 400, // חשבונית מס קבלה
        lang: 'he',
        currency: 'ILS',
        vatType: 1, // כולל מע"מ
        amount: finalPrice,
        maxPayments: 3, // עד 3 תשלומים
        pluginId: 'hai-tech-lms',
        client: {
          name: userName,
          emails: [userEmail],
        },
        income: [
          {
            description: incomeDescription,
            quantity: 1,
            price: finalPrice,
            currency: 'ILS',
            vatType: 1,
          }
        ],
        remarks: `קורס: ${course.title}\nמשתמש: ${userId}\nקורס ID: ${courseId}${appliedCoupon ? `\nקופון: ${appliedCoupon}` : ''}`,
        successUrl: `https://hai.tech/lms/course?id=${courseId}&payment=success`,
        failureUrl: `https://hai.tech/lms/course?id=${courseId}&payment=failed`,
        notifyUrl: `https://hai.tech/lms/api/webhooks/greeninvoice`,
        custom: JSON.stringify({
          userId,
          courseId,
          userEmail,
        }),
      }),
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      console.error('Green Invoice error:', error);
      return c.json({ error: 'שגיאה ביצירת דף תשלום' }, 500);
    }

    const paymentData = await paymentResponse.json() as { 
      id: string; 
      url: string;
    };

    // Store pending payment
    await c.env.DB.prepare(`
      INSERT INTO pending_payments (id, user_id, course_id, amount, created_at)
      VALUES (?, ?, ?, ?, unixepoch())
    `).bind(paymentData.id, userId, courseId, finalPrice).run();

    return c.json({
      success: true,
      paymentUrl: paymentData.url,
      paymentId: paymentData.id,
    });

  } catch (err) {
    console.error('Payment error:', err);
    return c.json({ error: 'שגיאה בתהליך התשלום' }, 500);
  }
});

// Webhook endpoint for Green Invoice payment notifications
paymentRoutes.post('/webhooks/greeninvoice', async (c) => {
  try {
    const body = await c.req.json();
    
    console.log('Green Invoice webhook received:', JSON.stringify(body));

    // Green Invoice sends different event types
    const eventType = body.type || body.eventType;
    
    // We care about successful payments (document created with payment)
    if (eventType !== 'document.created' && eventType !== 'payment.success') {
      return c.json({ received: true, ignored: true });
    }

    // Extract custom data (userId, courseId)
    let userId: string | null = null;
    let courseId: string | null = null;

    // Try to get from custom field
    if (body.custom) {
      try {
        const custom = typeof body.custom === 'string' ? JSON.parse(body.custom) : body.custom;
        userId = custom.userId;
        courseId = custom.courseId;
      } catch (e) {
        console.error('Failed to parse custom field');
      }
    }

    // Try to get from remarks field
    if (!userId || !courseId) {
      const remarks = body.remarks || body.document?.remarks || '';
      const userMatch = remarks.match(/משתמש:\s*([^\n]+)/);
      const courseMatch = remarks.match(/קורס ID:\s*([^\n]+)/);
      
      if (userMatch) userId = userMatch[1].trim();
      if (courseMatch) courseId = courseMatch[1].trim();
    }

    if (!userId || !courseId) {
      console.error('Missing userId or courseId in webhook');
      return c.json({ error: 'Missing required data' }, 400);
    }

    // Check if already enrolled
    const existingEnrollment = await c.env.DB.prepare(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?'
    ).bind(userId, courseId).first();

    if (existingEnrollment) {
      console.log('User already enrolled, skipping');
      return c.json({ received: true, alreadyEnrolled: true });
    }

    // Enroll user in course
    const enrollmentId = crypto.randomUUID();
    const paymentId = body.id || body.document?.id || 'unknown';

    await c.env.DB.prepare(`
      INSERT INTO enrollments (id, user_id, course_id, payment_id, status, enrolled_at)
      VALUES (?, ?, ?, ?, 'active', unixepoch())
    `).bind(enrollmentId, userId, courseId, paymentId).run();

    console.log(`User ${userId} enrolled in course ${courseId} after payment ${paymentId}`);

    // Update pending_payments if exists
    await c.env.DB.prepare(`
      UPDATE pending_payments 
      SET status = 'completed', completed_at = unixepoch() 
      WHERE user_id = ? AND course_id = ?
    `).bind(userId, courseId).run();

    return c.json({ 
      success: true, 
      enrolled: true,
      userId,
      courseId,
    });

  } catch (err) {
    console.error('Webhook error:', err);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Get payment status
paymentRoutes.get('/status/:paymentId', async (c) => {
  const paymentId = c.req.param('paymentId');

  const payment = await c.env.DB.prepare(
    'SELECT * FROM pending_payments WHERE id = ?'
  ).bind(paymentId).first();

  if (!payment) {
    return c.json({ error: 'תשלום לא נמצא' }, 404);
  }

  return c.json({ payment });
});

// Validate coupon code
paymentRoutes.post('/validate-coupon', async (c) => {
  const { code, courseId } = await c.req.json();

  if (!code) {
    return c.json({ valid: false, error: 'קוד קופון חסר' });
  }

  const now = Math.floor(Date.now() / 1000);

  const coupon = await c.env.DB.prepare(`
    SELECT * FROM coupons 
    WHERE code = ? 
    AND is_active = 1
    AND (valid_from IS NULL OR valid_from <= ?)
    AND (valid_until IS NULL OR valid_until >= ?)
    AND (max_uses IS NULL OR current_uses < max_uses)
    AND (course_id IS NULL OR course_id = ?)
  `).bind(code.toUpperCase(), now, now, courseId).first() as {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    course_id: string | null;
  } | null;

  if (!coupon) {
    return c.json({ valid: false, error: 'קוד קופון לא תקין או פג תוקף' });
  }

  return c.json({
    valid: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      courseSpecific: !!coupon.course_id,
    }
  });
});
