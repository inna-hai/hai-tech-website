/**
 * Parent Dashboard & Invitation Routes
 * Complete implementation with secure parent-child linking
 * 
 * Features:
 * - Parent invitations with secure tokens
 * - Post-signup parent linking
 * - Authorization checks (IDOR protection)
 * - Multi-parent/multi-child support
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// JWT Secret (should match auth.js)
const JWT_SECRET = process.env.JWT_SECRET || 'hai-tech-lms-secret-key-2026';

// Invite expiration: 7 days
const INVITE_EXPIRY_DAYS = 7;

// ==========================================
// Database Initialization
// ==========================================
function initParentTables() {
    // Parent-Child Links table (final confirmed links)
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

    // Parent Invites table (pending invitations)
    db.exec(`
        CREATE TABLE IF NOT EXISTS parent_invites (
            id TEXT PRIMARY KEY,
            child_id TEXT NOT NULL,
            parent_email TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'pending',
            expires_at INTEGER NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            accepted_at INTEGER,
            FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_child_links(parent_id);
        CREATE INDEX IF NOT EXISTS idx_parent_links_child ON parent_child_links(child_id);
        CREATE INDEX IF NOT EXISTS idx_parent_invites_email ON parent_invites(parent_email);
        CREATE INDEX IF NOT EXISTS idx_parent_invites_token ON parent_invites(token);
        CREATE INDEX IF NOT EXISTS idx_parent_invites_child ON parent_invites(child_id);
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
// Middleware: Require Parent Role
// ==========================================
function requireParent(req, res, next) {
    if (req.user.role !== 'parent') {
        return res.status(403).json({
            success: false,
            error: 'נדרשת הרשאת הורה'
        });
    }
    next();
}

// ==========================================
// Middleware: Verify Parent-Child Link
// ==========================================
function verifyParentChildLink(req, res, next) {
    const childId = req.params.id || req.params.childId;
    
    if (!childId) {
        return res.status(400).json({
            success: false,
            error: 'מזהה ילד חסר'
        });
    }

    const link = db.prepare(`
        SELECT * FROM parent_child_links 
        WHERE parent_id = ? AND child_id = ? AND status = 'active'
    `).get(req.user.id, childId);

    if (!link) {
        return res.status(403).json({
            success: false,
            error: 'אין לך הרשאה לצפות בנתונים של משתמש זה'
        });
    }

    req.childId = childId;
    next();
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Generate secure random token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate invite expiry timestamp
 */
function getExpiryTimestamp() {
    return Math.floor(Date.now() / 1000) + (INVITE_EXPIRY_DAYS * 24 * 60 * 60);
}

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
    try {
        return db.prepare(`
            SELECT badge_id, earned_at 
            FROM user_badges 
            WHERE user_id = ?
            ORDER BY earned_at DESC
        `).all(childId);
    } catch (e) {
        return [];
    }
}

/**
 * Get child's enrolled courses with progress
 */
function getChildCourses(childId) {
    try {
        return db.prepare(`
            SELECT 
                c.id,
                c.title,
                e.enrolled_at,
                (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons,
                (SELECT COUNT(*) FROM progress WHERE user_id = ? AND course_id = c.id AND completed = 1) as completed_lessons
            FROM enrollments e
            JOIN courses c ON c.id = e.course_id
            WHERE e.user_id = ? AND e.status = 'active'
            ORDER BY e.enrolled_at DESC
        `).all(childId, childId);
    } catch (e) {
        return [];
    }
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
        
        let dayActivity = { lessons_completed: 0, total_seconds: 0 };
        try {
            dayActivity = db.prepare(`
                SELECT 
                    COUNT(DISTINCT lesson_id) as lessons_completed,
                    COALESCE(SUM(watched_seconds), 0) as total_seconds
                FROM progress
                WHERE user_id = ? 
                AND date(last_watched_at, 'unixepoch') = ?
            `).get(childId, dateStr) || dayActivity;
        } catch (e) {}
        
        days.push({
            date: dateStr,
            dayName: date.toLocaleDateString('he-IL', { weekday: 'short' }),
            lessonsCompleted: dayActivity?.lessons_completed || 0,
            minutesStudied: Math.round((dayActivity?.total_seconds || 0) / 60)
        });
    }
    
    return days;
}

/**
 * Get XP reason display text
 */
function getXpReasonText(reason) {
    const reasons = {
        'lesson_complete': 'סיום שיעור',
        'quiz_complete': 'סיום חידון',
        'quiz_perfect': 'ציון מושלם בחידון',
        'daily_login': 'כניסה יומית',
        'streak_bonus': 'בונוס רצף',
        'badge_earned': 'קבלת תג'
    };
    return reasons[reason] || reason;
}

// ==========================================
// INVITATION ENDPOINTS
// ==========================================

