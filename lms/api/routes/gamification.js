/**
 * Gamification System - HAI Tech Academy
 * XP, Levels, Badges, Streaks, Daily Challenges
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ==========================================
// Configuration
// ==========================================
const CONFIG = {
    // XP Rewards
    XP: {
        WATCH_LESSON: 10,
        COMPLETE_LESSON: 50,
        QUIZ_PASS: 100,        // 80%+
        QUIZ_PERFECT: 200,     // 100%
        STREAK_BONUS: 25,
        DAILY_CHALLENGE: 30,
        FIRST_LESSON_TODAY: 15,
        BADGE_EARNED: 50
    },
    
    // Levels
    LEVELS: [
        { level: 1, name: 'מתחיל', nameEn: 'Beginner', icon: '🌱', minXP: 0 },
        { level: 2, name: 'חוקר', nameEn: 'Explorer', icon: '🔍', minXP: 500 },
        { level: 3, name: 'מתכנת', nameEn: 'Coder', icon: '💻', minXP: 1500 },
        { level: 4, name: 'מומחה', nameEn: 'Expert', icon: '🚀', minXP: 3500 },
        { level: 5, name: 'מאסטר', nameEn: 'Master', icon: '👑', minXP: 7000 },
        { level: 6, name: 'אגדה', nameEn: 'Legend', icon: '⭐', minXP: 15000 }
    ],
    
    // Badges
    BADGES: {
        FIRST_LESSON: {
            id: 'first_lesson',
            name: 'צעד ראשון',
            description: 'השלמת את השיעור הראשון שלך!',
            icon: '👶',
            xpReward: 50
        },
        FIRST_COURSE: {
            id: 'first_course',
            name: 'סיימתי קורס!',
            description: 'השלמת קורס שלם',
            icon: '🎓',
            xpReward: 200
        },
        STREAK_7: {
            id: 'streak_7',
            name: 'שבוע רצוף',
            description: '7 ימים רצופים של למידה',
            icon: '🔥',
            xpReward: 100
        },
        STREAK_30: {
            id: 'streak_30',
            name: 'חודש רצוף',
            description: '30 ימים רצופים של למידה!',
            icon: '🏆',
            xpReward: 500
        },
        PERFECT_QUIZ: {
            id: 'perfect_quiz',
            name: 'מושלם!',
            description: 'קיבלת 100% בקוויז',
            icon: '💯',
            xpReward: 50
        },
        FIVE_PERFECT: {
            id: 'five_perfect',
            name: 'מדויק',
            description: '5 קוויזים עם 100%',
            icon: '🎯',
            xpReward: 150
        },
        NIGHT_OWL: {
            id: 'night_owl',
            name: 'ינשוף לילה',
            description: 'למדת אחרי 21:00',
            icon: '🦉',
            xpReward: 30
        },
        EARLY_BIRD: {
            id: 'early_bird',
            name: 'ציפור מוקדמת',
            description: 'למדת לפני 8:00 בבוקר',
            icon: '🌅',
            xpReward: 30
        },
        RISING_STAR: {
            id: 'rising_star',
            name: 'כוכב עולה',
            description: '3 שיעורים ביום אחד',
            icon: '🌟',
            xpReward: 75
        },
        BOOKWORM: {
            id: 'bookworm',
            name: 'תולעת ספרים',
            description: '50 שיעורים הושלמו',
            icon: '📚',
            xpReward: 300
        },
        SPEEDSTER: {
            id: 'speedster',
            name: 'מהיר כברק',
            description: 'סיימת קורס תוך שבוע',
            icon: '⚡',
            xpReward: 200
        }
    },
    
    // Daily Challenges
    DAILY_CHALLENGES: [
        { id: 'watch_one', name: 'צפה בשיעור', description: 'צפה בשיעור אחד היום', type: 'lesson', target: 1, xp: 20 },
        { id: 'watch_three', name: 'למד 3 שיעורים', description: 'צפה ב-3 שיעורים היום', type: 'lesson', target: 3, xp: 50 },
        { id: 'take_quiz', name: 'עשה קוויז', description: 'השלם קוויז אחד', type: 'quiz', target: 1, xp: 30 },
        { id: 'perfect_quiz', name: 'קוויז מושלם', description: 'קבל 100% בקוויז', type: 'perfect_quiz', target: 1, xp: 75 },
        { id: 'study_15', name: '15 דקות למידה', description: 'למד לפחות 15 דקות', type: 'time', target: 15, xp: 25 }
    ]
};

// ==========================================
// Database Initialization
// ==========================================
function initGamificationTables() {
    // User gamification stats
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_gamification (
            user_id TEXT PRIMARY KEY,
            total_xp INTEGER DEFAULT 0,
            current_level INTEGER DEFAULT 1,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_activity_date TEXT,
            streak_shield INTEGER DEFAULT 0,
            total_lessons_completed INTEGER DEFAULT 0,
            total_quizzes_completed INTEGER DEFAULT 0,
            total_perfect_quizzes INTEGER DEFAULT 0,
            total_study_time_minutes INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // User badges
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_badges (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            badge_id TEXT NOT NULL,
            earned_at INTEGER DEFAULT (strftime('%s', 'now')),
            UNIQUE(user_id, badge_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // XP transactions (history)
    db.exec(`
        CREATE TABLE IF NOT EXISTS xp_transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            amount INTEGER NOT NULL,
            reason TEXT NOT NULL,
            details TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Daily challenges progress
    db.exec(`
        CREATE TABLE IF NOT EXISTS daily_challenges (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            challenge_id TEXT NOT NULL,
            date TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            UNIQUE(user_id, challenge_id, date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Activity log (for streaks and time tracking)
    db.exec(`
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            activity_data TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
        CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_date ON daily_challenges(user_id, date);
        CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
    `);

    console.log('✅ Gamification tables initialized');
}

// Initialize tables on load
try {
    initGamificationTables();
} catch (e) {
    console.error('Failed to init gamification tables:', e);
}

// ==========================================
// Helper Functions
// ==========================================

function getUserStats(userId) {
    let stats = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(userId);
    
    if (!stats) {
        // Create new record
        db.prepare(`
            INSERT INTO user_gamification (user_id) VALUES (?)
        `).run(userId);
        stats = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(userId);
    }
    
    return stats;
}

function getLevelInfo(xp) {
    let currentLevel = CONFIG.LEVELS[0];
    let nextLevel = CONFIG.LEVELS[1];
    
    for (let i = CONFIG.LEVELS.length - 1; i >= 0; i--) {
        if (xp >= CONFIG.LEVELS[i].minXP) {
            currentLevel = CONFIG.LEVELS[i];
            nextLevel = CONFIG.LEVELS[i + 1] || null;
            break;
        }
    }
    
    const progress = nextLevel 
        ? ((xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100
        : 100;
    
    return {
        current: currentLevel,
        next: nextLevel,
        progress: Math.min(100, Math.round(progress)),
        xpToNext: nextLevel ? nextLevel.minXP - xp : 0
    };
}

function addXP(userId, amount, reason, details = null) {
    // Add XP transaction
    db.prepare(`
        INSERT INTO xp_transactions (id, user_id, amount, reason, details)
        VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, amount, reason, details);
    
    // Update user stats
    const stats = getUserStats(userId);
    const newXP = stats.total_xp + amount;
    const newLevel = getLevelInfo(newXP).current.level;
    
    db.prepare(`
        UPDATE user_gamification 
        SET total_xp = ?, current_level = ?, updated_at = strftime('%s', 'now')
        WHERE user_id = ?
    `).run(newXP, newLevel, userId);
    
    return { newXP, newLevel, leveledUp: newLevel > stats.current_level };
}

function awardBadge(userId, badgeId) {
    const badge = CONFIG.BADGES[badgeId];
    if (!badge) return null;
    
    // Check if already has badge
    const existing = db.prepare(
        'SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?'
    ).get(userId, badge.id);
    
    if (existing) return null;
    
    // Award badge
    db.prepare(`
        INSERT INTO user_badges (id, user_id, badge_id)
        VALUES (?, ?, ?)
    `).run(uuidv4(), userId, badge.id);
    
    // Award XP for badge
    if (badge.xpReward) {
        addXP(userId, badge.xpReward, 'badge_earned', badge.id);
    }
    
    return badge;
}

function updateStreak(userId) {
    const stats = getUserStats(userId);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let newStreak = stats.current_streak;
    
    if (stats.last_activity_date === today) {
        // Already logged today
        return { streak: newStreak, isNew: false };
    }
    
    if (stats.last_activity_date === yesterday) {
        // Continue streak
        newStreak = stats.current_streak + 1;
    } else if (stats.last_activity_date && stats.streak_shield > 0) {
        // Use streak shield
        newStreak = stats.current_streak + 1;
        db.prepare('UPDATE user_gamification SET streak_shield = streak_shield - 1 WHERE user_id = ?').run(userId);
    } else {
        // Reset streak
        newStreak = 1;
    }
    
    const longestStreak = Math.max(newStreak, stats.longest_streak);
    
    db.prepare(`
        UPDATE user_gamification 
        SET current_streak = ?, longest_streak = ?, last_activity_date = ?, updated_at = strftime('%s', 'now')
        WHERE user_id = ?
    `).run(newStreak, longestStreak, today, userId);
    
    // Check streak badges
    if (newStreak === 7) awardBadge(userId, 'STREAK_7');
    if (newStreak === 30) awardBadge(userId, 'STREAK_30');
    
    // Streak bonus XP
    if (newStreak > 1) {
        addXP(userId, CONFIG.XP.STREAK_BONUS, 'streak_bonus', `Day ${newStreak}`);
    }
    
    return { streak: newStreak, isNew: true };
}

function checkTimeBadges(userId) {
    const hour = new Date().getHours();
    
    if (hour >= 21 || hour < 5) {
        awardBadge(userId, 'NIGHT_OWL');
    }
    if (hour >= 5 && hour < 8) {
        awardBadge(userId, 'EARLY_BIRD');
    }
}

function getTodaysChallenges(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    // Get 3 random challenges for today (deterministic based on date)
    const seed = parseInt(today.replace(/-/g, ''));
    const shuffled = [...CONFIG.DAILY_CHALLENGES].sort((a, b) => {
        return ((seed * a.id.charCodeAt(0)) % 100) - ((seed * b.id.charCodeAt(0)) % 100);
    });
    const todaysChallenges = shuffled.slice(0, 3);
    
    // Get progress
    return todaysChallenges.map(challenge => {
        const progress = db.prepare(`
            SELECT * FROM daily_challenges 
            WHERE user_id = ? AND challenge_id = ? AND date = ?
        `).get(userId, challenge.id, today);
        
        return {
            ...challenge,
            progress: progress?.progress || 0,
            completed: progress?.completed || false
        };
    });
}

// ==========================================
// API Endpoints
// ==========================================

/**
 * GET /api/gamification/stats
 * Get user's gamification stats
 */
