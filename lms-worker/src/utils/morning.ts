/**
 * Morning (GreenInvoice) direct-payment helpers for the LMS worker.
 *
 * Replaces the WooCommerce checkout (haitechdigitalcourses.hai.tech) with Morning
 * hosted payment forms (POST /payments/form).
 *
 * Verification is payload-agnostic: the body Morning POSTs to `notifyUrl` is not
 * documented, so we never trust it. Instead every purchase carries a signed token
 * (HMAC-SHA256 with PAYMENT_LINK_SECRET) holding the purchase context, and the
 * payment is confirmed by looking the document up in Morning (GET /documents/{id}
 * or POST /documents/search by the per-purchase ref embedded in the description).
 *
 * NOTE: a sibling plain-JS copy of this logic lives in functions/_lib/morning.js
 * (Cloudflare Pages Functions are a separate deploy unit). Keep them in sync.
 */

export interface MorningEnv {
  MORNING_API_KEY_ID?: string;
  MORNING_API_SECRET?: string;
  MORNING_BASE_URL?: string;
  MORNING_TOKEN_URL?: string;
  MORNING_PAYMENT_DOC_TYPE?: string;
  MORNING_PAYMENT_PLUGIN_ID?: string;
  PAYMENT_LINK_SECRET?: string;
  CRM_API_KEY?: string;
  CRM_BASE_URL?: string;
}

export const DEFAULT_MORNING_BASE_URL = 'https://api.greeninvoice.co.il/api/v1';
export const DEFAULT_MORNING_TOKEN_URL = 'https://api.morning.co/idp/v1/oauth/token';
// Same default clearing plugin the CRM uses.
export const DEFAULT_MORNING_PLUGIN_ID = '05873f9d-7030-4b66-ad02-338edadee6fc';
export const DEFAULT_CRM_BASE_URL = 'https://crm.orma-ai.com';

/** Document types we accept as proof of payment: 305 חשבונית מס, 320 חשבונית מס/קבלה, 400 קבלה */
export const ACCEPTED_DOC_TYPES = [305, 320, 400];
/** Document statuses that mean cancelled (3 = מבטל, 4 = שבוטל) */
const CANCELLED_DOC_STATUSES = [3, 4];

/** Max token age accepted when confirming a payment (30 days). */
const MAX_TOKEN_AGE_SEC = 30 * 24 * 3600;

// ─────────────────────────────────────────────────────────────────────────────
// OAuth token (cached per isolate)
// ─────────────────────────────────────────────────────────────────────────────
let cachedToken: { token: string; expiresAtMs: number; cacheKey: string } | null = null;

/** For tests. */
export function _resetMorningTokenCache(): void {
  cachedToken = null;
}

export async function getMorningAccessToken(env: MorningEnv): Promise<string> {
  const id = env.MORNING_API_KEY_ID?.trim();
  const secret = env.MORNING_API_SECRET?.trim();
  if (!id || !secret) throw new Error('Morning API credentials are not configured');

  const tokenUrl = env.MORNING_TOKEN_URL?.trim() || DEFAULT_MORNING_TOKEN_URL;
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
  const data = (await res.json()) as any;
  const token: string | undefined = data.accessToken || data.access_token || data.token;
  if (!token) throw new Error('Morning token response missing accessToken');

  let expiresAtMs = now + 3600_000;
  if (typeof data.expiresAt === 'number') expiresAtMs = data.expiresAt * 1000;
  else if (typeof data.expires_in === 'number') expiresAtMs = now + data.expires_in * 1000;

  cachedToken = { token, expiresAtMs, cacheKey };
  return token;
}

