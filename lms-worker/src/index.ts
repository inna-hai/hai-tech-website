/**
 * LMS API Worker - Main Entry Point
 * Cloudflare Workers + D1 Database
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { coursesRoutes } from './routes/courses';
import { progressRoutes } from './routes/progress';
import { quizRoutes } from './routes/quiz';
import { gamificationRoutes } from './routes/gamification';
import { parentRoutes } from './routes/parent';
import { adminRoutes } from './routes/admin';
import { paymentRoutes } from './routes/payments';

// Type definitions for Cloudflare bindings
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  // WooCommerce REST API (haitechdigitalcourses.hai.tech)
  WOO_API_KEY: string;
  WOO_API_SECRET: string;
  // HMAC secret for auto-login payment URLs (must match WP snippet #67)
  HAITECH_PAY_SECRET: string;
}

// Create Hono app with typed bindings
const app = new Hono<{ Bindings: Env }>();

// ── IP Blocklist ──
export const BLOCKED_IPS_LIST = [
  { ip: '23.129.64.221', reason: 'Tor exit node — automated registration attack 2026-03-09' },
];
const BLOCKED_IPS = new Set(BLOCKED_IPS_LIST.map(b => b.ip));

// ── Security Middleware (runs on every request) ──

// 1. IP Blocklist
app.use('*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || '';
  if (BLOCKED_IPS.has(ip)) {
    return c.json({ error: 'Access denied' }, 403);
  }
  await next();
});

// 2. Security Headers (API only — don't break frontend)
app.use('/lms/api/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

// 3. Request size limit (block oversized payloads — DoS protection)
app.use('*', async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength) > 50_000) { // 50KB max
    return c.json({ error: 'Payload too large' }, 413);
  }
  await next();
});

// 4. Global rate limiting (all endpoints — 60 req/min per IP)
const globalRateMap = new Map<string, { count: number; resetAt: number }>();
app.use('/lms/api/*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();
  const entry = globalRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    globalRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    entry.count++;
    if (entry.count > 60) {
      return c.json({ error: 'Too many requests' }, 429);
    }
  }
  await next();
});

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/lms/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'lms-worker'
  });
});

// Mount routes
app.route('/lms/api/auth', authRoutes);
app.route('/lms/api/courses', coursesRoutes);
app.route('/lms/api/progress', progressRoutes);
app.route('/lms/api/quiz', quizRoutes);
app.route('/lms/api/gamification', gamificationRoutes);
app.route('/lms/api/parent', parentRoutes);
app.route('/lms/api/admin', adminRoutes);
app.route('/lms/api/payments', paymentRoutes);

// Webhook routes (WooCommerce order webhooks)
app.route('/lms/api/webhooks', paymentRoutes);
app.post('/lms/api/webhooks/wc-webhook', (c) => c.redirect('/lms/api/payments/wc-webhook', 307));

// ── Lead Proxy (hides CRM API key from frontend) ──
// Frontend sends leads here WITHOUT api key → Worker forwards to CRM WITH api key
const leadProxyRateMap = new Map<string, { count: number; resetAt: number }>();
app.post('/lms/api/leads/submit', async (c) => {
  // Rate limit: 3 leads per 10 minutes per IP
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();
  const entry = leadProxyRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    leadProxyRateMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
  } else {
    entry.count++;
    if (entry.count > 3) {
      return c.json({ error: 'יותר מדי בקשות. נסה שוב מאוחר יותר.' }, 429);
    }
  }

  try {
    const body = await c.req.json();
    const { name, phone, email, childName, childAge, interest, message, source, utm } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return c.json({ error: 'שם לא תקין' }, 400);
    }
    if (!phone && !email) {
      return c.json({ error: 'נדרש טלפון או אימייל' }, 400);
    }

    // Block XSS/HTML injection in name
    const dangerousPattern = /<[^>]*>|\{\{|\}\}|<script|javascript:|on\w+=/i;
    if (dangerousPattern.test(name) || (phone && dangerousPattern.test(phone))) {
      console.warn(`[LEAD-PROXY] Blocked suspicious input from ${ip}: ${name}`);
      return c.json({ error: 'קלט לא תקין' }, 400);
    }

    // Validate phone format (Israeli)
    if (phone) {
      const cleanPhone = phone.replace(/[-\s()]/g, '');
      const validPhone = /^(05\d{8}|9725\d{8}|0[2-9]\d{7})$/.test(cleanPhone);
      if (!validPhone) {
        return c.json({ error: 'מספר טלפון לא תקין' }, 400);
      }
    }

    // Forward to CRM (server-side, key hidden)
    const crmResponse = await fetch('https://crm.orma-ai.com/api/webhook/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'haitech-crm-api-key-2026',
      },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone?.trim() || undefined,
        email: email?.trim() || undefined,
        childName: childName?.trim() || undefined,
        childAge: childAge || undefined,
        interest: interest?.trim() || undefined,
        message: message?.trim() || undefined,
        source: source || 'website',
        utm: utm || undefined,
      }),
    });

    const result = await crmResponse.json();
    console.log(`[LEAD-PROXY] ${ip}: ${name} → CRM ${crmResponse.status}`);

    // Send email notification to info@hai.tech via notify server
    try {
      const emailBody = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0;">🎉 ליד חדש מהאתר!</h2>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">📝 שם:</td><td style="padding: 8px 0;">${name.trim()}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">📱 טלפון:</td><td style="padding: 8px 0; direction: ltr;">${phone?.trim() || 'לא צוין'}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">📧 אימייל:</td><td style="padding: 8px 0;">${email?.trim() || 'לא צוין'}</td></tr>
              ${childName ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">👦 שם הילד/ה:</td><td style="padding: 8px 0;">${childName.trim()}</td></tr>` : ''}
              ${childAge ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">🎂 גיל:</td><td style="padding: 8px 0;">${childAge}</td></tr>` : ''}
              ${interest ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">📚 מתעניין/ת ב:</td><td style="padding: 8px 0;">${interest.trim()}</td></tr>` : ''}
              ${message ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #334155;">💬 הודעה:</td><td style="padding: 8px 0;">${message.trim()}</td></tr>` : ''}
            </table>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">מקור: אתר hai.tech | ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</p>
            <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0;">CRM: ${crmResponse.ok ? '✅ נשלח בהצלחה' : '❌ שגיאה בשליחה'}</p>
          </div>
        </div>
      `;

      await fetch('https://notify.hai.tech/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'info@hai.tech',
          subject: `🎯 ליד חדש: ${name.trim()} ${phone ? '(' + phone.trim() + ')' : ''}`,
          html: emailBody,
        }),
      });
    } catch (emailErr) {
      console.error('[LEAD-PROXY] Email notification failed:', emailErr);
    }

    return c.json({ success: true, isNew: (result as any).isNew }, crmResponse.status as any);
  } catch (err) {
    console.error('[LEAD-PROXY] Error:', err);
    return c.json({ error: 'שגיאה בשליחת הפנייה' }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

// Error handler — never leak internal details
app.onError((err, c) => {
  console.error('[ERROR]', err.message, err.stack);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