router.get('/stats', optionalAuth, (req, res) => {
    try {
        // If not logged in, return demo stats
        if (!req.user) {
            return res.json({
                success: true,
                stats: {
                    totalXP: 150,
                    level: CONFIG.LEVELS[0],
                    nextLevel: CONFIG.LEVELS[1],
                    levelProgress: 30,
                    xpToNextLevel: 350,
                    currentStreak: 3,
                    longestStreak: 7,
                    streakShields: 1,
                    totalLessonsCompleted: 5,
                    totalQuizzesCompleted: 2,
                    totalPerfectQuizzes: 1,
                    totalStudyTimeMinutes: 45
                },
                badges: {
                    earned: [{ id: 'first_lesson', name: 'צעד ראשון', description: 'השלמת שיעור ראשון', icon: '👶' }],
                    available: Object.values(CONFIG.BADGES).slice(1, 5)
                },
                dailyChallenges: CONFIG.DAILY_CHALLENGES.slice(0, 3).map(c => ({ ...c, progress: 0, completed: false })),
                recentXP: []
            });
        }
        
        const userId = req.user.id;
        const stats = getUserStats(userId);
        const levelInfo = getLevelInfo(stats.total_xp);
        
        // Get badges
        const badges = db.prepare(`
            SELECT badge_id, earned_at FROM user_badges WHERE user_id = ?
        `).all(userId);
        
        const earnedBadges = badges.map(b => ({
            ...CONFIG.BADGES[Object.keys(CONFIG.BADGES).find(k => CONFIG.BADGES[k].id === b.badge_id)],
            earnedAt: b.earned_at
        })).filter(b => b);
        
        // Get today's challenges
        const dailyChallenges = getTodaysChallenges(userId);
        
        // Get recent XP history
        const recentXP = db.prepare(`
            SELECT * FROM xp_transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `).all(userId);
        
        res.json({
            success: true,
            stats: {
                totalXP: stats.total_xp,
                level: levelInfo.current,
                nextLevel: levelInfo.next,
                levelProgress: levelInfo.progress,
                xpToNextLevel: levelInfo.xpToNext,
                currentStreak: stats.current_streak,
                longestStreak: stats.longest_streak,
                streakShields: stats.streak_shield,
                totalLessonsCompleted: stats.total_lessons_completed,
                totalQuizzesCompleted: stats.total_quizzes_completed,
                totalPerfectQuizzes: stats.total_perfect_quizzes,
                totalStudyTimeMinutes: stats.total_study_time_minutes
            },
            badges: {
                earned: earnedBadges,
                available: Object.values(CONFIG.BADGES).filter(
                    b => !earnedBadges.find(eb => eb.id === b.id)
                )
            },
            dailyChallenges,
            recentXP
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: 'שגיאה בטעינת הנתונים' });
    }
});