async function morningRequest(env: MorningEnv, method: string, path: string, body?: unknown): Promise<any> {
  const base = (env.MORNING_BASE_URL?.trim() || DEFAULT_MORNING_BASE_URL).replace(/\/+$/, '');
  const token = await getMorningAccessToken(env);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    throw new Error(`Morning ${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment form
// ─────────────────────────────────────────────────────────────────────────────
export interface CreatePaymentFormParams {
  ref: string;
  title: string;
  amount: number;
  client: { name: string; email?: string; phone?: string };
  successUrl: string;
  failureUrl: string;
  notifyUrl: string;
  maxPayments?: number;
}

export function buildPaymentFormBody(env: MorningEnv, p: CreatePaymentFormParams): Record<string, unknown> {
  const docType = Number(env.MORNING_PAYMENT_DOC_TYPE?.trim() || 320) || 320;
  const pluginId = env.MORNING_PAYMENT_PLUGIN_ID?.trim() || DEFAULT_MORNING_PLUGIN_ID;
  const amount = Math.round(p.amount * 100) / 100;
  const client: Record<string, unknown> = { name: p.client.name || 'לקוח' };
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

/** POST /payments/form → hosted payment page URL. */
export async function createMorningPaymentForm(env: MorningEnv, p: CreatePaymentFormParams): Promise<string> {
  if (!(p.amount > 0)) throw new Error('Payment amount must be greater than 0');
  const data = await morningRequest(env, 'POST', '/payments/form', buildPaymentFormBody(env, p));
  if (!data || data.success !== true || (data.errorCode !== undefined && data.errorCode !== 0) || !data.url) {
    throw new Error(`Morning payment form error: ${data?.errorCode ?? '?'} ${data?.errorDescription ?? ''}`.trim());
  }
  return String(data.url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Signed purchase token
// ─────────────────────────────────────────────────────────────────────────────
export interface PurchaseContext {
  /** Per-purchase reference, e.g. HT-AB12CD34EF */
  ref: string;
  /** 'course' = logged-in LMS purchase, 'link' = public marketing page */
  k: 'course' | 'link';
  /** Expected amount (ILS, VAT inclusive) */
  a: number;
  /** Unix seconds at creation */
  ts: number;
  /** LMS user id */
  u?: string;
  /** LMS course id */
  c?: string;
  /** Customer email (public links) */
  em?: string;
}

export function generateRef(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `HT-${s}`;
}

function b64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requireLinkSecret(env: MorningEnv): string {
  const secret = env.PAYMENT_LINK_SECRET?.trim();
  if (!secret) throw new Error('PAYMENT_LINK_SECRET is not configured');
  return secret;
}

/** Token format: <base64url(JSON ctx)>.<hex hmac>  (URL-path safe) */
export async function signPurchaseToken(env: MorningEnv, ctx: PurchaseContext): Promise<string> {
  const payload = b64urlEncode(JSON.stringify(ctx));
  const sig = await hmacHex(payload, requireLinkSecret(env));
  return `${payload}.${sig}`;
}

/** Returns the context if the signature is valid, otherwise null. */
export async function verifyPurchaseToken(env: MorningEnv, token: string | undefined | null): Promise<PurchaseContext | null> {
  if (!token || typeof token !== 'string') return null;
  const secret = env.PAYMENT_LINK_SECRET?.trim();
  if (!secret) {
    console.error('[MORNING] PAYMENT_LINK_SECRET is not configured');
    return null;
  }
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1).toLowerCase();
  const expected = await hmacHex(payload, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const ctx = JSON.parse(b64urlDecode(payload)) as PurchaseContext;
    if (!ctx || typeof ctx.ref !== 'string' || !/^HT-[A-Z0-9]{6,20}$/.test(ctx.ref)) return null;
    if (typeof ctx.a !== 'number' || !(ctx.a > 0)) return null;
    if (typeof ctx.ts !== 'number') return null;
    const now = Math.floor(Date.now() / 1000);
    if (ctx.ts > now + 300 || now - ctx.ts > MAX_TOKEN_AGE_SEC) return null;
    if (ctx.k !== 'course' && ctx.k !== 'link') return null;
    return ctx;
  } catch {
    return null;
  }
}

/** Looks like a signed Morning purchase token (vs. a numeric WooCommerce order id). */
export function looksLikePurchaseToken(s: string): boolean {
  return /^[A-Za-z0-9_-]+\.[0-9a-fA-F]{64}$/.test(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment confirmation
// ─────────────────────────────────────────────────────────────────────────────
export interface MorningDocument {
  id: string;
  number?: number | string;
  type?: number;
  status?: number;
  amount?: number;
  description?: string;
  remarks?: string;
  documentDate?: string;
  client?: { name?: string; emails?: string[]; phone?: string; mobile?: string };
  url?: { he?: string; en?: string; origin?: string };
}

/** Parse a notify body defensively (JSON or form-encoded) and extract a candidate document id. */
export function extractCandidateDocumentId(rawBody: string | null | undefined): string | null {
  if (!rawBody) return null;
  let obj: any = null;
  try {
    obj = JSON.parse(rawBody);
  } catch {
    try {
      const params = new URLSearchParams(rawBody);
      obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      if (typeof obj.data === 'string') {
        try { obj.data = JSON.parse(obj.data); } catch { /* ignore */ }
      }
      if (typeof obj.document === 'string') {
        try { obj.document = JSON.parse(obj.document); } catch { /* ignore */ }
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

export function isAcceptablePaymentDocument(doc: MorningDocument | null | undefined, ref: string, expectedAmount: number): boolean {
  if (!doc || !doc.id) return false;
  const text = `${doc.description || ''} ${doc.remarks || ''}`;
  if (!text.includes(ref)) return false;
  if (typeof doc.amount !== 'number' || Math.abs(doc.amount - expectedAmount) >= 1) return false;
  if (!ACCEPTED_DOC_TYPES.includes(Number(doc.type))) return false;
  if (CANCELLED_DOC_STATUSES.includes(Number(doc.status))) return false;
  return true;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Confirm that a payment for `ctx` exists in Morning.
 * 1. If a candidate document id is given → GET /documents/{id}
 * 2. Otherwise (or on mismatch/failure) → POST /documents/search by ref.
 */
export async function findPaidMorningDocument(
  env: MorningEnv,
  ctx: Pick<PurchaseContext, 'ref' | 'a' | 'ts'>,
  candidateDocId?: string | null,
): Promise<MorningDocument | null> {
  if (candidateDocId) {
    try {
      const doc = (await morningRequest(env, 'GET', `/documents/${encodeURIComponent(candidateDocId)}`)) as MorningDocument;
      if (isAcceptablePaymentDocument(doc, ctx.ref, ctx.a)) return doc;
    } catch (err) {
      console.warn('[MORNING] GET document failed, falling back to search:', (err as Error).message);
    }
  }

  const from = new Date(ctx.ts * 1000 - 24 * 3600_000);
  const to = new Date(Date.now() + 24 * 3600_000);
  const result = await morningRequest(env, 'POST', '/documents/search', {
    description: ctx.ref,
    fromDate: ymd(from),
    toDate: ymd(to),
    type: [320, 400, 305],
    page: 1,
    pageSize: 10,
  });
  const items: MorningDocument[] = Array.isArray(result?.items) ? result.items : [];
  return items.find((d) => isAcceptablePaymentDocument(d, ctx.ref, ctx.a)) || null;
}

/** Optional: verify `x-webhook-signature` (hex HMAC-SHA256 of raw body) for Morning UI webhooks. */
export async function verifyMorningWebhookSignature(rawBody: string, signature: string | undefined, secret: string): Promise<boolean> {
  if (!signature) return false;
  const expected = await hmacHex(rawBody, secret);
  return timingSafeEqual(signature.trim().toLowerCase(), expected);
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM forward (replaces the old WooCommerce → CRM webhook)
// ─────────────────────────────────────────────────────────────────────────────
export interface CrmPaymentForward {
  documentId: string;
  ref: string;
  expectedAmount: number;
  source: string;
  description?: string;
  cycleId?: string;
  customer?: { name?: string; email?: string; phone?: string };
}

export async function forwardPaymentToCrm(env: MorningEnv, payload: CrmPaymentForward): Promise<void> {
  const key = env.CRM_API_KEY?.trim();
  if (!key) {
    console.error('[MORNING→CRM] Missing CRM_API_KEY');
    return;
  }
  const base = (env.CRM_BASE_URL?.trim() || DEFAULT_CRM_BASE_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/payments/morning/external`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[MORNING→CRM] ${res.status} ${text.slice(0, 300)}`);
    } else {
      console.log(`[MORNING→CRM] Forwarded ${payload.ref} doc ${payload.documentId}`);
    }
  } catch (err) {
    console.error('[MORNING→CRM] Failed:', err);
  }
}