/**
 * POST /api/parent/invite
 * Send invitation to parent (called by student)
 */
router.post('/invite', authenticateToken, async (req, res) => {
    try {
        const { parentEmail } = req.body;
        const childId = req.user.id;

        // Validate email
        if (!parentEmail || !parentEmail.includes('@')) {
            return res.status(400).json({
                success: false,
                error: 'כתובת אימייל לא תקינה'
            });
        }

        const normalizedEmail = parentEmail.toLowerCase().trim();

        // Check if link already exists
        const existingParent = db.prepare(`
            SELECT u.id FROM users u
            JOIN parent_child_links pcl ON pcl.parent_id = u.id
            WHERE u.email = ? AND pcl.child_id = ? AND pcl.status = 'active'
        `).get(normalizedEmail, childId);

        if (existingParent) {
            return res.status(400).json({
                success: false,
                error: 'הורה זה כבר מקושר לחשבון שלך'
            });
        }

        // Check for existing pending invite
        const existingInvite = db.prepare(`
            SELECT * FROM parent_invites 
            WHERE child_id = ? AND parent_email = ? AND status = 'pending'
        `).get(childId, normalizedEmail);

        const now = Math.floor(Date.now() / 1000);

        if (existingInvite) {
            // If expired, refresh it
            if (existingInvite.expires_at < now) {
                const newToken = generateToken();
                const newExpiry = getExpiryTimestamp();
                
                db.prepare(`
                    UPDATE parent_invites 
                    SET token = ?, expires_at = ?, created_at = ?
                    WHERE id = ?
                `).run(newToken, newExpiry, now, existingInvite.id);

                // TODO: Send email with new invite link
                
                return res.json({
                    success: true,
                    message: 'ההזמנה חודשה ונשלחה מחדש',
                    inviteId: existingInvite.id,
                    token: newToken // For testing - remove in production
                });
            }

            return res.json({
                success: true,
                message: 'הזמנה כבר נשלחה לכתובת זו',
                inviteId: existingInvite.id,
                status: 'pending'
            });
        }

        // Create new invite
        const inviteId = uuidv4();
        const token = generateToken();
        const expiresAt = getExpiryTimestamp();

        db.prepare(`
            INSERT INTO parent_invites (id, child_id, parent_email, token, status, expires_at)
            VALUES (?, ?, ?, ?, 'pending', ?)
        `).run(inviteId, childId, normalizedEmail, token, expiresAt);

        // TODO: Send invitation email
        // For now, return token for testing
        const inviteUrl = `/lms/accept-invite.html?token=${token}`;

        res.json({
            success: true,
            message: 'הזמנה נשלחה בהצלחה',
            inviteId,
            inviteUrl, // For testing
            token // For testing - remove in production
        });

    } catch (err) {
        console.error('Create invite error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה ביצירת ההזמנה'
        });
    }
});

/**
 * GET /api/parent/invites
 * Get student's sent invites (for profile page)
 */
router.get('/invites', authenticateToken, (req, res) => {
    try {
        const childId = req.user.id;
        const now = Math.floor(Date.now() / 1000);

        const invites = db.prepare(`
            SELECT 
                id,
                parent_email,
                status,
                expires_at,
                created_at,
                accepted_at,
                CASE WHEN expires_at < ? AND status = 'pending' THEN 'expired' ELSE status END as current_status
            FROM parent_invites
            WHERE child_id = ?
            ORDER BY created_at DESC
        `).all(now, childId);

        // Also get linked parents
        const linkedParents = db.prepare(`
            SELECT 
                u.id,
                u.name,
                u.email,
                pcl.linked_at
            FROM parent_child_links pcl
            JOIN users u ON u.id = pcl.parent_id
            WHERE pcl.child_id = ? AND pcl.status = 'active'
        `).all(childId);

        res.json({
            success: true,
            invites: invites.map(inv => ({
                id: inv.id,
                email: inv.parent_email,
                status: inv.current_status,
                createdAt: inv.created_at,
                expiresAt: inv.expires_at,
                acceptedAt: inv.accepted_at
            })),
            linkedParents: linkedParents.map(p => ({
                id: p.id,
                name: p.name,
                email: p.email,
                linkedAt: p.linked_at
            }))
        });

    } catch (err) {
        console.error('Get invites error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת ההזמנות'
        });
    }
});

/**
 * POST /api/parent/resend-invite
 * Resend expired invite
 */