/**
 * POST /api/gamification/lesson-complete
 * Called when a lesson is completed
 */
router.post('/lesson-complete', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { lessonId, courseId, watchTime } = req.body;
        
        const rewards = [];
        
        // Update streak
        const streakResult = updateStreak(userId);
        if (streakResult.isNew) {
            rewards.push({ type: 'streak', value: streakResult.streak });
        }
        
        // Add XP for completion
        const xpResult = addXP(userId, CONFIG.XP.COMPLETE_LESSON, 'lesson_complete', lessonId);
        rewards.push({ type: 'xp', value: CONFIG.XP.COMPLETE_LESSON, reason: 'השלמת שיעור' });
        
        if (xpResult.leveledUp) {
            rewards.push({ type: 'level_up', value: xpResult.newLevel });
        }
        
        // Update stats
        db.prepare(`
            UPDATE user_gamification 
            SET total_lessons_completed = total_lessons_completed + 1,
                total_study_time_minutes = total_study_time_minutes + ?
            WHERE user_id = ?
        `).run(Math.round((watchTime || 0) / 60), userId);
        
        // Check badges
        const stats = getUserStats(userId);
        
        if (stats.total_lessons_completed === 1) {
            const badge = awardBadge(userId, 'FIRST_LESSON');
            if (badge) rewards.push({ type: 'badge', value: badge });
        }
        
        if (stats.total_lessons_completed === 50) {
            const badge = awardBadge(userId, 'BOOKWORM');
            if (badge) rewards.push({ type: 'badge', value: badge });
        }
        
        // Check time-based badges
        checkTimeBadges(userId);
        
        // Check for rising star (3 lessons today)
        const today = new Date().toISOString().split('T')[0];
        const lessonsToday = db.prepare(`
            SELECT COUNT(*) as count FROM xp_transactions 
            WHERE user_id = ? AND reason = 'lesson_complete' 
            AND date(created_at, 'unixepoch') = ?
        `).get(userId, today);
        
        if (lessonsToday.count === 3) {
            const badge = awardBadge(userId, 'RISING_STAR');
            if (badge) rewards.push({ type: 'badge', value: badge });
        }
        
        // Update daily challenges
        const todaysChallenges = getTodaysChallenges(userId);
        todaysChallenges.forEach(challenge => {
            if (challenge.type === 'lesson' && !challenge.completed) {
                const newProgress = challenge.progress + 1;
                const completed = newProgress >= challenge.target;
                
                db.prepare(`
                    INSERT OR REPLACE INTO daily_challenges (id, user_id, challenge_id, date, progress, completed)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), userId, challenge.id, today, newProgress, completed ? 1 : 0);
                
                if (completed) {
                    addXP(userId, challenge.xp, 'daily_challenge', challenge.id);
                    rewards.push({ type: 'challenge', value: challenge });
                }
            }
        });
        
        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, activity_type, activity_data)
            VALUES (?, ?, 'lesson_complete', ?)
        `).run(uuidv4(), userId, JSON.stringify({ lessonId, courseId }));
        
        res.json({
            success: true,
            rewards,
            newStats: {
                totalXP: xpResult.newXP,
                level: getLevelInfo(xpResult.newXP).current,
                streak: streakResult.streak
            }
        });
    } catch (error) {
        console.error('Lesson complete error:', error);
        res.status(500).json({ success: false, error: 'שגיאה בעדכון' });
    }
});

/**
 * POST /api/gamification/quiz-complete
 * Called when a quiz is completed
 */
router.post('/quiz-complete', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { quizId, score, maxScore, percentage } = req.body;
        
        const rewards = [];
        
        // Update streak
        const streakResult = updateStreak(userId);
        
        // Calculate XP based on score
        let xpAmount = 0;
        let xpReason = '';
        
        if (percentage === 100) {
            xpAmount = CONFIG.XP.QUIZ_PERFECT;
            xpReason = 'קוויז מושלם! 💯';
            
            // Update perfect quiz count
            db.prepare(`
                UPDATE user_gamification 
                SET total_perfect_quizzes = total_perfect_quizzes + 1
                WHERE user_id = ?
            `).run(userId);
            
            // Check badges
            const badge = awardBadge(userId, 'PERFECT_QUIZ');
            if (badge) rewards.push({ type: 'badge', value: badge });
            
            const stats = getUserStats(userId);
            if (stats.total_perfect_quizzes === 5) {
                const fiveBadge = awardBadge(userId, 'FIVE_PERFECT');
                if (fiveBadge) rewards.push({ type: 'badge', value: fiveBadge });
            }
        } else if (percentage >= 80) {
            xpAmount = CONFIG.XP.QUIZ_PASS;
            xpReason = 'עברת את הקוויז!';
        } else {
            xpAmount = Math.round(CONFIG.XP.QUIZ_PASS * (percentage / 100));
            xpReason = 'השלמת קוויז';
        }
        
        const xpResult = addXP(userId, xpAmount, 'quiz_complete', `${quizId}: ${percentage}%`);
        rewards.push({ type: 'xp', value: xpAmount, reason: xpReason });
        
        if (xpResult.leveledUp) {
            rewards.push({ type: 'level_up', value: xpResult.newLevel });
        }
        
        // Update quiz count
        db.prepare(`
            UPDATE user_gamification 
            SET total_quizzes_completed = total_quizzes_completed + 1
            WHERE user_id = ?
        `).run(userId);
        
        // Update daily challenges
        const today = new Date().toISOString().split('T')[0];
        const todaysChallenges = getTodaysChallenges(userId);
        todaysChallenges.forEach(challenge => {
            if ((challenge.type === 'quiz' || (challenge.type === 'perfect_quiz' && percentage === 100)) && !challenge.completed) {
                const newProgress = challenge.progress + 1;
                const completed = newProgress >= challenge.target;
                
                db.prepare(`
                    INSERT OR REPLACE INTO daily_challenges (id, user_id, challenge_id, date, progress, completed)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), userId, challenge.id, today, newProgress, completed ? 1 : 0);
                
                if (completed) {
                    addXP(userId, challenge.xp, 'daily_challenge', challenge.id);
                    rewards.push({ type: 'challenge', value: challenge });
                }
            }
        });
        
        res.json({
            success: true,
            rewards,
            newStats: {
                totalXP: xpResult.newXP,
                level: getLevelInfo(xpResult.newXP).current,
                streak: streakResult.streak
            }
        });
    } catch (error) {
        console.error('Quiz complete error:', error);
        res.status(500).json({ success: false, error: 'שגיאה בעדכון' });
    }
});

/**
 * POST /api/gamification/course-complete
 * Called when a course is completed
 */
router.post('/course-complete', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId, startDate } = req.body;
        
        const rewards = [];
        
        // First course badge
        const badge = awardBadge(userId, 'FIRST_COURSE');
        if (badge) rewards.push({ type: 'badge', value: badge });
        
        // Check if completed within a week (speedster)
        if (startDate) {
            const daysTaken = Math.ceil((Date.now() - new Date(startDate).getTime()) / 86400000);
            if (daysTaken <= 7) {
                const speedBadge = awardBadge(userId, 'SPEEDSTER');
                if (speedBadge) rewards.push({ type: 'badge', value: speedBadge });
            }
        }
        
        // Bonus XP for course completion
        const xpResult = addXP(userId, 500, 'course_complete', courseId);
        rewards.push({ type: 'xp', value: 500, reason: 'סיימת קורס! 🎉' });
        
        if (xpResult.leveledUp) {
            rewards.push({ type: 'level_up', value: xpResult.newLevel });
        }
        
        res.json({
            success: true,
            rewards,
            newStats: {
                totalXP: xpResult.newXP,
                level: getLevelInfo(xpResult.newXP).current
            }
        });
    } catch (error) {
        console.error('Course complete error:', error);
        res.status(500).json({ success: false, error: 'שגיאה בעדכון' });
    }
});

/**
 * GET /api/gamification/leaderboard
 * Get weekly leaderboard
 */
router.get('/leaderboard', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { period = 'weekly' } = req.query;
        
        let dateFilter = '';
        if (period === 'weekly') {
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
            dateFilter = `AND date(xt.created_at, 'unixepoch') >= '${weekAgo}'`;
        } else if (period === 'monthly') {
            const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            dateFilter = `AND date(xt.created_at, 'unixepoch') >= '${monthAgo}'`;
        }
        
        const leaderboard = db.prepare(`
            SELECT 
                u.id,
                u.name,
                ug.current_level,
                ug.current_streak,
                COALESCE(SUM(xt.amount), 0) as period_xp
            FROM users u
            JOIN user_gamification ug ON u.id = ug.user_id
            LEFT JOIN xp_transactions xt ON u.id = xt.user_id ${dateFilter}
            GROUP BY u.id
            ORDER BY period_xp DESC
            LIMIT 20
        `).all();
        
        // Find user's rank
        const userRank = leaderboard.findIndex(u => u.id === userId) + 1;
        
        res.json({
            success: true,
            leaderboard: leaderboard.map((u, i) => ({
                rank: i + 1,
                name: u.name,
                level: CONFIG.LEVELS.find(l => l.level === u.current_level),
                xp: u.period_xp,
                streak: u.current_streak,
                isCurrentUser: u.id === userId
            })),
            userRank: userRank || null,
            period
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, error: 'שגיאה בטעינת הנתונים' });
    }
});

/**
 * POST /api/gamification/use-streak-shield
 * Use a streak shield
 */
router.post('/use-streak-shield', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const stats = getUserStats(userId);
        
        if (stats.streak_shield <= 0) {
            return res.status(400).json({ success: false, error: 'אין לך מגנים זמינים' });
        }
        
        // Use shield is automatic when streak would break
        // This endpoint is just for info
        
        res.json({
            success: true,
            shieldsRemaining: stats.streak_shield
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'שגיאה' });
    }
});

/**
 * GET /api/gamification/config
 * Get gamification configuration (levels, badges, etc)
 */
router.get('/config', (req, res) => {
    res.json({
        success: true,
        levels: CONFIG.LEVELS,
        badges: Object.values(CONFIG.BADGES),
        xpRewards: CONFIG.XP
    });
});

// Export functions for use in other routes
module.exports = router;
module.exports.helpers = {
    getUserStats,
    getLevelInfo,
    addXP,
    awardBadge,
    updateStreak,
    checkTimeBadges,
    CONFIG
};
