/**
 * Authentication Routes
 * Login, Register, Password Reset, Profile
 */

import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import * as jose from 'jose';
import { Env } from '../index';
import { hashPassword, verifyPassword, generateId } from '../utils/helpers';

export const authRoutes = new Hono<{ Bindings: Env }>();

// Register new user
authRoutes.post('/register', async (c) => {
  const { email, password, name, phone } = await c.req.json();
  
  if (!email || !password || !name) {
    return c.json({ error: 'Email, password and name are required' }, 400);
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
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });

  return c.json({
    message: 'Registration successful',
    user: { id: userId, email, name, role: 'student' }
  }, 201);
});

// Login
authRoutes.post('/login', async (c) => {
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
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  return c.json({
    message: 'Login successful',
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

// Helper functions
async function generateToken(userId: string, email: string, role: string, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new jose.SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

async function verifyToken(token: string, secret: string): Promise<{ userId: string; email: string; role: string }> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, secretKey);
  return payload as { userId: string; email: string; role: string };
}

export { verifyToken };
