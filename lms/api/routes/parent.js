/**
 * Parent Dashboard Routes
 * Allows parents to monitor their children's learning progress
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ==========================================
// Database Initialization
// ==========================================
function initParentTables() {
    // Parent-Child Links table
    db.exec(`
        CREATE TABLE IF NOT EXISTS parent_child_links (
            id TEXT PRIMARY KEY,
            parent_id TEXT NOT NULL,
            child_id TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            linked_at INTEGER DEFAULT (strftime('%s', 'now')),
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            UNIQUE(parent_id, child_id),
            FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_parent_child_parent ON parent_child_links(parent_id);
        CREATE INDEX IF NOT EXISTS idx_parent_child_child ON parent_child_links(child_id);
    `);

    console.log('✅ Parent dashboard tables initialized');
}

// Initialize tables on load
try {
    initParentTables();
} catch (e) {
    console.error('Failed to init parent tables:', e);
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get child's gamification stats
 */
function getChildStats(childId) {
    let stats = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(childId);
    return stats || {
        total_xp: 0,
        current_level: 1,
        current_streak: 0,
        longest_streak: 0,
        total_lessons_completed: 0,
        total_quizzes_completed: 0
    };
}

/**
 * Get child's badges
 */
function getChildBadges(childId) {
    return db.prepare(`
        SELECT badge_id, earned_at 
        FROM user_badges 
        WHERE user_id = ?
        ORDER BY earned_at DESC
    `).all(childId);
}

/**
 * Get child's enrolled courses with progress
 */
function getChildCourses(childId) {
    return db.prepare(`
        SELECT 
            c.id,
            c.title,
            c.thumbnail,
            c.total_lessons,
            e.enrolled_at,
            COUNT(DISTINCT CASE WHEN p.completed = 1 THEN p.lesson_id END) as completed_lessons,
            ROUND(COUNT(DISTINCT CASE WHEN p.completed = 1 THEN p.lesson_id END) * 100.0 / NULLIF(c.total_lessons, 0), 0) as progress_percent
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        LEFT JOIN progress p ON p.course_id = c.id AND p.user_id = e.user_id
        WHERE e.user_id = ? AND e.status = 'active'
        GROUP BY c.id
        ORDER BY e.enrolled_at DESC
    `).all(childId);
}

/**
 * Get weekly activity data for chart
 */
function getWeeklyActivity(childId) {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayActivity = db.prepare(`
            SELECT 
                COUNT(DISTINCT lesson_id) as lessons_completed,
                SUM(watched_seconds) as total_seconds
            FROM progress
            WHERE user_id = ? 
            AND date(completed_at, 'unixepoch') = ?
        `).get(childId, dateStr);
        
        days.push({
            date: dateStr,
            dayName: date.toLocaleDateString('he-IL', { weekday: 'short' }),
            lessonsCompleted: dayActivity?.lessons_completed || 0,
            minutesStudied: Math.round((dayActivity?.total_seconds || 0) / 60)
        });
    }
    
    return days;
}

// ==========================================
// API Endpoints
// ==========================================

/**
 * GET /api/parent/children
 * Get list of linked children
 */
