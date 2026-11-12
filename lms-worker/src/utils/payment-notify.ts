/**
 * Shared notification helpers for payment flows (WooCommerce legacy + Morning).
 */
import type { Env } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// Welcome email helper
// ─────────────────────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(userName: string, userEmail: string, courseTitle: string, courseId: string) {
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

export function sendPaymentLeadToCRM(env: Pick<Env, 'CRM_API_KEY'>, leadBody: Record<string, unknown>, logMessage: string): void {
  const crmApiKey = env.CRM_API_KEY?.trim();
  if (!crmApiKey) {
    console.error('[PAYMENT-LEAD] Missing CRM_API_KEY secret');
    return;
  }

  fetch('https://crm.orma-ai.com/api/webhook/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': crmApiKey },
    body: JSON.stringify(leadBody),
  }).catch((err) => {
    console.error('[PAYMENT-LEAD] Failed to send to CRM:', err);
  });
  console.log(logMessage);
}


/** Purchase notification to info@hai.tech (fire-and-forget). */
export async function sendPurchaseNotification(p: {
  name: string; email: string; phone?: string | null; courseTitle: string; amount: number | string; orderRef: string;
}): Promise<void> {
  try {
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0;">💰 רכישה חדשה!</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">📝 שם:</td><td style="padding: 8px 0;">${p.name}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">📧 אימייל:</td><td style="padding: 8px 0;">${p.email}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">📱 טלפון:</td><td style="padding: 8px 0; direction: ltr;">${p.phone || 'לא צוין'}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">🎓 קורס:</td><td style="padding: 8px 0;">${p.courseTitle}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">💳 סכום:</td><td style="padding: 8px 0;">₪${p.amount}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">🔢 הזמנה:</td><td style="padding: 8px 0;">${p.orderRef}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">🕐 ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</p>
        </div>
      </div>`;
    await fetch('https://notify.hai.tech/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'info@hai.tech',
        subject: `💰 רכישה: ${p.name} — ${p.courseTitle} (₪${p.amount})`,
        html,
      }),
    });
  } catch (err) {
    console.error('[PURCHASE-EMAIL] Failed:', err);
  }
}
