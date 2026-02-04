/**
 * Courses Routes
 * Handles course listing, details, and enrollment
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/courses
 * List all published courses (public) or enrolled courses (if authenticated)
 */
router.get('/', optionalAuth, (req, res) => {
    try {
        const { enrolled } = req.query;
        
        // If user is logged in and wants enrolled courses only
        if (req.user && enrolled === 'true') {
            const courses = db.prepare(`
                SELECT 
                    c.*,
                    e.enrolled_at,
                    e.expires_at,
                    e.status as enrollment_status,
                    (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons,
                    (SELECT COUNT(*) FROM progress 
                     WHERE user_id = ? AND course_id = c.id AND completed = 1) as completed_lessons
                FROM courses c
                INNER JOIN enrollments e ON e.course_id = c.id
                WHERE e.user_id = ? AND e.status = 'active'
                ORDER BY e.enrolled_at DESC
            `).all(req.user.id, req.user.id);

            return res.json({
                success: true,
                courses: courses.map(formatCourse)
            });
        }

        // Public listing - all published courses
        let courses;
        if (req.user) {
            // If logged in, include enrollment status
            courses = db.prepare(`
                SELECT 
                    c.*,
                    e.status as enrollment_status,
                    e.enrolled_at
                FROM courses c
                LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
                WHERE c.is_published = 1
                ORDER BY c.created_at DESC
            `).all(req.user.id);
        } else {
            courses = db.prepare(`
                SELECT * FROM courses 
                WHERE is_published = 1
                ORDER BY created_at DESC
            `).all();
        }

        res.json({
            success: true,
            courses: courses.map(formatCourse)
        });

    } catch (err) {
        console.error('Get courses error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת הקורסים'
        });
    }
});

/**
 * GET /api/courses/:id
 * Get course details with lessons
 */
router.get('/:id', optionalAuth, (req, res) => {
    try {
        const { id } = req.params;

        // Get course
        const course = db.prepare(`
            SELECT * FROM courses WHERE id = ?
        `).get(id);

        if (!course) {
            return res.status(404).json({
                success: false,
                error: 'הקורס לא נמצא'
            });
        }

        // Check if course is published or user is admin
        if (!course.is_published && (!req.user || req.user.role !== 'admin')) {
            return res.status(404).json({
                success: false,
                error: 'הקורס לא נמצא'
            });
        }

        // Get enrollment status if user is logged in
        let enrollment = null;
        let progress = {};
        
        if (req.user) {
            enrollment = db.prepare(`
                SELECT * FROM enrollments 
                WHERE user_id = ? AND course_id = ?
            `).get(req.user.id, id);

            // Get lesson progress
            const progressRows = db.prepare(`
                SELECT lesson_id, completed, watched_seconds 
                FROM progress 
                WHERE user_id = ? AND course_id = ?
            `).all(req.user.id, id);

            progressRows.forEach(p => {
                progress[p.lesson_id] = {
                    completed: !!p.completed,
                    watchedSeconds: p.watched_seconds
                };
            });
        }

        // Get lessons
        const lessons = db.prepare(`
            SELECT id, title, description, duration_seconds, lesson_order, is_free
            FROM lessons 
            WHERE course_id = ?
            ORDER BY lesson_order ASC
        `).all(id);

        // Only include video_url if user is enrolled or lesson is free
        const isEnrolled = enrollment && enrollment.status === 'active';
        const formattedLessons = lessons.map(lesson => {
            const lessonData = {
                id: lesson.id,
                title: lesson.title,
                description: lesson.description,
                durationSeconds: lesson.duration_seconds,
                order: lesson.lesson_order,
                isFree: !!lesson.is_free,
                isLocked: !isEnrolled && !lesson.is_free,
                progress: progress[lesson.id] || { completed: false, watchedSeconds: 0 }
            };

            // Include video URL only if accessible
            if (isEnrolled || lesson.is_free) {
                const fullLesson = db.prepare('SELECT video_url FROM lessons WHERE id = ?').get(lesson.id);
                lessonData.videoUrl = fullLesson.video_url;
            }

            return lessonData;
        });

        // Calculate overall progress
        const completedLessons = Object.values(progress).filter(p => p.completed).length;
        const totalLessons = lessons.length;
        const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        res.json({
            success: true,
            course: {
                ...formatCourse(course),
                isEnrolled,
                enrollmentStatus: enrollment?.status || null,
                enrolledAt: enrollment?.enrolled_at || null,
                expiresAt: enrollment?.expires_at || null
            },
            lessons: formattedLessons,
            progress: {
                completedLessons,
                totalLessons,
                percent: progressPercent
            }
        });

    } catch (err) {
        console.error('Get course error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת הקורס'
        });
    }
});

