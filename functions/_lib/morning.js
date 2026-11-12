/**
 * Morning (GreenInvoice) direct-payment helpers for Cloudflare Pages Functions.
 *
 * Plain-JS sibling of lms-worker/src/utils/morning.ts (separate deploy unit) — keep in sync.
 * This module exports no onRequest* handlers, so Pages does not route it.
 *
 * Verification is payload-agnostic: the body Morning POSTs to notifyUrl is undocumented,
 * so it is never trusted. The purchase context travels in a token signed with
 * PAYMENT_LINK_SECRET, and payment is confirmed by looking up the Morning document
 * (GET /documents/{id} or POST /documents/search by the per-purchase ref).
 *
 * Env (Pages project): MORNING_API_KEY_ID, MORNING_API_SECRET, PAYMENT_LINK_SECRET, CRM_API_KEY (secrets);
 * optional MORNING_BASE_URL, MORNING_TOKEN_URL, MORNING_PAYMENT_DOC_TYPE, MORNING_PAYMENT_PLUGIN_ID, CRM_BASE_URL.
 */

export const DEFAULT_MORNING_BASE_URL = 'https://api.greeninvoice.co.il/api/v1';
export const DEFAULT_MORNING_TOKEN_URL = 'https://api.morning.co/idp/v1/oauth/token';
export const DEFAULT_MORNING_PLUGIN_ID = '05873f9d-7030-4b66-ad02-338edadee6fc';
export const DEFAULT_CRM_BASE_URL = 'https://crm.orma-ai.com';
export const ACCEPTED_DOC_TYPES = [305, 320, 400];
const CANCELLED_DOC_STATUSES = [3, 4];
const MAX_TOKEN_AGE_SEC = 30 * 24 * 3600;

let cachedToken = null;

export function _resetMorningTokenCache() {
  cachedToken = null;
}

export async function getMorningAccessToken(env) {
  const id = (env.MORNING_API_KEY_ID || '').trim();
  const secret = (env.MORNING_API_SECRET || '').trim();
  if (!id || !secret) throw new Error('Morning API credentials are not configured');
  const tokenUrl = (env.MORNING_TOKEN_URL || '').trim() || DEFAULT_MORNING_TOKEN_URL;
  const cacheKey = `${tokenUrl}|${id}`;
  const now = Date.now();
  if (cachedToken && cachedToken.cacheKey === cacheKey && cachedToken.expiresAtMs - 60_000 > now) {
    return cachedToken.token;
  }
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Morning token request failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const token = data.accessToken || data.access_token || data.token;
  if (!token) throw new Error('Morning token response missing accessToken');
  let expiresAtMs = now + 3600_000;
  if (typeof data.expiresAt === 'number') expiresAtMs = data.expiresAt * 1000;
  else if (typeof data.expires_in === 'number') expiresAtMs = now + data.expires_in * 1000;
  cachedToken = { token, expiresAtMs, cacheKey };
  return token;
}

