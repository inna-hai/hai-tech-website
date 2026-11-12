/**
 * Test helpers: a D1-compatible fake backed by node:sqlite (in-memory) and a fetch mock router.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { vi } from 'vitest';

const require = createRequire(import.meta.url);
// node:sqlite (Node >= 22.5). Loaded via require so Vite does not try to bundle it.
const { DatabaseSync } = require('node:sqlite');

export function createFakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(__dirname, '../src/db/schema.sql'), 'utf8'));
  // Columns/tables that exist in production D1 but not in schema.sql (test fixture only).
  db.exec('ALTER TABLE courses ADD COLUMN woo_product_id INTEGER');
  db.exec(`CREATE TABLE coupons (
    id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, discount_type TEXT NOT NULL, discount_value REAL NOT NULL,
    max_uses INTEGER, current_uses INTEGER DEFAULT 0, valid_from INTEGER, valid_until INTEGER,
    course_id TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER)`);

  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...p: unknown[]) => statement(sql, p),
    first: async (col?: string) => {
      const row = db.prepare(sql).get(...(params as any[])) as any;
      if (!row) return null;
      const plain = { ...row };
      return col ? plain[col] : plain;
    },
    run: async () => {
      const info = db.prepare(sql).run(...(params as any[]));
      return { success: true, meta: { changes: Number(info.changes) } };
    },
    all: async () => ({ results: db.prepare(sql).all(...(params as any[])).map((r: any) => ({ ...r })), success: true }),
  });

  return {
    d1: { prepare: (sql: string) => statement(sql), exec: async (sql: string) => db.exec(sql) } as unknown as D1Database,
    raw: db,
  };
}

export type FetchCall = { url: string; method: string; body: any; headers: Record<string, string> };

/**
 * Installs a global fetch mock. `routes` maps "METHOD url-substring" → handler returning [status, json].
 */
export function mockFetch(routes: Record<string, (call: FetchCall) => [number, any] | Promise<[number, any]>>) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (input: any, init: any = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || 'GET').toUpperCase();
    let body: any = init.body;
    try { body = body ? JSON.parse(body) : undefined; } catch { /* raw */ }
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const call = { url, method, body, headers };
    calls.push(call);
    for (const [key, handler] of Object.entries(routes)) {
      const [m, frag] = key.split(' ');
      if (m === method && url.includes(frag)) {
        const [status, json] = await handler(call);
        return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn, find: (frag: string, method?: string) => calls.filter((c) => c.url.includes(frag) && (!method || c.method === method)) };
}

export const MORNING_ENV = {
  MORNING_API_KEY_ID: 'test-key-id',
  MORNING_API_SECRET: 'test-key-secret',
  PAYMENT_LINK_SECRET: 'test-link-secret',
  CRM_API_KEY: 'test-crm-key',
};

export const TOKEN_ROUTE = {
  'POST /idp/v1/oauth/token': () => [200, { accessToken: 'tok-123', expiresAt: Math.floor(Date.now() / 1000) + 3600 }] as [number, any],
};

/** Execution context that collects waitUntil promises. */
export function makeExecCtx() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => { pending.push(p); }, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext,
    flush: async () => { await Promise.allSettled(pending.splice(0)); },
  };
}