router.get('/children', authenticateToken, (req, res) => {
    try {
        const children = db.prepare(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u.avatar,
                pcl.linked_at,
                pcl.status
            FROM parent_child_links pcl
            JOIN users u ON u.id = pcl.child_id
            WHERE pcl.parent_id = ? AND pcl.status = 'active'
            ORDER BY pcl.linked_at DESC
        `).all(req.user.id);

        // Add basic stats to each child
        const childrenWithStats = children.map(child => {
            const stats = getChildStats(child.id);
            const courses = getChildCourses(child.id);
            
            return {
                ...child,
                totalXp: stats.total_xp,
                level: stats.current_level,
                streak: stats.current_streak,
                coursesCount: courses.length,
                lessonsCompleted: stats.total_lessons_completed
            };
        });

        res.json({
            success: true,
            children: childrenWithStats
        });

    } catch (err) {
        console.error('Get children error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת רשימת הילדים'
        });
    }
});

/**
 * GET /api/parent/child/:id/progress
 * Get detailed progress for a specific child
 */
router.get('/child/:id/progress', authenticateToken, (req, res) => {
    try {
        const childId = req.params.id;

        // Verify parent-child link
        const link = db.prepare(`
            SELECT * FROM parent_child_links 
            WHERE parent_id = ? AND child_id = ? AND status = 'active'
        `).get(req.user.id, childId);

        if (!link) {
            return res.status(403).json({
                success: false,
                error: 'אין לך הרשאה לצפות בהתקדמות של משתמש זה'
            });
        }

        // Get child info
        const child = db.prepare(`
            SELECT id, name, email, avatar FROM users WHERE id = ?
        `).get(childId);

        if (!child) {
            return res.status(404).json({
                success: false,
                error: 'המשתמש לא נמצא'
            });
        }

        // Get stats
        const stats = getChildStats(childId);
        const badges = getChildBadges(childId);
        const courses = getChildCourses(childId);
        const weeklyActivity = getWeeklyActivity(childId);

        // Calculate totals
        const totalProgress = courses.length > 0
            ? Math.round(courses.reduce((sum, c) => sum + (c.progress_percent || 0), 0) / courses.length)
            : 0;

        res.json({
            success: true,
            child: {
                ...child,
                stats: {
                    totalXp: stats.total_xp,
                    level: stats.current_level,
                    streak: stats.current_streak,
                    longestStreak: stats.longest_streak,
                    lessonsCompleted: stats.total_lessons_completed,
                    quizzesCompleted: stats.total_quizzes_completed
                },
                badges,
                courses,
                weeklyActivity,
                totalProgress
            }
        });

    } catch (err) {
        console.error('Get child progress error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת נתוני ההתקדמות'
        });
    }
});

/**
 * GET /api/parent/child/:id/activity
 * Get recent activity for a specific child
 */
router.get('/child/:id/activity', authenticateToken, (req, res) => {
    try {
        const childId = req.params.id;
        const limit = parseInt(req.query.limit) || 20;

        // Verify parent-child link
        const link = db.prepare(`
            SELECT * FROM parent_child_links 
            WHERE parent_id = ? AND child_id = ? AND status = 'active'
        `).get(req.user.id, childId);

        if (!link) {
            return res.status(403).json({
                success: false,
                error: 'אין לך הרשאה לצפות בפעילות של משתמש זה'
            });
        }

        // Get recent lesson activity
        const lessonActivity = db.prepare(`
            SELECT 
                p.lesson_id,
                p.course_id,
                p.completed,
                p.watched_seconds,
                p.last_watched_at,
                p.completed_at,
                l.title as lesson_title,
                l.order_index as lesson_order,
                c.title as course_title
            FROM progress p
            JOIN lessons l ON l.id = p.lesson_id
            JOIN courses c ON c.id = p.course_id
            WHERE p.user_id = ?
            ORDER BY p.last_watched_at DESC
            LIMIT ?
        `).all(childId, limit);

        // Get recent quiz activity
        const quizActivity = db.prepare(`
            SELECT 
                qa.quiz_id,
                qa.score,
                qa.passed,
                qa.completed_at,
                q.title as quiz_title,
                c.title as course_title
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            JOIN courses c ON c.id = q.course_id
            WHERE qa.user_id = ?
            ORDER BY qa.completed_at DESC
            LIMIT ?
        `).all(childId, Math.floor(limit / 2));

        // Get XP transactions (achievements)
        const xpActivity = db.prepare(`
            SELECT 
                amount,
                reason,
                details,
                created_at
            FROM xp_transactions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(childId, Math.floor(limit / 2));

        // Combine and sort all activities
        const allActivity = [
            ...lessonActivity.map(a => ({
                type: a.completed ? 'lesson_completed' : 'lesson_watched',
                title: a.lesson_title,
                subtitle: a.course_title,
                timestamp: a.completed ? a.completed_at : a.last_watched_at,
                details: {
                    watchedMinutes: Math.round(a.watched_seconds / 60)
                }
            })),
            ...quizActivity.map(a => ({
                type: a.passed ? 'quiz_passed' : 'quiz_attempted',
                title: a.quiz_title,
                subtitle: a.course_title,
                timestamp: a.completed_at,
                details: {
                    score: a.score
                }
            })),
            ...xpActivity.map(a => ({
                type: 'xp_earned',
                title: getXpReasonText(a.reason),
                subtitle: a.details,
                timestamp: a.created_at,
                details: {
                    amount: a.amount
                }
            }))
        ].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);

        res.json({
            success: true,
            activity: allActivity
        });

    } catch (err) {
        console.error('Get child activity error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת הפעילות האחרונה'
        });
    }
});