async function morningRequest(env, method, path, body) {
  const base = ((env.MORNING_BASE_URL || '').trim() || DEFAULT_MORNING_BASE_URL).replace(/\/+$/, '');
  const token = await getMorningAccessToken(env);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(`Morning ${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  return json;
}

export function buildPaymentFormBody(env, p) {
  const docType = Number((env.MORNING_PAYMENT_DOC_TYPE || '').trim() || 320) || 320;
  const pluginId = (env.MORNING_PAYMENT_PLUGIN_ID || '').trim() || DEFAULT_MORNING_PLUGIN_ID;
  const amount = Math.round(p.amount * 100) / 100;
  const client = { name: p.client.name || 'לקוח' };
  if (p.client.email) client.emails = [p.client.email];
  if (p.client.phone) {
    client.phone = p.client.phone;
    client.mobile = p.client.phone;
  }
  return {
    description: `${p.title} · הזמנה ${p.ref}`,
    type: docType,
    amount,
    currency: 'ILS',
    vatType: 0,
    lang: 'he',
    maxPayments: Math.min(36, Math.max(1, Math.floor(p.maxPayments || 1))),
    pluginId,
    client,
    income: [{ description: p.title, quantity: 1, price: amount, currency: 'ILS', vatType: 1 }],
    remarks: `הזמנה ${p.ref}`,
    successUrl: p.successUrl,
    failureUrl: p.failureUrl,
    notifyUrl: p.notifyUrl,
    custom: p.ref,
  };
}

export async function createMorningPaymentForm(env, p) {
  if (!(p.amount > 0)) throw new Error('Payment amount must be greater than 0');
  const data = await morningRequest(env, 'POST', '/payments/form', buildPaymentFormBody(env, p));
  if (!data || data.success !== true || (data.errorCode !== undefined && data.errorCode !== 0) || !data.url) {
    throw new Error(`Morning payment form error: ${data?.errorCode ?? '?'} ${data?.errorDescription ?? ''}`.trim());
  }
  return String(data.url);
}

export function generateRef() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `HT-${s}`;
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function hmacHex(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Token: <base64url(JSON ctx)>.<hex hmac>. ctx = { ref, k, a, ts, ...extra } */
export async function signPurchaseToken(env, ctx) {
  const secret = (env.PAYMENT_LINK_SECRET || '').trim();
  if (!secret) throw new Error('PAYMENT_LINK_SECRET is not configured');
  const payload = b64urlEncode(JSON.stringify(ctx));
  return `${payload}.${await hmacHex(payload, secret)}`;
}

export async function verifyPurchaseToken(env, token) {
  if (!token || typeof token !== 'string') return null;
  const secret = (env.PAYMENT_LINK_SECRET || '').trim();
  if (!secret) {
    console.error('[MORNING] PAYMENT_LINK_SECRET is not configured');
    return null;
  }
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1).toLowerCase();
  if (!timingSafeEqual(sig, await hmacHex(payload, secret))) return null;
  try {
    const ctx = JSON.parse(b64urlDecode(payload));
    if (!ctx || typeof ctx.ref !== 'string' || !/^HT-[A-Z0-9]{6,20}$/.test(ctx.ref)) return null;
    if (typeof ctx.a !== 'number' || !(ctx.a > 0) || typeof ctx.ts !== 'number') return null;
    const now = Math.floor(Date.now() / 1000);
    if (ctx.ts > now + 300 || now - ctx.ts > MAX_TOKEN_AGE_SEC) return null;
    return ctx;
  } catch {
    return null;
  }
}

export function extractCandidateDocumentId(rawBody) {
  if (!rawBody) return null;
  let obj = null;
  try {
    obj = JSON.parse(rawBody);
  } catch {
    try {
      const params = new URLSearchParams(rawBody);
      obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      for (const key of ['data', 'document']) {
        if (typeof obj[key] === 'string') {
          try { obj[key] = JSON.parse(obj[key]); } catch { /* ignore */ }
        }
      }
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [obj.documentId, obj.document?.id, obj.data?.documentId, obj.data?.id, obj.id];
  for (const c of candidates) {
    if (typeof c === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(c)) return c;
  }
  return null;
}

export function isAcceptablePaymentDocument(doc, ref, expectedAmount) {
  if (!doc || !doc.id) return false;
  const text = `${doc.description || ''} ${doc.remarks || ''}`;
  if (!text.includes(ref)) return false;
  if (typeof doc.amount !== 'number' || Math.abs(doc.amount - expectedAmount) >= 1) return false;
  if (!ACCEPTED_DOC_TYPES.includes(Number(doc.type))) return false;
  if (CANCELLED_DOC_STATUSES.includes(Number(doc.status))) return false;
  return true;
}

const ymd = (d) => d.toISOString().slice(0, 10);

export async function findPaidMorningDocument(env, ctx, candidateDocId) {
  if (candidateDocId) {
    try {
      const doc = await morningRequest(env, 'GET', `/documents/${encodeURIComponent(candidateDocId)}`);
      if (isAcceptablePaymentDocument(doc, ctx.ref, ctx.a)) return doc;
    } catch (err) {
      console.warn('[MORNING] GET document failed, falling back to search:', err.message);
    }
  }
  const result = await morningRequest(env, 'POST', '/documents/search', {
    description: ctx.ref,
    fromDate: ymd(new Date(ctx.ts * 1000 - 24 * 3600_000)),
    toDate: ymd(new Date(Date.now() + 24 * 3600_000)),
    type: [320, 400, 305],
    page: 1,
    pageSize: 10,
  });
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.find((d) => isAcceptablePaymentDocument(d, ctx.ref, ctx.a)) || null;
}

export async function forwardPaymentToCrm(env, payload) {
  const key = (env.CRM_API_KEY || '').trim();
  if (!key) {
    console.error('[MORNING→CRM] Missing CRM_API_KEY');
    return;
  }
  const base = ((env.CRM_BASE_URL || '').trim() || DEFAULT_CRM_BASE_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/payments/morning/external`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[MORNING→CRM] ${res.status} ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error('[MORNING→CRM] Failed:', err);
  }
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
