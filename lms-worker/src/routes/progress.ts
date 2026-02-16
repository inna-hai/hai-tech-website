/**
 * Progress Routes
 * Track lesson progress, video watch time, course completion
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../index';
import { verifyToken } from './auth';

export const progressRoutes = new Hono<{ Bindings: Env }>();

// Get progress for a course
progressRoutes.get('/course/:courseId', async (c) => {
  const { courseId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const progress = await c.env.DB.prepare(`
      SELECT p.*, l.title as lesson_title, l.duration_seconds
      FROM progress p
      JOIN lessons l ON p.lesson_id = l.id
      WHERE p.user_id = ? AND p.course_id = ?
      ORDER BY l.lesson_order ASC
    `).bind(payload.userId, courseId).all();

    // Calculate overall progress
    const totalLessons = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM lessons WHERE course_id = ?
    `).bind(courseId).first<{ count: number }>();

    const completedLessons = progress.results.filter((p: any) => p.completed === 1).length;
    const percentage = totalLessons?.count 
      ? Math.round((completedLessons / totalLessons.count) * 100)
      : 0;

    return c.json({
      progress: progress.results,
      summary: {
        totalLessons: totalLessons?.count || 0,
        completedLessons,
        percentage
      }
    });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Update lesson progress (watch time)
progressRoutes.post('/lesson/:lessonId', async (c) => {
  const { lessonId } = c.req.param();
  // Accept token from cookie OR Authorization header
  let token = getCookie(c, 'auth_token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }
  const { watchedSeconds, completed } = await c.req.json();
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    // Get lesson info
    const lesson = await c.env.DB.prepare(`
      SELECT id, course_id, duration_seconds, lesson_order FROM lessons WHERE id = ?
    `).bind(lessonId).first<{ id: string; course_id: string; duration_seconds: number; lesson_order: number }>();

    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    // Check enrollment - must be enrolled to track progress
    const enrollment = await c.env.DB.prepare(`
      SELECT id FROM enrollments 
      WHERE user_id = ? AND course_id = ? AND status = 'active'
    `).bind(payload.userId, lesson.course_id).first();

    // Allow progress only for first lesson (free) or if enrolled
    const isFirstLesson = lesson.lesson_order === 1;
    if (!enrollment && !isFirstLesson) {
      return c.json({ error: 'Not enrolled in this course' }, 403);
    }

    // Check if progress exists
    const existing = await c.env.DB.prepare(`
      SELECT id, watched_seconds, completed FROM progress 
      WHERE user_id = ? AND lesson_id = ?
    `).bind(payload.userId, lessonId).first<{ id: string; watched_seconds: number; completed: number }>();

    const isCompleted = completed || (watchedSeconds >= lesson.duration_seconds * 0.9);
    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      // Update existing progress
      const newWatched = Math.max(existing.watched_seconds, watchedSeconds || 0);
      const nowCompleted = existing.completed === 1 || isCompleted;
      
      await c.env.DB.prepare(`
        UPDATE progress 
        SET watched_seconds = ?, completed = ?, last_watched_at = ?,
            completed_at = CASE WHEN ? = 1 AND completed_at IS NULL THEN ? ELSE completed_at END
        WHERE id = ?
      `).bind(newWatched, nowCompleted ? 1 : 0, now, nowCompleted ? 1 : 0, now, existing.id).run();

      // Award XP if newly completed
      if (!existing.completed && nowCompleted) {
        await awardLessonXP(c.env.DB, payload.userId, lessonId, lesson.course_id);
      }

      return c.json({ 
        message: 'Progress updated',
        completed: nowCompleted,
        watchedSeconds: newWatched
      });
    } else {
      // Create new progress
      const progressId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO progress (id, user_id, lesson_id, course_id, watched_seconds, completed, completed_at, last_watched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        progressId, 
        payload.userId, 
        lessonId, 
        lesson.course_id, 
        watchedSeconds || 0, 
        isCompleted ? 1 : 0,
        isCompleted ? now : null,
        now
      ).run();

      // Award XP if completed
      if (isCompleted) {
        await awardLessonXP(c.env.DB, payload.userId, lessonId, lesson.course_id);
      }

      return c.json({ 
        message: 'Progress created',
        completed: isCompleted,
        watchedSeconds: watchedSeconds || 0
      }, 201);
    }
  } catch (err) {
    console.error('Progress error:', err);
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Mark lesson as complete
progressRoutes.post('/lesson/:lessonId/complete', async (c) => {
  const { lessonId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const lesson = await c.env.DB.prepare(`
      SELECT id, course_id, duration_seconds FROM lessons WHERE id = ?
    `).bind(lessonId).first<{ id: string; course_id: string; duration_seconds: number }>();

    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(`
      INSERT INTO progress (id, user_id, lesson_id, course_id, watched_seconds, completed, completed_at, last_watched_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, lesson_id) 
      DO UPDATE SET completed = 1, completed_at = COALESCE(completed_at, ?), last_watched_at = ?
    `).bind(
      crypto.randomUUID(),
      payload.userId,
      lessonId,
      lesson.course_id,
      lesson.duration_seconds,
      now,
      now,
      now,
      now
    ).run();

    await awardLessonXP(c.env.DB, payload.userId, lessonId, lesson.course_id);

    return c.json({ message: 'Lesson marked as complete' });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Helper: Award XP for completing a lesson
async function awardLessonXP(db: D1Database, userId: string, lessonId: string, courseId: string) {
  const XP_PER_LESSON = 25;
  
  // Check if XP already awarded
  const existing = await db.prepare(`
    SELECT id FROM xp_transactions 
    WHERE user_id = ? AND reference_type = 'lesson' AND reference_id = ?
  `).bind(userId, lessonId).first();

  if (existing) return;

  // Award XP
  await db.prepare(`
    INSERT INTO xp_transactions (id, user_id, xp_amount, reason, reference_type, reference_id)
    VALUES (?, ?, ?, 'Lesson completed', 'lesson', ?)
  `).bind(crypto.randomUUID(), userId, XP_PER_LESSON, lessonId).run();

  // Update user gamification
  await db.prepare(`
    UPDATE user_gamification 
    SET xp = xp + ?, 
        total_lessons_completed = total_lessons_completed + 1,
        last_activity_date = date('now')
    WHERE user_id = ?
  `).bind(XP_PER_LESSON, userId).run();

  // Log activity
  await db.prepare(`
    INSERT INTO activity_log (id, user_id, activity_type, reference_type, reference_id, xp_earned)
    VALUES (?, ?, 'lesson_complete', 'lesson', ?, ?)
  `).bind(crypto.randomUUID(), userId, lessonId, XP_PER_LESSON).run();
}