router.post('/resend-invite', authenticateToken, async (req, res) => {
    try {
        const { inviteId } = req.body;
        const childId = req.user.id;

        const invite = db.prepare(`
            SELECT * FROM parent_invites WHERE id = ? AND child_id = ?
        `).get(inviteId, childId);

        if (!invite) {
            return res.status(404).json({
                success: false,
                error: 'ההזמנה לא נמצאה'
            });
        }

        if (invite.status === 'accepted') {
            return res.status(400).json({
                success: false,
                error: 'ההזמנה כבר אושרה'
            });
        }

        const newToken = generateToken();
        const newExpiry = getExpiryTimestamp();
        const now = Math.floor(Date.now() / 1000);

        db.prepare(`
            UPDATE parent_invites 
            SET token = ?, expires_at = ?, status = 'pending', created_at = ?
            WHERE id = ?
        `).run(newToken, newExpiry, now, inviteId);

        // TODO: Send email

        res.json({
            success: true,
            message: 'ההזמנה נשלחה מחדש',
            token: newToken // For testing
        });

    } catch (err) {
        console.error('Resend invite error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בשליחה מחדש'
        });
    }
});

/**
 * GET /api/parent/invite/:token
 * Get invite details by token (public - for accept page)
 */
router.get('/invite/:token', (req, res) => {
    try {
        const { token } = req.params;
        const now = Math.floor(Date.now() / 1000);

        const invite = db.prepare(`
            SELECT 
                pi.*,
                u.name as child_name
            FROM parent_invites pi
            JOIN users u ON u.id = pi.child_id
            WHERE pi.token = ?
        `).get(token);

        if (!invite) {
            return res.status(404).json({
                success: false,
                error: 'הזמנה לא נמצאה'
            });
        }

        if (invite.status === 'accepted') {
            return res.status(400).json({
                success: false,
                error: 'ההזמנה כבר אושרה'
            });
        }

        if (invite.expires_at < now) {
            return res.status(400).json({
                success: false,
                error: 'ההזמנה פגה תוקף'
            });
        }

        res.json({
            success: true,
            invite: {
                childName: invite.child_name,
                parentEmail: invite.parent_email,
                expiresAt: invite.expires_at
            }
        });

    } catch (err) {
        console.error('Get invite error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת ההזמנה'
        });
    }
});

/**
 * POST /api/parent/accept-invite
 * Accept invitation and create parent account/link
 */
router.post('/accept-invite', async (req, res) => {
    try {
        const { token, password, name } = req.body;
        const now = Math.floor(Date.now() / 1000);

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'קוד הזמנה חסר'
            });
        }

        // Find invite
        const invite = db.prepare(`
            SELECT * FROM parent_invites WHERE token = ?
        `).get(token);

        if (!invite) {
            return res.status(404).json({
                success: false,
                error: 'הזמנה לא נמצאה'
            });
        }

        if (invite.status === 'accepted') {
            return res.status(400).json({
                success: false,
                error: 'ההזמנה כבר אושרה'
            });
        }

        if (invite.expires_at < now) {
            return res.status(400).json({
                success: false,
                error: 'ההזמנה פגה תוקף'
            });
        }

        // Check if parent user already exists
        let parent = db.prepare('SELECT * FROM users WHERE email = ?').get(invite.parent_email);

        if (parent) {
            // Parent exists - verify role and create link
            if (parent.role !== 'parent') {
                // Update role to parent if not already
                db.prepare('UPDATE users SET role = ? WHERE id = ?').run('parent', parent.id);
            }
        } else {
            // Create new parent user
            if (!password || password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'נדרשת סיסמה באורך 6 תווים לפחות'
                });
            }

            const parentId = uuidv4();
            const passwordHash = await bcrypt.hash(password, 10);
            const parentName = name || invite.parent_email.split('@')[0];

            db.prepare(`
                INSERT INTO users (id, email, password_hash, name, role)
                VALUES (?, ?, ?, ?, 'parent')
            `).run(parentId, invite.parent_email, passwordHash, parentName);

            parent = { id: parentId, email: invite.parent_email, name: parentName, role: 'parent' };
        }

        // Check if link already exists
        const existingLink = db.prepare(`
            SELECT * FROM parent_child_links WHERE parent_id = ? AND child_id = ?
        `).get(parent.id, invite.child_id);

        if (!existingLink) {
            // Create parent-child link
            db.prepare(`
                INSERT INTO parent_child_links (id, parent_id, child_id, status)
                VALUES (?, ?, ?, 'active')
            `).run(uuidv4(), parent.id, invite.child_id);
        }

        // Mark invite as accepted
        db.prepare(`
            UPDATE parent_invites SET status = 'accepted', accepted_at = ? WHERE id = ?
        `).run(now, invite.id);

        // Generate JWT
        const jwtToken = jwt.sign(
            { userId: parent.id, email: parent.email, role: 'parent' },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: 'ההזמנה אושרה בהצלחה!',
            token: jwtToken,
            user: {
                id: parent.id,
                email: parent.email,
                name: parent.name,
                role: 'parent'
            },
            redirect: '/lms/parent-dashboard.html'
        });

    } catch (err) {
        console.error('Accept invite error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה באישור ההזמנה'
        });
    }
});

