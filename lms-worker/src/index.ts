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

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
