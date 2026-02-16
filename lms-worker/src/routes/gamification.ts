/**
 * Gamification Routes
 * XP, Levels, Badges, Streaks, Leaderboard
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../index';
import { verifyToken } from './auth';
import { calculateLevel, xpToNextLevel } from '../utils/helpers';

export const gamificationRoutes = new Hono<{ Bindings: Env }>();

// Badge definitions
const BADGES = [
  { id: 'first-lesson', name: 'צעד ראשון', description: 'השלמת שיעור ראשון', icon: '🎯', xp_requirement: null },
  { id: 'five-lessons', name: 'תלמיד חרוץ', description: 'השלמת 5 שיעורים', icon: '📚', xp_requirement: null },
  { id: 'first-quiz', name: 'בוחן ראשון', description: 'עברת קוויז ראשון', icon: '✅', xp_requirement: null },
  { id: 'streak-3', name: 'רצף של 3', description: '3 ימים רצופים של למידה', icon: '🔥', xp_requirement: null },
  { id: 'streak-7', name: 'שבוע של הצלחה', description: 'שבוע רצוף של למידה', icon: '⭐', xp_requirement: null },
  { id: 'level-5', name: 'מתקדם', description: 'הגעת לרמה 5', icon: '🏆', xp_requirement: 1000 },
  { id: 'level-10', name: 'מומחה', description: 'הגעת לרמה 10', icon: '👑', xp_requirement: 4500 },
  { id: 'first-course', name: 'סיימת קורס!', description: 'השלמת קורס שלם', icon: '🎓', xp_requirement: null },
];

// Get user's gamification stats
gamificationRoutes.get('/stats', async (c) => {
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    let stats = await c.env.DB.prepare(`
      SELECT * FROM user_gamification WHERE user_id = ?
    `).bind(payload.userId).first<any>();

    if (!stats) {
      // Initialize if not exists
      await c.env.DB.prepare(`
        INSERT INTO user_gamification (user_id, xp, level, streak_days)
        VALUES (?, 0, 1, 0)
      `).bind(payload.userId).run();
      
      stats = { xp: 0, level: 1, streak_days: 0, total_lessons_completed: 0, total_quizzes_passed: 0 };
    }

    const level = calculateLevel(stats.xp);
    const nextLevel = xpToNextLevel(stats.xp);

    // Get badges
    const badges = await c.env.DB.prepare(`
      SELECT badge_id, earned_at FROM user_badges WHERE user_id = ?
    `).bind(payload.userId).all();

    const earnedBadgeIds = badges.results.map((b: any) => b.badge_id);
    const badgesWithStatus = BADGES.map(badge => ({
      ...badge,
      earned: earnedBadgeIds.includes(badge.id),
      earned_at: badges.results.find((b: any) => b.badge_id === badge.id)?.earned_at
    }));

    return c.json({
      xp: stats.xp,
      level,
      nextLevel,
      streak: stats.streak_days,
      totalLessonsCompleted: stats.total_lessons_completed,
      totalQuizzesPassed: stats.total_quizzes_passed,
      badges: badgesWithStatus
    });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Get XP history
gamificationRoutes.get('/xp-history', async (c) => {
  const token = getCookie(c, 'auth_token');
  const limit = parseInt(c.req.query('limit') || '20');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const history = await c.env.DB.prepare(`
      SELECT xp_amount, reason, reference_type, created_at
      FROM xp_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(payload.userId, limit).all();

    return c.json({ history: history.results });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Get leaderboard
gamificationRoutes.get('/leaderboard', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const token = getCookie(c, 'auth_token');
  
  const leaderboard = await c.env.DB.prepare(`
    SELECT u.name, g.xp, g.level, g.streak_days
    FROM user_gamification g
    JOIN users u ON g.user_id = u.id
    ORDER BY g.xp DESC
    LIMIT ?
  `).bind(limit).all();

  let userRank = null;
  if (token) {
    try {
      const payload = await verifyToken(token, c.env.JWT_SECRET);
      
      const rank = await c.env.DB.prepare(`
        SELECT COUNT(*) + 1 as rank
        FROM user_gamification g2
        WHERE g2.xp > (SELECT xp FROM user_gamification WHERE user_id = ?)
      `).bind(payload.userId).first<{ rank: number }>();
      
      userRank = rank?.rank;
    } catch (err) {
      // Ignore - user not logged in
    }
  }

  return c.json({
    leaderboard: leaderboard.results,
    userRank
  });
});

// Get activity feed
gamificationRoutes.get('/activity', async (c) => {
  const token = getCookie(c, 'auth_token');
  const limit = parseInt(c.req.query('limit') || '10');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const activity = await c.env.DB.prepare(`
      SELECT activity_type, reference_type, reference_id, xp_earned, created_at
      FROM activity_log
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(payload.userId, limit).all();

    return c.json({ activity: activity.results });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Check and update streak
gamificationRoutes.post('/check-streak', async (c) => {
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const stats = await c.env.DB.prepare(`
      SELECT last_activity_date, streak_days FROM user_gamification WHERE user_id = ?
    `).bind(payload.userId).first<{ last_activity_date: string; streak_days: number }>();

    if (!stats) {
      return c.json({ streak: 0, updated: false });
    }

    const today = new Date().toISOString().split('T')[0];
    const lastActivity = stats.last_activity_date;

    if (lastActivity === today) {
      // Already logged today
      return c.json({ streak: stats.streak_days, updated: false });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = stats.streak_days;

    if (lastActivity === yesterday) {
      // Continue streak
      newStreak += 1;
    } else {
      // Reset streak
      newStreak = 1;
    }

    await c.env.DB.prepare(`
      UPDATE user_gamification 
      SET streak_days = ?, last_activity_date = ?
      WHERE user_id = ?
    `).bind(newStreak, today, payload.userId).run();

    // Check for streak badges
    if (newStreak === 3) {
      await awardBadge(c.env.DB, payload.userId, 'streak-3');
    } else if (newStreak === 7) {
      await awardBadge(c.env.DB, payload.userId, 'streak-7');
    }

    return c.json({ streak: newStreak, updated: true });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Helper: Award a badge
async function awardBadge(db: D1Database, userId: string, badgeId: string) {
  // Check if already has badge
  const existing = await db.prepare(`
    SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?
  `).bind(userId, badgeId).first();

  if (existing) return false;

  await db.prepare(`
    INSERT INTO user_badges (id, user_id, badge_id)
    VALUES (?, ?, ?)
  `).bind(crypto.randomUUID(), userId, badgeId).run();

  return true;
}