// ==========================================
// PARENT DASHBOARD ENDPOINTS
// ==========================================

/**
 * GET /api/parent/children
 * Get list of linked children (PARENT ONLY)
 */
router.get('/children', authenticateToken, requireParent, (req, res) => {
    try {
        const children = db.prepare(`
            SELECT 
                u.id,
                u.name,
                u.email,
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
                id: child.id,
                name: child.name,
                email: child.email,
                linkedAt: child.linked_at,
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
 * Get detailed progress for a specific child (PARENT ONLY with link verification)
 */
router.get('/child/:id/progress', authenticateToken, requireParent, verifyParentChildLink, (req, res) => {
    try {
        const childId = req.childId;

        // Get child info
        const child = db.prepare(`
            SELECT id, name, email FROM users WHERE id = ?
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

        // Calculate course progress
        const coursesWithProgress = courses.map(c => ({
            ...c,
            progressPercent: c.total_lessons > 0 
                ? Math.round((c.completed_lessons / c.total_lessons) * 100) 
                : 0
        }));

        // Calculate totals
        const totalProgress = coursesWithProgress.length > 0
            ? Math.round(coursesWithProgress.reduce((sum, c) => sum + c.progressPercent, 0) / coursesWithProgress.length)
            : 0;

        res.json({
            success: true,
            child: {
                id: child.id,
                name: child.name,
                email: child.email,
                stats: {
                    totalXp: stats.total_xp,
                    level: stats.current_level,
                    streak: stats.current_streak,
                    longestStreak: stats.longest_streak,
                    lessonsCompleted: stats.total_lessons_completed,
                    quizzesCompleted: stats.total_quizzes_completed
                },
                badges,
                courses: coursesWithProgress,
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
 * Get recent activity for a specific child (PARENT ONLY with link verification)
 */
router.get('/child/:id/activity', authenticateToken, requireParent, verifyParentChildLink, (req, res) => {
    try {
        const childId = req.childId;
        const limit = parseInt(req.query.limit) || 20;

        const allActivity = [];

        // Get recent lesson activity
        try {
            const lessonActivity = db.prepare(`
                SELECT 
                    p.lesson_id,
                    p.course_id,
                    p.completed,
                    p.watched_seconds,
                    p.last_watched_at,
                    l.title as lesson_title,
                    c.title as course_title
                FROM progress p
                LEFT JOIN lessons l ON l.id = p.lesson_id
                LEFT JOIN courses c ON c.id = p.course_id
                WHERE p.user_id = ?
                ORDER BY p.last_watched_at DESC
                LIMIT ?
            `).all(childId, limit);

            lessonActivity.forEach(a => {
                allActivity.push({
                    type: a.completed ? 'lesson_completed' : 'lesson_watched',
                    title: a.lesson_title || 'שיעור',
                    subtitle: a.course_title || 'קורס',
                    timestamp: a.last_watched_at,
                    details: {
                        watchedMinutes: Math.round((a.watched_seconds || 0) / 60)
                    }
                });
            });
        } catch (e) {}

        // Get recent quiz activity
        try {
            const quizActivity = db.prepare(`
                SELECT 
                    qr.score,
                    qr.percentage,
                    qr.passed,
                    qr.completed_at,
                    q.title as quiz_title
                FROM quiz_results qr
                LEFT JOIN quizzes q ON q.id = qr.quiz_id
                WHERE qr.user_id = ?
                ORDER BY qr.completed_at DESC
                LIMIT ?
            `).all(childId, Math.floor(limit / 2));

            quizActivity.forEach(a => {
                allActivity.push({
                    type: a.passed ? 'quiz_passed' : 'quiz_attempted',
                    title: a.quiz_title || 'חידון',
                    subtitle: `${a.percentage || 0}%`,
                    timestamp: a.completed_at ? new Date(a.completed_at).getTime() / 1000 : 0,
                    details: {
                        score: a.score,
                        percentage: a.percentage
                    }
                });
            });
        } catch (e) {}

        // Sort by timestamp
        allActivity.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        res.json({
            success: true,
            activity: allActivity.slice(0, limit)
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
 * DELETE /api/parent/unlink-child/:id
 * Remove parent-child link
 */
router.delete('/unlink-child/:id', authenticateToken, requireParent, verifyParentChildLink, (req, res) => {
    try {
        const childId = req.childId;

        db.prepare(`
            UPDATE parent_child_links 
            SET status = 'inactive'
            WHERE parent_id = ? AND child_id = ?
        `).run(req.user.id, childId);

        res.json({
            success: true,
            message: 'הקישור בוטל בהצלחה'
        });

    } catch (err) {
        console.error('Unlink child error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בביטול הקישור'
        });
    }
});

module.exports = router;
