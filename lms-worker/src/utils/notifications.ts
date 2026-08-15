/**
 * Notification utilities for LMS
 * - Push new registrations to CRM
 * - Send email notifications
 */

interface NewUserData {
  name: string;
  email: string;
  phone?: string | null;
}

const CRM_WEBHOOK_URL = 'https://crm.orma-ai.com/api/webhook/leads';
const NOTIFICATION_WEBHOOK_URL = 'https://notify.hai.tech/new-lead';

/**
 * Push new LMS registration to CRM (fire-and-forget)
 */
export async function pushToCRM(user: NewUserData, crmApiKey?: string): Promise<void> {
  const apiKey = crmApiKey?.trim();
  if (!apiKey) {
    console.error('[LMS→CRM] Missing CRM_API_KEY secret');
    return;
  }

  try {
    const res = await fetch(CRM_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        phone: user.phone || undefined,
        source: 'website-lms',
        notes: `נרשם/ה ל-LMS באתר hai.tech`,
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    console.log(`[LMS→CRM] ${user.email}: ${data.isNew ? 'NEW' : 'EXISTS'} (${res.status})`);
  } catch (err) {
    console.error('[LMS→CRM] Failed:', err);
  }
}

/**
 * Send email notification about new registration (fire-and-forget)
 */
export async function notifyNewRegistration(user: NewUserData): Promise<void> {
  try {
    const res = await fetch(NOTIFICATION_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        timestamp: new Date().toISOString(),
      }),
    });
    console.log(`[LMS→NOTIFY] ${user.email}: ${res.status}`);
  } catch (err) {
    console.error('[LMS→NOTIFY] Failed:', err);
  }
}