/**
 * POST /api/parent/link-child
 * Link a child to parent (by email/code)
 */
router.post('/link-child', authenticateToken, async (req, res) => {
    try {
        const { childEmail, linkCode } = req.body;

        if (!childEmail && !linkCode) {
            return res.status(400).json({
                success: false,
                error: 'יש לספק אימייל של הילד או קוד קישור'
            });
        }

        let child;
        
        if (childEmail) {
            child = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(childEmail.toLowerCase());
        }
        // TODO: Implement link code system

        if (!child) {
            return res.status(404).json({
                success: false,
                error: 'המשתמש לא נמצא במערכת'
            });
        }

        // Check if already linked
        const existingLink = db.prepare(`
            SELECT * FROM parent_child_links 
            WHERE parent_id = ? AND child_id = ?
        `).get(req.user.id, child.id);

        if (existingLink) {
            if (existingLink.status === 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'הילד כבר מקושר לחשבון שלך'
                });
            }
            // Reactivate existing link
            db.prepare(`
                UPDATE parent_child_links 
                SET status = 'active', linked_at = strftime('%s', 'now')
                WHERE id = ?
            `).run(existingLink.id);
        } else {
            // Create new link
            db.prepare(`
                INSERT INTO parent_child_links (id, parent_id, child_id)
                VALUES (?, ?, ?)
            `).run(uuidv4(), req.user.id, child.id);
        }

        res.json({
            success: true,
            message: `${child.name} קושר/ה בהצלחה לחשבון שלך`,
            child: {
                id: child.id,
                name: child.name,
                email: child.email
            }
        });

    } catch (err) {
        console.error('Link child error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בקישור הילד'
        });
    }
});

/**
 * DELETE /api/parent/child/:id
 * Unlink a child
 */
router.delete('/child/:id', authenticateToken, (req, res) => {
    try {
        const childId = req.params.id;

        const result = db.prepare(`
            UPDATE parent_child_links 
            SET status = 'inactive'
            WHERE parent_id = ? AND child_id = ?
        `).run(req.user.id, childId);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'הקישור לא נמצא'
            });
        }

        res.json({
            success: true,
            message: 'הקישור הוסר בהצלחה'
        });

    } catch (err) {
        console.error('Unlink child error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בהסרת הקישור'
        });
    }
});

// Helper function for XP reason text
function getXpReasonText(reason) {
    const reasons = {
        'watch_lesson': 'צפייה בשיעור',
        'complete_lesson': 'השלמת שיעור',
        'quiz_pass': 'עבר קוויז',
        'quiz_perfect': 'ציון מושלם בקוויז',
        'streak_bonus': 'בונוס רצף',
        'daily_challenge': 'אתגר יומי',
        'badge_earned': 'הישג חדש',
        'first_lesson_today': 'שיעור ראשון היום'
    };
    return reasons[reason] || reason;
}

module.exports = router;
