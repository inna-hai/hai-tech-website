/**
 * Admin API Routes
 * Allows management of LMS via HTTP (for OpenClaw integration)
 */

const express = require('express');
const db = require('../db');
const router = express.Router();

// Simple admin token (should be in env in production)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'hai-tech-admin-2026';

// Middleware to check admin token
function requireAdmin(req, res, next) {
    const token = req.headers['x-admin-token'] || req.query.token;
    if (token !== ADMIN_TOKEN) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

/**
 * GET /api/admin/query
 * Run a SELECT query (read-only)
 */
router.get('/query', requireAdmin, (req, res) => {
    try {
        const { sql } = req.query;
        
        if (!sql) {
            return res.status(400).json({ success: false, error: 'Missing sql parameter' });
        }
        
        // Only allow SELECT queries for safety
        if (!sql.trim().toUpperCase().startsWith('SELECT')) {
            return res.status(400).json({ success: false, error: 'Only SELECT queries allowed via GET' });
        }
        
        const results = db.prepare(sql).all();
        res.json({ success: true, results, count: results.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/admin/execute
 * Run INSERT/UPDATE/DELETE queries
 */
router.post('/execute', requireAdmin, (req, res) => {
    try {
        const { sql, params } = req.body;
        
        if (!sql) {
            return res.status(400).json({ success: false, error: 'Missing sql' });
        }
        
        const result = db.prepare(sql).run(...(params || []));
        res.json({ success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/admin/tables
 * List all tables
 */
router.get('/tables', requireAdmin, (req, res) => {
    try {
        const tables = db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
        `).all();
        res.json({ success: true, tables: tables.map(t => t.name) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/admin/table/:name
 * Get table schema and sample data
 */
router.get('/table/:name', requireAdmin, (req, res) => {
    try {
        const { name } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        
        // Get schema
        const schema = db.prepare(`PRAGMA table_info(${name})`).all();
        
        // Get sample data
        const data = db.prepare(`SELECT * FROM ${name} LIMIT ?`).all(limit);
        
        // Get count
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get();
        
        res.json({ 
            success: true, 
            table: name,
            schema,
            data,
            totalRows: countResult.count
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/admin/quiz/create
 * Create a new quiz for a lesson
 */
router.post('/quiz/create', requireAdmin, (req, res) => {
    try {
        const { lessonId, title, description, passingScore, questions } = req.body;
        
        if (!lessonId || !questions || !questions.length) {
            return res.status(400).json({ success: false, error: 'Missing lessonId or questions' });
        }
        
        const { v4: uuidv4 } = require('uuid');
        
        // Check if lesson exists
        const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
        if (!lesson) {
            return res.status(404).json({ success: false, error: 'Lesson not found' });
        }
        
        // Check if quiz already exists
        const existingQuiz = db.prepare('SELECT * FROM quizzes WHERE lesson_id = ?').get(lessonId);
        if (existingQuiz) {
            return res.status(400).json({ success: false, error: 'Quiz already exists for this lesson', quizId: existingQuiz.id });
        }
        
        // Create quiz
        const quizId = uuidv4();
        db.prepare(`
            INSERT INTO quizzes (id, lesson_id, title, description, passing_score)
            VALUES (?, ?, ?, ?, ?)
        `).run(quizId, lessonId, title || `חידון: ${lesson.title}`, description || '', passingScore || 70);
        
        // Create questions
        questions.forEach((q, qIndex) => {
            const questionId = uuidv4();
            db.prepare(`
                INSERT INTO quiz_questions (id, quiz_id, question_text, question_order, points)
                VALUES (?, ?, ?, ?, ?)
            `).run(questionId, quizId, q.text, qIndex + 1, q.points || 10);
            
            // Create options
            q.options.forEach((opt, optIndex) => {
                db.prepare(`
                    INSERT INTO quiz_options (id, question_id, option_text, option_order, is_correct)
                    VALUES (?, ?, ?, ?, ?)
                `).run(uuidv4(), questionId, opt.text, optIndex + 1, opt.correct ? 1 : 0);
            });
        });
        
        res.json({ success: true, quizId, questionsCreated: questions.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/admin/stats
 * Get LMS statistics
 */
router.get('/stats', requireAdmin, (req, res) => {
    try {
        const stats = {
            users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
            courses: db.prepare('SELECT COUNT(*) as count FROM courses').get().count,
            lessons: db.prepare('SELECT COUNT(*) as count FROM lessons').get().count,
            enrollments: db.prepare('SELECT COUNT(*) as count FROM enrollments').get().count,
            quizzes: db.prepare('SELECT COUNT(*) as count FROM quizzes').get().count,
            progress: db.prepare('SELECT COUNT(*) as count FROM progress WHERE completed = 1').get().count
        };
        
        // Recent activity
        const recentUsers = db.prepare(`
            SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5
        `).all();
        
        res.json({ success: true, stats, recentUsers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/admin/courses
 * List all courses with lesson counts
 */
router.get('/courses', requireAdmin, (req, res) => {
    try {
        const courses = db.prepare(`
            SELECT c.*, COUNT(l.id) as lesson_count
            FROM courses c
            LEFT JOIN lessons l ON l.course_id = c.id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `).all();
        
        res.json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/admin/lessons/:courseId
 * List all lessons for a course
 */
router.get('/lessons/:courseId', requireAdmin, (req, res) => {
    try {
        const { courseId } = req.params;
        
        const lessons = db.prepare(`
            SELECT l.*, 
                   (SELECT COUNT(*) FROM quizzes q WHERE q.lesson_id = l.id) as has_quiz
            FROM lessons l
            WHERE l.course_id = ?
            ORDER BY l.lesson_order ASC
        `).all(courseId);
        
        res.json({ success: true, lessons });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
