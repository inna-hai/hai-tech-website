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
const CRM_API_KEY = '9d75edbf83df79261c4f9bd8b3943f18338854d1fc3e7cbd1fece3df17825f9a';
const NOTIFICATION_WEBHOOK_URL = 'https://notify.hai.tech/new-lead';

/**
 * Push new LMS registration to CRM (fire-and-forget)
 */
export async function pushToCRM(user: NewUserData): Promise<void> {
  try {
    const res = await fetch(CRM_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CRM_API_KEY,
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
