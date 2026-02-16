/**
 * Courses Routes
 * List courses, get course details, lessons
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../index';
import { verifyToken } from './auth';

export const coursesRoutes = new Hono<{ Bindings: Env }>();

// Get all published courses (catalog view)
coursesRoutes.get('/', async (c) => {
  const courses = await c.env.DB.prepare(`
    SELECT id, title, description, image, price, lessons_count, 
           duration_hours, level, category
    FROM courses 
    WHERE is_published = 1
    ORDER BY created_at DESC
  `).all();

  return c.json({ courses: courses.results });
});

// Get user's enrolled courses only
coursesRoutes.get('/my/enrolled', async (c) => {
  // Accept token from cookie OR Authorization header
  let token = getCookie(c, 'auth_token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return c.json({ courses: [] });
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const courses = await c.env.DB.prepare(`
      SELECT c.id, c.title, c.description, c.image, c.price, c.lessons_count, 
             c.duration_hours, c.level, c.category, e.enrolled_at
      FROM courses c
      JOIN enrollments e ON c.id = e.course_id
      WHERE e.user_id = ? AND e.status = 'active' AND c.is_published = 1
      ORDER BY e.enrolled_at DESC
    `).bind(payload.userId).all();

    return c.json({ courses: courses.results });
  } catch (err) {
    return c.json({ courses: [] });
  }
});

// Get course by ID with lessons
coursesRoutes.get('/:courseId', async (c) => {
  const { courseId } = c.req.param();
  
  // Accept token from cookie OR Authorization header
  let token = getCookie(c, 'auth_token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }
  
  const course = await c.env.DB.prepare(`
    SELECT * FROM courses WHERE id = ?
  `).bind(courseId).first();

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  // Check if user is enrolled
  let isEnrolled = false;
  if (token) {
    try {
      const payload = await verifyToken(token, c.env.JWT_SECRET);
      const enrollment = await c.env.DB.prepare(`
        SELECT id FROM enrollments 
        WHERE user_id = ? AND course_id = ? AND status = 'active'
      `).bind(payload.userId, courseId).first();
      isEnrolled = !!enrollment;
    } catch (err) {}
  }

  const lessons = await c.env.DB.prepare(`
    SELECT id, title, description, video_url, duration_seconds, lesson_order, is_free
    FROM lessons 
    WHERE course_id = ?
    ORDER BY lesson_order ASC
  `).bind(courseId).all();

  // Filter video URLs: show only for first lesson or if enrolled
  const filteredLessons = (lessons.results as any[]).map(lesson => {
    const hasAccess = isEnrolled || lesson.is_free === 1 || lesson.lesson_order === 1;
    if (!hasAccess) {
      const { video_url, ...publicLesson } = lesson;
      return { ...publicLesson, locked: true };
    }
    return lesson;
  });

  return c.json({ 
    course,
    lessons: filteredLessons,
    isEnrolled
  });
});

// Get lesson by ID (with video URL if enrolled)
coursesRoutes.get('/:courseId/lessons/:lessonId', async (c) => {
  const { courseId, lessonId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  const lesson = await c.env.DB.prepare(`
    SELECT l.*, c.title as course_title
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
    WHERE l.id = ? AND l.course_id = ?
  `).bind(lessonId, courseId).first();

  if (!lesson) {
    return c.json({ error: 'Lesson not found' }, 404);
  }

  // Check if lesson is free (is_free flag OR first lesson) or user is enrolled
  const lessonData = lesson as any;
  let hasAccess = lessonData.is_free === 1 || lessonData.lesson_order === 1;
  
  if (!hasAccess && token) {
    try {
      const payload = await verifyToken(token, c.env.JWT_SECRET);
      
      const enrollment = await c.env.DB.prepare(`
        SELECT id FROM enrollments 
        WHERE user_id = ? AND course_id = ? AND status = 'active'
      `).bind(payload.userId, courseId).first();
      
      hasAccess = !!enrollment;
    } catch (err) {
      // Invalid token, no access
    }
  }

  if (!hasAccess) {
    // Return lesson info without video URL
    const { video_url, ...publicLesson } = lesson as any;
    return c.json({ lesson: publicLesson, hasAccess: false });
  }

  return c.json({ lesson, hasAccess: true });
});

// Get user's enrolled courses
coursesRoutes.get('/enrolled/me', async (c) => {
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const enrollments = await c.env.DB.prepare(`
      SELECT c.*, e.enrolled_at, e.status,
             (SELECT COUNT(*) FROM progress p 
              WHERE p.user_id = ? AND p.course_id = c.id AND p.completed = 1) as completed_lessons
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ? AND e.status = 'active'
      ORDER BY e.enrolled_at DESC
    `).bind(payload.userId, payload.userId).all();

    return c.json({ courses: enrollments.results });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Enroll in a course (for free courses or after payment)
coursesRoutes.post('/:courseId/enroll', async (c) => {
  const { courseId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    // Check if already enrolled
    const existing = await c.env.DB.prepare(`
      SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?
    `).bind(payload.userId, courseId).first();

    if (existing) {
      return c.json({ error: 'Already enrolled' }, 409);
    }

    // Check if course exists and is free
    const course = await c.env.DB.prepare(`
      SELECT id, price FROM courses WHERE id = ? AND is_published = 1
    `).bind(courseId).first<{ id: string; price: number }>();

    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }

    // For now, only allow free courses (price = 0)
    if (course.price > 0) {
      return c.json({ error: 'Payment required for this course' }, 402);
    }

    // Create enrollment
    const enrollmentId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO enrollments (id, user_id, course_id, status)
      VALUES (?, ?, ?, 'active')
    `).bind(enrollmentId, payload.userId, courseId).run();

    return c.json({ message: 'Enrolled successfully', enrollmentId }, 201);
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
