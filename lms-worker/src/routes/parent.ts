/**
 * Parent Routes
 * Parent dashboard, link to children, view progress
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../index';
import { verifyToken } from './auth';
import { generateToken as generateRandomToken } from '../utils/helpers';

export const parentRoutes = new Hono<{ Bindings: Env }>();

// Create invite link for parent
parentRoutes.post('/invite', async (c) => {
  const token = getCookie(c, 'auth_token');
  const { parentEmail } = await c.req.json();
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    // Generate invite token
    const inviteToken = generateRandomToken(32);
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
    
    await c.env.DB.prepare(`
      INSERT INTO parent_invites (id, child_user_id, invite_token, parent_email, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      payload.userId,
      inviteToken,
      parentEmail || null,
      expiresAt
    ).run();

    const inviteUrl = `https://hai.tech/lms/parent-link?token=${inviteToken}`;

    return c.json({ 
      inviteUrl,
      inviteToken,
      expiresAt: new Date(expiresAt * 1000).toISOString()
    });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Accept parent invite (link parent to child)
parentRoutes.post('/accept-invite', async (c) => {
  const token = getCookie(c, 'auth_token');
  const { inviteToken } = await c.req.json();
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  if (!inviteToken) {
    return c.json({ error: 'Invite token required' }, 400);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    // Find invite
    const invite = await c.env.DB.prepare(`
      SELECT * FROM parent_invites 
      WHERE invite_token = ? AND used_at IS NULL AND expires_at > ?
    `).bind(inviteToken, Math.floor(Date.now() / 1000)).first<any>();

    if (!invite) {
      return c.json({ error: 'Invalid or expired invite' }, 400);
    }

    // Check not linking to self
    if (invite.child_user_id === payload.userId) {
      return c.json({ error: 'Cannot link to yourself' }, 400);
    }

    // Create link
    await c.env.DB.prepare(`
      INSERT INTO parent_child_links (id, parent_user_id, child_user_id)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), payload.userId, invite.child_user_id).run();

    // Mark invite as used
    await c.env.DB.prepare(`
      UPDATE parent_invites 
      SET used_at = ?, used_by_user_id = ?
      WHERE id = ?
    `).bind(Math.floor(Date.now() / 1000), payload.userId, invite.id).run();

    // Update parent role
    await c.env.DB.prepare(`
      UPDATE users SET role = 'parent' WHERE id = ? AND role = 'student'
    `).bind(payload.userId).run();

    return c.json({ message: 'Link created successfully' });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Get linked children (for parent)
parentRoutes.get('/children', async (c) => {
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const children = await c.env.DB.prepare(`
      SELECT u.id, u.name, u.email, l.linked_at,
             g.xp, g.level, g.streak_days, g.total_lessons_completed
      FROM parent_child_links l
      JOIN users u ON l.child_user_id = u.id
      LEFT JOIN user_gamification g ON u.id = g.user_id
      WHERE l.parent_user_id = ?
    `).bind(payload.userId).all();

    return c.json({ children: children.results });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Get child's detailed progress (for parent)
parentRoutes.get('/child/:childId/progress', async (c) => {
  const { childId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    // Verify parent-child link
    const link = await c.env.DB.prepare(`
      SELECT id FROM parent_child_links 
      WHERE parent_user_id = ? AND child_user_id = ?
    `).bind(payload.userId, childId).first();

    if (!link) {
      return c.json({ error: 'Not authorized to view this child' }, 403);
    }

    // Get child info
    const child = await c.env.DB.prepare(`
      SELECT u.name, u.email, g.*
      FROM users u
      LEFT JOIN user_gamification g ON u.id = g.user_id
      WHERE u.id = ?
    `).bind(childId).first();

    // Get enrolled courses with progress
    const courses = await c.env.DB.prepare(`
      SELECT c.id, c.title, c.lessons_count,
             e.enrolled_at,
             (SELECT COUNT(*) FROM progress p 
              WHERE p.user_id = ? AND p.course_id = c.id AND p.completed = 1) as completed_lessons
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ?
    `).bind(childId, childId).all();

    // Get recent activity
    const recentActivity = await c.env.DB.prepare(`
      SELECT activity_type, reference_type, xp_earned, created_at
      FROM activity_log
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(childId).all();

    // Get recent quiz results
    const quizResults = await c.env.DB.prepare(`
      SELECT r.score, r.max_score, r.passed, r.completed_at, q.title
      FROM quiz_results r
      JOIN quizzes q ON r.quiz_id = q.id
      WHERE r.user_id = ?
      ORDER BY r.completed_at DESC
      LIMIT 5
    `).bind(childId).all();

    return c.json({
      child,
      courses: courses.results,
      recentActivity: recentActivity.results,
      recentQuizzes: quizResults.results
    });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Remove parent-child link
parentRoutes.delete('/child/:childId', async (c) => {
  const { childId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    await c.env.DB.prepare(`
      DELETE FROM parent_child_links 
      WHERE parent_user_id = ? AND child_user_id = ?
    `).bind(payload.userId, childId).run();

    return c.json({ message: 'Link removed' });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
