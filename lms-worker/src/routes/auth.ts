/**
 * Authentication Routes
 * Login, Register, Password Reset, Profile
 */

import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import * as jose from 'jose';
import { Env, BLOCKED_IPS_LIST } from '../index';
import { hashPassword, verifyPassword, generateId } from '../utils/helpers';
import { pushToCRM, notifyNewRegistration } from '../utils/notifications';

const SECURITY_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🛡️ LMS Security Monitor</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 24px; }
  
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
  .header h1 { font-size: 26px; font-weight: 700; }
  .header .live { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #94a3b8; }
  .header .dot { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 20px; text-align: center;
  }
  .stat-card .num { font-size: 36px; font-weight: 800; }
  .stat-card .label { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .stat-card.danger .num { color: #ef4444; }
  .stat-card.warning .num { color: #f59e0b; }
  .stat-card.ok .num { color: #22c55e; }
  
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 12px; font-size: 13px; color: #64748b; border-bottom: 1px solid rgba(255,255,255,0.1); }
  td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  tr:hover { background: rgba(255,255,255,0.03); }
  
  .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-red { background: rgba(239,68,68,0.2); color: #ef4444; }
  .badge-yellow { background: rgba(245,158,11,0.2); color: #f59e0b; }
  .badge-blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
  .badge-permanent { background: rgba(168,85,247,0.2); color: #a855f7; }
  
  .empty { text-align: center; padding: 40px; color: #64748b; font-size: 15px; }
  .refresh-bar { text-align: center; font-size: 12px; color: #475569; margin-top: 16px; }
  
  .login-box {
    max-width: 340px; margin: 100px auto; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; text-align: center;
  }
  .login-box h2 { margin-bottom: 16px; }
  .login-box input {
    width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.05); color: white; font-size: 16px; text-align: center;
    font-family: 'Inter'; margin-bottom: 12px;
  }
  .login-box button {
    width: 100%; padding: 12px; border-radius: 8px; border: none;
    background: #2563eb; color: white; font-size: 16px; font-weight: 600;
    cursor: pointer; font-family: 'Inter';
  }
  .login-box button:hover { background: #1d4ed8; }
  .error { color: #ef4444; font-size: 13px; margin-top: 8px; }
</style>
</head>
<body>

<div id="login" style="display:none">
  <div class="login-box">
    <h2>🛡️ Security Monitor</h2>
    <input type="password" id="key" placeholder="Security key" onkeydown="if(event.key==='Enter')doLogin()">
    <button onclick="doLogin()">Login</button>
    <div id="loginError" class="error"></div>
  </div>
</div>

<div id="dashboard" style="display:none">
  <div class="header">
    <h1>🛡️ LMS Security Monitor</h1>
    <div class="live"><span class="dot"></span> Auto-refresh every 10s</div>
  </div>

  <div class="stats">
    <div class="stat-card danger"><div class="num" id="blockedCount">0</div><div class="label">Blocked IPs</div></div>
    <div class="stat-card warning"><div class="num" id="attackCount">0</div><div class="label">Attacks Detected</div></div>
    <div class="stat-card ok"><div class="num" id="rateLimitCount">0</div><div class="label">Active Rate Limits</div></div>
  </div>

  <div class="section">
    <h2>🚫 Blocked IPs</h2>
    <table>
      <thead><tr><th>IP</th><th>Type</th><th>Blocked Until</th><th>Remaining</th></tr></thead>
      <tbody id="blockedTable"></tbody>
    </table>
    <div id="blockedEmpty" class="empty">No blocked IPs ✅</div>
  </div>

  <div class="section">
    <h2>⚠️ Recent Attacks</h2>
    <table>
      <thead><tr><th>Time</th><th>IP</th><th>Name</th><th>Email</th></tr></thead>
      <tbody id="attackTable"></tbody>
    </table>
    <div id="attackEmpty" class="empty">No attacks detected ✅</div>
  </div>

  <div class="section">
    <h2>⏱️ Active Rate Limits</h2>
    <table>
      <thead><tr><th>IP</th><th>Attempts</th><th>Resets At</th></tr></thead>
      <tbody id="rateTable"></tbody>
    </table>
    <div id="rateEmpty" class="empty">No active rate limits</div>
  </div>

  <div class="refresh-bar">Last update: <span id="lastUpdate">—</span></div>
</div>

<script>
let secKey = '';

function doLogin() {
  secKey = document.getElementById('key').value;
  fetch('/lms/api/auth/security-status', { headers: { 'x-security-key': secKey } })
    .then(r => {
      if (!r.ok) throw new Error('Unauthorized');
      return r.json();
    })
    .then(data => {
      document.getElementById('login').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      render(data);
      setInterval(refresh, 10000);
    })
    .catch(() => {
      document.getElementById('loginError').textContent = 'Invalid key';
    });
}

function refresh() {
  fetch('/lms/api/auth/security-status', { headers: { 'x-security-key': secKey } })
    .then(r => r.json())
    .then(render)
    .catch(() => {});
}

function render(data) {
  const totalBlocked = (data.blockedIPs?.length || 0) + (data.permanentBlocks?.length || 0);
  document.getElementById('blockedCount').textContent = totalBlocked;
  document.getElementById('attackCount').textContent = data.stats?.totalAttackLogs || 0;
  document.getElementById('rateLimitCount').textContent = data.rateLimits?.length || 0;

  // Blocked IPs
  const bt = document.getElementById('blockedTable');
  let rows = '';
  
  // Permanent blocks first
  if (data.permanentBlocks?.length) {
    rows += data.permanentBlocks.map(b => 
      \`<tr><td><span class="badge badge-permanent">\${b.ip}</span></td><td><span class="badge badge-permanent">Permanent</span></td><td>\${esc(b.reason)}</td><td>∞</td></tr>\`
    ).join('');
  }
  
  // Auto-blocks
  if (data.blockedIPs?.length) {
    rows += data.blockedIPs.map(b => 
      \`<tr><td><span class="badge badge-red">\${b.ip}</span></td><td><span class="badge badge-red">Auto-blocked</span></td><td>\${new Date(b.until).toLocaleString('en-GB')}</td><td>\${b.remaining}</td></tr>\`
    ).join('');
  }
  
  if (rows) {
    bt.innerHTML = rows;
    document.getElementById('blockedEmpty').style.display = 'none';
  } else {
    bt.innerHTML = '';
    document.getElementById('blockedEmpty').style.display = 'block';
  }

  // Attacks
  const at = document.getElementById('attackTable');
  if (data.recentAttacks?.length) {
    at.innerHTML = data.recentAttacks.map(a => 
      \`<tr><td>\${new Date(a.time).toLocaleTimeString('en-GB')}</td><td><span class="badge badge-yellow">\${a.ip}</span></td><td>\${esc(a.name)}</td><td>\${esc(a.email)}</td></tr>\`
    ).join('');
    document.getElementById('attackEmpty').style.display = 'none';
  } else {
    at.innerHTML = '';
    document.getElementById('attackEmpty').style.display = 'block';
  }

  // Rate limits
  const rt = document.getElementById('rateTable');
  if (data.rateLimits?.length) {
    rt.innerHTML = data.rateLimits.map(r => 
      \`<tr><td><span class="badge badge-blue">\${r.ip}</span></td><td>\${r.count}</td><td>\${new Date(r.resetAt).toLocaleTimeString('en-GB')}</td></tr>\`
    ).join('');
    document.getElementById('rateEmpty').style.display = 'none';
  } else {
    rt.innerHTML = '';
    document.getElementById('rateEmpty').style.display = 'block';
  }

  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('en-GB');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || '?'; return d.innerHTML; }

document.getElementById('login').style.display = 'block';
</script>
</body>
</html>`;

export const authRoutes = new Hono<{ Bindings: Env }>();

// ── Anti-Attack System ──
// Rate limiting + auto-block for repeated abuse + suspicious pattern detection
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const autoBlockMap = new Map<string, number>(); // IP → blocked until timestamp
const attackLog: Array<{ ip: string; email: string; name: string; time: number }> = [];

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const RATE_LIMIT_MAX = 3; // max 3 registrations per minute
const AUTO_BLOCK_DURATION_MS = 24 * 60 * 60_000; // auto-block for 24 hours
const AUTO_BLOCK_THRESHOLD = 5; // 5 attempts in window → auto-block

// Suspicious patterns — common attack signatures
const SUSPICIOUS_PATTERNS = [
  /xss/i, /script/i, /<.*>/, /nosql/i, /inject/i, /union.*select/i,
  /drop.*table/i, /admin.*test/i, /mass.*admin/i, /root@/i,
  /\{.*\}/, /\$\{/, /\$ne/, /\$gt/, /onclick/i, /onerror/i,
  /javascript:/i, /eval\(/i,
];

function isSuspiciousInput(name: string, email: string): boolean {
  const combined = `${name} ${email}`;
  return SUSPICIOUS_PATTERNS.some(p => p.test(combined));
}

function isAutoBlocked(ip: string): boolean {
  const until = autoBlockMap.get(ip);
  if (!until) return false;
  if (Date.now() > until) {
    autoBlockMap.delete(ip);
    return false;
  }
  return true;
}

function checkRateAndBlock(ip: string): 'ok' | 'limited' | 'blocked' {
  if (isAutoBlocked(ip)) return 'blocked';
  
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return 'ok';
  }
  entry.count++;
  if (entry.count > AUTO_BLOCK_THRESHOLD) {
    // Escalate to auto-block
    autoBlockMap.set(ip, now + AUTO_BLOCK_DURATION_MS);
    console.log(`[SECURITY] 🚫 Auto-blocked IP ${ip} for 24h (${entry.count} attempts in 1 min)`);
    return 'blocked';
  }
  if (entry.count > RATE_LIMIT_MAX) {
    return 'limited';
  }
  return 'ok';
}

function logAttack(ip: string, email: string, name: string, reason: string) {
  attackLog.push({ ip, email, name, time: Date.now() });
  // Keep log at max 200 entries
  if (attackLog.length > 200) attackLog.splice(0, attackLog.length - 200);
  console.log(`[SECURITY] ⚠️ ${reason} | IP: ${ip} | email: ${email} | name: ${name}`);
}

// ── Email Validation ──
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','tempail.com','dispostable.com',
  'maildrop.cc','10minutemail.com','trashmail.com','fakeinbox.com','mailnesia.com',
  'temp-mail.org','mohmal.com','getnada.com','emailondeck.com','burnermail.io',
  'test.io','example.com','test.com','mailtest.com',
]);

function isValidEmail(email: string): boolean {
  // Basic format check
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  // Block disposable email domains
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || DISPOSABLE_DOMAINS.has(domain)) return false;
  // Block extremely short or suspicious emails
  if (email.length < 6 || email.length > 100) return false;
  return true;
}

// ── Password Strength ──
function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (password.length > 128) return false;
  // At least one letter and one number
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return false;
  return true;
}

// ── Name Validation ──
function isValidName(name: string): boolean {
  if (name.length < 2 || name.length > 60) return false;
  // Allow Hebrew, English, spaces, hyphens, apostrophes
  if (!/^[\u0590-\u05FFa-zA-Z\s\-'\.]+$/.test(name)) return false;
  return true;
}

// ── Login Brute Force Protection ──
const loginRateMap = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_WINDOW = 5 * 60_000; // 5 minutes
const LOGIN_RATE_MAX = 10; // 10 login attempts per 5 min

function checkLoginRate(ip: string): boolean {
  const now = Date.now();
  const entry = loginRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    loginRateMap.set(ip, { count: 1, resetAt: now + LOGIN_RATE_WINDOW });
    return true;
  }
  entry.count++;
  if (entry.count > LOGIN_RATE_MAX) {
    autoBlockMap.set(ip, now + AUTO_BLOCK_DURATION_MS);
    logAttack(ip, '?', '?', `Login brute force — ${entry.count} attempts in 5 min`);
    return false;
  }
  return true;
}

// Register new user
authRoutes.post('/register', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const country = c.req.header('cf-ipcountry') || '??';

  // Check auto-block and rate limit
  const status = checkRateAndBlock(ip);
  if (status === 'blocked') {
    logAttack(ip, '?', '?', `Blocked IP tried to register (country: ${country})`);
    return c.json({ error: 'Access denied' }, 403);
  }
  if (status === 'limited') {
    logAttack(ip, '?', '?', `Rate limited (country: ${country})`);
    return c.json({ error: 'יותר מדי ניסיונות רישום. נסו שוב בעוד דקה.' }, 429);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    logAttack(ip, '?', '?', `Malformed JSON body (country: ${country})`);
    return c.json({ error: 'Invalid request body' }, 400);
  }
  
  const { email, password, name, phone, website } = body;

  // Honeypot — hidden field "website" should always be empty (bots fill it)
  if (website) {
    logAttack(ip, email || '?', name || '?', `Honeypot triggered (country: ${country})`);
    autoBlockMap.set(ip, Date.now() + AUTO_BLOCK_DURATION_MS);
    // Return success to fool the bot
    return c.json({ success: true, message: 'Registration successful' }, 201);
  }

  if (!email || !password || !name) {
    return c.json({ error: 'Email, password and name are required' }, 400);
  }

  // Check for suspicious input (XSS, injection attempts)
  if (isSuspiciousInput(name, email)) {
    logAttack(ip, email, name, `Suspicious input detected (country: ${country})`);
    autoBlockMap.set(ip, Date.now() + AUTO_BLOCK_DURATION_MS);
    return c.json({ error: 'Invalid input' }, 400);
  }

  // Block Tor / anonymous proxies (country code T1)
  if (country === 'T1') {
    logAttack(ip, email, name, 'Tor exit node registration attempt');
    autoBlockMap.set(ip, Date.now() + AUTO_BLOCK_DURATION_MS);
    return c.json({ error: 'Registration not available from this network' }, 403);
  }

  // Silent security checks — log & block without changing UX for real users
  if (!isValidEmail(email)) {
    logAttack(ip, email, name, `Invalid/disposable email (country: ${country})`);
    // Disposable domains get blocked, bad format falls through to normal DB error
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && DISPOSABLE_DOMAINS.has(domain)) {
      autoBlockMap.set(ip, Date.now() + AUTO_BLOCK_DURATION_MS);
      return c.json({ error: 'Unable to create account. Try a different email.' }, 400);
    }
  }

  // Name validation — only block clearly malicious, not strict format
  if (!isValidName(name)) {
    logAttack(ip, email, name, `Suspicious name format (country: ${country})`);
    // Don't block real users — only log
  }

  // Check if user exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();

  if (existing) {
    return c.json({ error: 'User already exists' }, 409);
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const userId = generateId();
  
  await c.env.DB.prepare(`
    INSERT INTO users (id, email, password_hash, name, phone, role)
    VALUES (?, ?, ?, ?, ?, 'student')
  `).bind(userId, email.toLowerCase(), passwordHash, name, phone || null).run();

  // Initialize gamification
  await c.env.DB.prepare(`
    INSERT INTO user_gamification (user_id, xp, level, streak_days)
    VALUES (?, 0, 1, 0)
  `).bind(userId).run();

  // Generate JWT
  const token = await generateToken(userId, email, 'student', c.env.JWT_SECRET);
  
  // Set cookie
  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/'
  });

  // Fire-and-forget: push to CRM + send email notification
  c.executionCtx.waitUntil(
    Promise.allSettled([
      pushToCRM({ name, email, phone }),
      notifyNewRegistration({ name, email, phone }),
    ])
  );

  return c.json({
    success: true,
    message: 'Registration successful',
    token,
    user: { id: userId, email, name, role: 'student' }
  }, 201);
});

// Security dashboard UI
authRoutes.get('/security', async (c) => {
  const html = SECURITY_DASHBOARD_HTML;
  return c.html(html);
});

// Security status endpoint (for monitoring)
authRoutes.get('/security-status', async (c) => {
  const authKey = c.req.header('x-security-key');
  if (authKey !== 'hai-tech-security-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.json({
    blockedIPs: Array.from(autoBlockMap.entries()).map(([ip, until]) => ({
      ip, until: new Date(until).toISOString(), remaining: Math.round((until - Date.now()) / 60000) + ' min'
    })),
    rateLimits: Array.from(rateLimitMap.entries()).map(([ip, data]) => ({
      ip, count: data.count, resetAt: new Date(data.resetAt).toISOString()
    })),
    recentAttacks: attackLog.slice(-20).reverse().map(a => ({
      ip: a.ip, email: a.email, name: a.name, time: new Date(a.time).toISOString()
    })),
    permanentBlocks: BLOCKED_IPS_LIST,
    stats: {
      totalBlocked: autoBlockMap.size + BLOCKED_IPS_LIST.length,
      totalAttackLogs: attackLog.length,
    }
  });
});

// Login
authRoutes.post('/login', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  
  // Login brute force protection
  if (!checkLoginRate(ip)) {
    return c.json({ error: 'Too many login attempts. Try again in 5 minutes.' }, 429);
  }

  const { email, password } = await c.req.json();
  
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, name, role FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first<{
    id: string;
    email: string;
    password_hash: string;
    name: string;
    role: string;
  }>();

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Generate JWT
  const token = await generateToken(user.id, user.email, user.role, c.env.JWT_SECRET);
  
  // Set cookie
  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/'
  });

  return c.json({
    success: true,
    message: 'Login successful',
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

// Get current user (me)
authRoutes.get('/me', async (c) => {
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const user = await c.env.DB.prepare(
      'SELECT id, email, name, role, phone FROM users WHERE id = ?'
    ).bind(payload.userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Logout
authRoutes.post('/logout', async (c) => {
  deleteCookie(c, 'auth_token', { path: '/' });
  return c.json({ message: 'Logged out successfully' });
});

// Update profile
authRoutes.put('/profile', async (c) => {
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    const { name, phone } = await c.req.json();

    await c.env.DB.prepare(`
      UPDATE users SET name = ?, phone = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `).bind(name, phone || null, payload.userId).run();

    return c.json({ message: 'Profile updated' });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Change password
authRoutes.put('/password', async (c) => {
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    const { currentPassword, newPassword } = await c.req.json();

    const user = await c.env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).bind(payload.userId).first<{ password_hash: string }>();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const validPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!validPassword) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }

    const newHash = await hashPassword(newPassword);
    await c.env.DB.prepare(`
      UPDATE users SET password_hash = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `).bind(newHash, payload.userId).run();

    return c.json({ message: 'Password changed successfully' });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Refresh token — accepts old token (even if nearly expired) and issues new 30-day one
authRoutes.post('/refresh', async (c) => {
  let token = getCookie(c, 'auth_token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  }
  if (!token) return c.json({ error: 'No token provided' }, 401);

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    const newToken = await generateToken(payload.userId, payload.email, payload.role, c.env.JWT_SECRET);
    setCookie(c, 'auth_token', newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    });
    return c.json({ success: true, token: newToken });
  } catch {
    return c.json({ error: 'טוקן לא תקין' }, 401);
  }
});

// Helper functions
async function generateToken(userId: string, email: string, role: string, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new jose.SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

async function verifyToken(token: string, secret: string): Promise<{ userId: string; email: string; role: string }> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, secretKey);
  return payload as { userId: string; email: string; role: string };
}

export { verifyToken };