/**
 * POST /api/courses/:id/enroll
 * Enroll in a course (simplified - in production would integrate with payment)
 */
router.post('/:id/enroll', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { paymentId } = req.body; // For future payment integration

        // Check if course exists and is published
        const course = db.prepare('SELECT * FROM courses WHERE id = ? AND is_published = 1').get(id);
        if (!course) {
            return res.status(404).json({
                success: false,
                error: 'הקורס לא נמצא'
            });
        }

        // Check if already enrolled
        const existing = db.prepare(`
            SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?
        `).get(req.user.id, id);

        if (existing) {
            if (existing.status === 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'את/ה כבר רשום/ה לקורס זה'
                });
            }
            
            // Reactivate expired enrollment
            db.prepare(`
                UPDATE enrollments 
                SET status = 'active', enrolled_at = strftime('%s', 'now'), expires_at = NULL
                WHERE id = ?
            `).run(existing.id);
        } else {
            // Create new enrollment
            const enrollmentId = uuidv4();
            db.prepare(`
                INSERT INTO enrollments (id, user_id, course_id, payment_id)
                VALUES (?, ?, ?, ?)
            `).run(enrollmentId, req.user.id, id, paymentId || null);
        }

        res.json({
            success: true,
            message: 'נרשמת לקורס בהצלחה! בהצלחה בלמידה 🚀'
        });

    } catch (err) {
        console.error('Enroll error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בהרשמה לקורס'
        });
    }
});

/**
 * GET /api/courses/:id/lesson/:lessonId
 * Get specific lesson details (for enrolled users or free lessons)
 */
router.get('/:id/lesson/:lessonId', optionalAuth, (req, res) => {
    try {
        const { id, lessonId } = req.params;

        // Get lesson
        const lesson = db.prepare(`
            SELECT * FROM lessons WHERE id = ? AND course_id = ?
        `).get(lessonId, id);

        if (!lesson) {
            return res.status(404).json({
                success: false,
                error: 'השיעור לא נמצא'
            });
        }

        // Check access
        let isEnrolled = false;
        let progress = null;

        if (req.user) {
            const enrollment = db.prepare(`
                SELECT status FROM enrollments WHERE user_id = ? AND course_id = ?
            `).get(req.user.id, id);
            isEnrolled = enrollment?.status === 'active';

            progress = db.prepare(`
                SELECT completed, watched_seconds, completed_at 
                FROM progress WHERE user_id = ? AND lesson_id = ?
            `).get(req.user.id, lessonId);
        }

        // Check if user can access this lesson
        if (!lesson.is_free && !isEnrolled) {
            return res.status(403).json({
                success: false,
                error: 'יש להירשם לקורס כדי לצפות בשיעור זה'
            });
        }

        // Get prev/next lessons
        const prevLesson = db.prepare(`
            SELECT id, title FROM lessons 
            WHERE course_id = ? AND lesson_order < ?
            ORDER BY lesson_order DESC LIMIT 1
        `).get(id, lesson.lesson_order);

        const nextLesson = db.prepare(`
            SELECT id, title FROM lessons 
            WHERE course_id = ? AND lesson_order > ?
            ORDER BY lesson_order ASC LIMIT 1
        `).get(id, lesson.lesson_order);

        res.json({
            success: true,
            lesson: {
                id: lesson.id,
                title: lesson.title,
                description: lesson.description,
                videoUrl: lesson.video_url,
                durationSeconds: lesson.duration_seconds,
                order: lesson.lesson_order,
                isFree: !!lesson.is_free,
                resources: lesson.resources ? JSON.parse(lesson.resources) : []
            },
            progress: progress ? {
                completed: !!progress.completed,
                watchedSeconds: progress.watched_seconds,
                completedAt: progress.completed_at
            } : null,
            navigation: {
                previous: prevLesson ? { id: prevLesson.id, title: prevLesson.title } : null,
                next: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null
            }
        });

    } catch (err) {
        console.error('Get lesson error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת השיעור'
        });
    }
});

// Helper function to format course object
function formatCourse(course) {
    return {
        id: course.id,
        title: course.title,
        description: course.description,
        image: course.image,
        price: course.price,
        lessonsCount: course.lessons_count,
        durationHours: course.duration_hours,
        level: course.level,
        category: course.category,
        isPublished: !!course.is_published,
        createdAt: course.created_at,
        // Enrollment info if available
        enrollmentStatus: course.enrollment_status || null,
        enrolledAt: course.enrolled_at || null,
        expiresAt: course.expires_at || null,
        totalLessons: course.total_lessons || null,
        completedLessons: course.completed_lessons || null
    };
}

module.exports = router;
