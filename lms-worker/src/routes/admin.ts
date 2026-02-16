/**
 * Admin Routes
 * User management, course management, analytics
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../index';
import { verifyToken } from './auth';

export const adminRoutes = new Hono<{ Bindings: Env }>();

// Middleware: Check admin role
const requireAdmin = async (c: any, next: any) => {
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const user = await c.env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(payload.userId).first<{ role: string }>();

    if (!user || user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    c.set('userId', payload.userId);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

// Apply admin middleware to all routes
adminRoutes.use('*', requireAdmin);

// Get all users
adminRoutes.get('/users', async (c) => {
  const search = c.req.query('search');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  let query = `
    SELECT u.id, u.email, u.name, u.role, u.created_at,
           g.xp, g.level, g.total_lessons_completed
    FROM users u
    LEFT JOIN user_gamification g ON u.id = g.user_id
  `;

  const bindings: any[] = [];
  
  if (search) {
    query += ` WHERE u.name LIKE ? OR u.email LIKE ?`;
    bindings.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
  bindings.push(limit, offset);

  const users = await c.env.DB.prepare(query).bind(...bindings).all();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as count FROM users';
  if (search) {
    countQuery += ` WHERE name LIKE ? OR email LIKE ?`;
  }
  const total = await c.env.DB.prepare(countQuery)
    .bind(...(search ? [`%${search}%`, `%${search}%`] : []))
    .first<{ count: number }>();

  return c.json({
    users: users.results,
    total: total?.count || 0,
    limit,
    offset
  });
});

// Update user role
adminRoutes.put('/users/:userId/role', async (c) => {
  const { userId } = c.req.param();
  const { role } = await c.req.json();

  if (!['student', 'parent', 'admin'].includes(role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE users SET role = ?, updated_at = strftime('%s', 'now')
    WHERE id = ?
  `).bind(role, userId).run();

  return c.json({ message: 'Role updated' });
});

// Delete user
adminRoutes.delete('/users/:userId', async (c) => {
  const { userId } = c.req.param();
  const adminId = c.get('userId');

  if (userId === adminId) {
    return c.json({ error: 'Cannot delete yourself' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

  return c.json({ message: 'User deleted' });
});

// Get all courses (including unpublished)
adminRoutes.get('/courses', async (c) => {
  const courses = await c.env.DB.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrollment_count,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as actual_lessons
    FROM courses c
    ORDER BY c.created_at DESC
  `).all();

  return c.json({ courses: courses.results });
});

// Create course
adminRoutes.post('/courses', async (c) => {
  const data = await c.req.json();
  const courseId = crypto.randomUUID();

  await c.env.DB.prepare(`
    INSERT INTO courses (id, title, description, image, price, lessons_count, duration_hours, level, category, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    courseId,
    data.title,
    data.description || null,
    data.image || null,
    data.price || 0,
    data.lessons_count || 0,
    data.duration_hours || 0,
    data.level || 'beginner',
    data.category || null,
    data.is_published ? 1 : 0
  ).run();

  return c.json({ message: 'Course created', courseId }, 201);
});

// Update course
adminRoutes.put('/courses/:courseId', async (c) => {
  const { courseId } = c.req.param();
  const data = await c.req.json();

  await c.env.DB.prepare(`
    UPDATE courses 
    SET title = ?, description = ?, image = ?, price = ?, 
        lessons_count = ?, duration_hours = ?, level = ?, 
        category = ?, is_published = ?, updated_at = strftime('%s', 'now')
    WHERE id = ?
  `).bind(
    data.title,
    data.description || null,
    data.image || null,
    data.price || 0,
    data.lessons_count || 0,
    data.duration_hours || 0,
    data.level || 'beginner',
    data.category || null,
    data.is_published ? 1 : 0,
    courseId
  ).run();

  return c.json({ message: 'Course updated' });
});

// Delete course
adminRoutes.delete('/courses/:courseId', async (c) => {
  const { courseId } = c.req.param();
  
  await c.env.DB.prepare('DELETE FROM courses WHERE id = ?').bind(courseId).run();

  return c.json({ message: 'Course deleted' });
});

// Create lesson
adminRoutes.post('/courses/:courseId/lessons', async (c) => {
  const { courseId } = c.req.param();
  const data = await c.req.json();
  const lessonId = crypto.randomUUID();

  // Get next lesson order
  const lastLesson = await c.env.DB.prepare(`
    SELECT MAX(lesson_order) as max_order FROM lessons WHERE course_id = ?
  `).bind(courseId).first<{ max_order: number | null }>();

  const lessonOrder = (lastLesson?.max_order || 0) + 1;

  await c.env.DB.prepare(`
    INSERT INTO lessons (id, course_id, title, description, video_url, duration_seconds, lesson_order, is_free, resources)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    lessonId,
    courseId,
    data.title,
    data.description || null,
    data.video_url || null,
    data.duration_seconds || 0,
    data.lesson_order || lessonOrder,
    data.is_free ? 1 : 0,
    data.resources ? JSON.stringify(data.resources) : null
  ).run();

  // Update course lessons count
  await c.env.DB.prepare(`
    UPDATE courses SET lessons_count = (SELECT COUNT(*) FROM lessons WHERE course_id = ?)
    WHERE id = ?
  `).bind(courseId, courseId).run();

  return c.json({ message: 'Lesson created', lessonId }, 201);
});

// Get analytics dashboard
adminRoutes.get('/analytics', async (c) => {
  // Total users
  const totalUsers = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM users'
  ).first<{ count: number }>();

  // New users this week
  const weekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
  const newUsersWeek = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM users WHERE created_at > ?'
  ).bind(weekAgo).first<{ count: number }>();

  // Total enrollments
  const totalEnrollments = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM enrollments'
  ).first<{ count: number }>();

  // Lessons completed today
  const today = new Date().toISOString().split('T')[0];
  const lessonsToday = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM progress 
    WHERE completed = 1 AND date(completed_at, 'unixepoch') = ?
  `).bind(today).first<{ count: number }>();

  // Top courses by enrollment
  const topCourses = await c.env.DB.prepare(`
    SELECT c.title, COUNT(e.id) as enrollments
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id
    GROUP BY c.id
    ORDER BY enrollments DESC
    LIMIT 5
  `).all();

  return c.json({
    totalUsers: totalUsers?.count || 0,
    newUsersThisWeek: newUsersWeek?.count || 0,
    totalEnrollments: totalEnrollments?.count || 0,
    lessonsCompletedToday: lessonsToday?.count || 0,
    topCourses: topCourses.results
  });
});
