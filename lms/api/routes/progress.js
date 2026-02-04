/**
 * Progress Routes
 * Handles lesson progress tracking
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Import gamification helpers
let gamification = null;
try {
    gamification = require('./gamification').helpers;
    console.log('✅ Gamification integration loaded');
} catch (e) {
    console.warn('⚠️ Gamification not available:', e.message);
}

const router = express.Router();

/**
 * POST /api/progress
 * Update lesson progress
 */
router.post('/', authenticateToken, (req, res) => {
    try {
        const { lessonId, courseId, watchedSeconds, completed } = req.body;

        // Validation
        if (!lessonId || !courseId) {
            return res.status(400).json({
                success: false,
                error: 'חסרים פרטי שיעור'
            });
        }

        // Verify enrollment
        const enrollment = db.prepare(`
            SELECT status FROM enrollments 
            WHERE user_id = ? AND course_id = ? AND status = 'active'
        `).get(req.user.id, courseId);

        // Also check if it's a free lesson
        const lesson = db.prepare(`
            SELECT is_free, duration_seconds FROM lessons WHERE id = ? AND course_id = ?
        `).get(lessonId, courseId);

        if (!lesson) {
            return res.status(404).json({
                success: false,
                error: 'השיעור לא נמצא'
            });
        }

        if (!enrollment && !lesson.is_free) {
            return res.status(403).json({
                success: false,
                error: 'אין הרשאה לעדכן התקדמות בקורס זה'
            });
        }

        // Get existing progress
        const existingProgress = db.prepare(`
            SELECT * FROM progress WHERE user_id = ? AND lesson_id = ?
        `).get(req.user.id, lessonId);

        const now = Math.floor(Date.now() / 1000);
        
        // Determine if lesson should be marked as completed
        // Auto-complete if watched >= 90% of lesson duration
        const isCompleted = completed || 
            (watchedSeconds && lesson.duration_seconds && 
             watchedSeconds >= lesson.duration_seconds * 0.9);

        if (existingProgress) {
            // Update existing progress
            const newWatchedSeconds = watchedSeconds !== undefined 
                ? Math.max(existingProgress.watched_seconds, watchedSeconds)
                : existingProgress.watched_seconds;

            const updateData = {
                watchedSeconds: newWatchedSeconds,
                completed: isCompleted ? 1 : existingProgress.completed,
                completedAt: isCompleted && !existingProgress.completed ? now : existingProgress.completed_at,
                lastWatchedAt: now
            };

            db.prepare(`
                UPDATE progress 
                SET watched_seconds = ?, completed = ?, completed_at = ?, last_watched_at = ?
                WHERE id = ?
            `).run(
                updateData.watchedSeconds,
                updateData.completed,
                updateData.completedAt,
                updateData.lastWatchedAt,
                existingProgress.id
            );

        } else {
            // Create new progress record
            const progressId = uuidv4();
            db.prepare(`
                INSERT INTO progress 
                (id, user_id, lesson_id, course_id, watched_seconds, completed, completed_at, last_watched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                progressId,
                req.user.id,
                lessonId,
                courseId,
                watchedSeconds || 0,
                isCompleted ? 1 : 0,
                isCompleted ? now : null,
                now
            );
        }

        // Get updated course progress
        const courseProgress = db.prepare(`
            SELECT 
                COUNT(*) as total_lessons,
                SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END) as completed_lessons
            FROM lessons l
            LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = ?
            WHERE l.course_id = ?
        `).get(req.user.id, courseId);

        const progressPercent = courseProgress.total_lessons > 0 
            ? Math.round((courseProgress.completed_lessons / courseProgress.total_lessons) * 100)
            : 0;

        // Check if course is now complete
        const courseComplete = courseProgress.completed_lessons === courseProgress.total_lessons;

        // ===== GAMIFICATION =====
        let gamificationResult = null;
        if (gamification && isCompleted && (!existingProgress || !existingProgress.completed)) {
            try {
                // Update streak
                const streakResult = gamification.updateStreak(req.user.id);
                
                // Add XP for completing lesson
                const xpResult = gamification.addXP(
                    req.user.id, 
                    gamification.CONFIG.XP.COMPLETE_LESSON, 
                    'lesson_complete', 
                    lessonId
                );
                
                // Check for first lesson badge
                const completedCount = db.prepare(
                    'SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND completed = 1'
                ).get(req.user.id).count;
                
                if (completedCount === 1) {
                    gamification.awardBadge(req.user.id, 'FIRST_LESSON');
                }
                
                // Check time-based badges
                gamification.checkTimeBadges(req.user.id);
                
                // Check for course completion badge
                if (courseComplete) {
                    const firstCourse = gamification.awardBadge(req.user.id, 'FIRST_COURSE');
                    gamification.addXP(req.user.id, 100, 'course_complete', courseId);
                }
                
                gamificationResult = {
                    xpEarned: gamification.CONFIG.XP.COMPLETE_LESSON,
                    newStreak: streakResult.streak,
                    leveledUp: xpResult.leveledUp,
                    newLevel: xpResult.newLevel
                };
                
                console.log(`🎮 Gamification: User ${req.user.id} earned ${gamification.CONFIG.XP.COMPLETE_LESSON} XP`);
            } catch (gamErr) {
                console.error('Gamification error:', gamErr);
            }
        }
        // ===== END GAMIFICATION =====

        res.json({
            success: true,
            message: isCompleted ? 'סיימת את השיעור! 🎉' : 'ההתקדמות נשמרה',
            lessonCompleted: !!isCompleted,
            courseProgress: {
                completedLessons: courseProgress.completed_lessons,
                totalLessons: courseProgress.total_lessons,
                percent: progressPercent,
                courseComplete
            },
            gamification: gamificationResult
        });

    } catch (err) {
        console.error('Update progress error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בשמירת ההתקדמות'
        });
    }
});

/**
 * GET /api/progress/:courseId
 * Get all progress for a specific course
 */
router.get('/:courseId', authenticateToken, (req, res) => {
    try {
        const { courseId } = req.params;

        // Verify user has access to this course
        const enrollment = db.prepare(`
            SELECT status FROM enrollments 
            WHERE user_id = ? AND course_id = ?
        `).get(req.user.id, courseId);

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                error: 'אין הרשאה לצפות בהתקדמות קורס זה'
            });
        }

        // Get all lessons with progress
        const lessons = db.prepare(`
            SELECT 
                l.id, l.title, l.lesson_order, l.duration_seconds,
                COALESCE(p.watched_seconds, 0) as watched_seconds,
                COALESCE(p.completed, 0) as completed,
                p.completed_at,
                p.last_watched_at
            FROM lessons l
            LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = ?
            WHERE l.course_id = ?
            ORDER BY l.lesson_order ASC
        `).all(req.user.id, courseId);

        // Calculate totals
        const totalLessons = lessons.length;
        const completedLessons = lessons.filter(l => l.completed).length;
        const totalWatchedSeconds = lessons.reduce((sum, l) => sum + l.watched_seconds, 0);
        const totalDurationSeconds = lessons.reduce((sum, l) => sum + l.duration_seconds, 0);

        res.json({
            success: true,
            courseId,
            lessons: lessons.map(l => ({
                id: l.id,
                title: l.title,
                order: l.lesson_order,
                durationSeconds: l.duration_seconds,
                watchedSeconds: l.watched_seconds,
                completed: !!l.completed,
                completedAt: l.completed_at,
                lastWatchedAt: l.last_watched_at
            })),
            summary: {
                totalLessons,
                completedLessons,
                percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
                totalWatchedSeconds,
                totalDurationSeconds,
                isComplete: completedLessons === totalLessons
            }
        });

    } catch (err) {
        console.error('Get progress error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת ההתקדמות'
        });
    }
});

/**
 * GET /api/progress
 * Get overall progress summary for all enrolled courses
 */
router.get('/', authenticateToken, (req, res) => {
    try {
        const coursesProgress = db.prepare(`
            SELECT 
                c.id, c.title, c.image,
                e.enrolled_at,
                COUNT(l.id) as total_lessons,
                SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END) as completed_lessons,
                MAX(p.last_watched_at) as last_activity
            FROM enrollments e
            INNER JOIN courses c ON c.id = e.course_id
            LEFT JOIN lessons l ON l.course_id = c.id
            LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = e.user_id
            WHERE e.user_id = ? AND e.status = 'active'
            GROUP BY c.id
            ORDER BY last_activity DESC NULLS LAST
        `).all(req.user.id);

        // Calculate overall stats
        const totalCourses = coursesProgress.length;
        const completedCourses = coursesProgress.filter(c => 
            c.completed_lessons === c.total_lessons && c.total_lessons > 0
        ).length;
        const totalLessonsCompleted = coursesProgress.reduce((sum, c) => sum + (c.completed_lessons || 0), 0);
        const totalLessons = coursesProgress.reduce((sum, c) => sum + c.total_lessons, 0);

        res.json({
            success: true,
            courses: coursesProgress.map(c => ({
                id: c.id,
                title: c.title,
                image: c.image,
                enrolledAt: c.enrolled_at,
                totalLessons: c.total_lessons,
                completedLessons: c.completed_lessons || 0,
                percent: c.total_lessons > 0 
                    ? Math.round(((c.completed_lessons || 0) / c.total_lessons) * 100)
                    : 0,
                isComplete: c.completed_lessons === c.total_lessons && c.total_lessons > 0,
                lastActivity: c.last_activity
            })),
            summary: {
                totalCourses,
                completedCourses,
                totalLessons,
                totalLessonsCompleted,
                overallPercent: totalLessons > 0 
                    ? Math.round((totalLessonsCompleted / totalLessons) * 100)
                    : 0
            }
        });

    } catch (err) {
        console.error('Get all progress error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת ההתקדמות'
        });
    }
});

module.exports = router;
