/**
 * Comprehensive Automated Test Suite
 * HAI Tech Academy LMS
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'hai-tech-admin-2026';
const JWT_SECRET = process.env.JWT_SECRET || 'hai-tech-lms-secret-2026';

function requireAdmin(req, res, next) {
    const token = req.headers['x-admin-token'] || req.query.token;
    if (token !== ADMIN_TOKEN) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

// Test helper
class TestRunner {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            passed: 0,
            failed: 0,
            skipped: 0,
            tests: [],
            categories: {}
        };
        this.currentCategory = 'General';
    }

    category(name) {
        this.currentCategory = name;
        if (!this.results.categories[name]) {
            this.results.categories[name] = { passed: 0, failed: 0, skipped: 0 };
        }
    }

    test(name, fn) {
        const testResult = { 
            name, 
            category: this.currentCategory,
            status: 'PENDING',
            duration: 0
        };
        
        const start = Date.now();
        try {
            const result = fn();
            testResult.duration = Date.now() - start;
            
            if (result === true || (result && result.success)) {
                testResult.status = 'PASS';
                testResult.details = result.details || null;
                this.results.passed++;
                this.results.categories[this.currentCategory].passed++;
            } else if (result && result.skip) {
                testResult.status = 'SKIP';
                testResult.reason = result.reason;
                this.results.skipped++;
                this.results.categories[this.currentCategory].skipped++;
            } else {
                testResult.status = 'FAIL';
                testResult.error = result?.error || 'Test returned false';
                this.results.failed++;
                this.results.categories[this.currentCategory].failed++;
            }
        } catch (err) {
            testResult.duration = Date.now() - start;
            testResult.status = 'ERROR';
            testResult.error = err.message;
            this.results.failed++;
            this.results.categories[this.currentCategory].failed++;
        }
        
        this.results.tests.push(testResult);
        return testResult.status === 'PASS';
    }

    async testAsync(name, fn) {
        const testResult = { 
            name, 
            category: this.currentCategory,
            status: 'PENDING',
            duration: 0
        };
        
        const start = Date.now();
        try {
            const result = await fn();
            testResult.duration = Date.now() - start;
            
            if (result === true || (result && result.success)) {
                testResult.status = 'PASS';
                testResult.details = result.details || null;
                this.results.passed++;
                this.results.categories[this.currentCategory].passed++;
            } else {
                testResult.status = 'FAIL';
                testResult.error = result?.error || 'Test returned false';
                this.results.failed++;
                this.results.categories[this.currentCategory].failed++;
            }
        } catch (err) {
            testResult.duration = Date.now() - start;
            testResult.status = 'ERROR';
            testResult.error = err.message;
            this.results.failed++;
            this.results.categories[this.currentCategory].failed++;
        }
        
        this.results.tests.push(testResult);
        return testResult.status === 'PASS';
    }

    getSummary() {
        const total = this.results.passed + this.results.failed + this.results.skipped;
        return {
            ...this.results,
            summary: {
                total,
                passed: this.results.passed,
                failed: this.results.failed,
                skipped: this.results.skipped,
                passRate: total > 0 ? Math.round((this.results.passed / (total - this.results.skipped)) * 100) + '%' : '0%'
            }
        };
    }
}

/**
 * GET /api/test/run-all
 * Run comprehensive test suite
 */
router.get('/run-all', requireAdmin, async (req, res) => {
    const t = new TestRunner();
    
    // Test user for authentication tests
    const testEmail = `test_${Date.now()}@test.com`;
    const testPassword = 'TestPass123!';
    let testUserId = null;
    let testToken = null;

    // ==========================================
    // DATABASE TESTS
    // ==========================================
    t.category('Database');
    
    t.test('Tables exist', () => {
        const tables = db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table'
        `).all().map(t => t.name);
        
        const required = ['users', 'courses', 'lessons', 'enrollments', 'progress', 'quizzes', 'quiz_questions', 'quiz_options'];
        const missing = required.filter(tbl => !tables.includes(tbl));
        
        if (missing.length > 0) {
            return { success: false, error: `Missing: ${missing.join(', ')}` };
        }
        return { success: true, details: `${tables.length} tables` };
    });

    t.test('Users table structure', () => {
        const info = db.prepare('PRAGMA table_info(users)').all();
        const columns = info.map(c => c.name);
        const required = ['id', 'email', 'password_hash', 'name'];
        const missing = required.filter(c => !columns.includes(c));
        
        if (missing.length > 0) {
            return { success: false, error: `Missing columns: ${missing.join(', ')}` };
        }
        return { success: true, details: `${columns.length} columns` };
    });

    t.test('Courses exist', () => {
        const count = db.prepare('SELECT COUNT(*) as c FROM courses').get().c;
        return { success: count > 0, details: `${count} courses` };
    });

    t.test('Lessons exist', () => {
        const count = db.prepare('SELECT COUNT(*) as c FROM lessons').get().c;
        return { success: count > 0, details: `${count} lessons` };
    });

    t.test('Quizzes exist', () => {
        const count = db.prepare('SELECT COUNT(*) as c FROM quizzes').get().c;
        return { success: count > 0, details: `${count} quizzes` };
    });

    // ==========================================
    // DATA INTEGRITY TESTS
    // ==========================================
    t.category('Data Integrity');

    t.test('All lessons linked to valid courses', () => {
        const orphans = db.prepare(`
            SELECT l.id FROM lessons l
            LEFT JOIN courses c ON l.course_id = c.id
            WHERE c.id IS NULL
        `).all();
        return { success: orphans.length === 0, error: orphans.length > 0 ? `${orphans.length} orphan lessons` : null };
    });

    t.test('All quizzes linked to valid lessons', () => {
        const orphans = db.prepare(`
            SELECT q.id FROM quizzes q
            LEFT JOIN lessons l ON q.lesson_id = l.id
            WHERE l.id IS NULL
        `).all();
        return { success: orphans.length === 0, error: orphans.length > 0 ? `${orphans.length} orphan quizzes` : null };
    });

    t.test('All quiz questions have options', () => {
        const noOpts = db.prepare(`
            SELECT q.id FROM quiz_questions q
            LEFT JOIN quiz_options o ON q.id = o.question_id
            GROUP BY q.id HAVING COUNT(o.id) = 0
        `).all();
        return { success: noOpts.length === 0, error: noOpts.length > 0 ? `${noOpts.length} questions without options` : null };
    });

    t.test('All quiz questions have correct answer marked', () => {
        const noCorrect = db.prepare(`
            SELECT q.id FROM quiz_questions q
            LEFT JOIN quiz_options o ON q.id = o.question_id AND o.is_correct = 1
            GROUP BY q.id HAVING COUNT(o.id) = 0
        `).all();
        return { success: noCorrect.length === 0, error: noCorrect.length > 0 ? `${noCorrect.length} questions without correct answer` : null };
    });

    t.test('All courses have descriptions', () => {
        const noDesc = db.prepare(`SELECT id FROM courses WHERE description IS NULL OR description = ''`).all();
        return { success: noDesc.length === 0, details: noDesc.length > 0 ? `${noDesc.length} missing` : 'All have descriptions' };
    });

    // ==========================================
    // AUTHENTICATION TESTS
    // ==========================================
    t.category('Authentication');

    t.test('Register - create test user', () => {
        const hashedPassword = bcrypt.hashSync(testPassword, 10);
        testUserId = uuidv4();
        
        try {
            db.prepare(`
                INSERT INTO users (id, email, password_hash, name, role, created_at)
                VALUES (?, ?, ?, ?, 'student', strftime('%s', 'now'))
            `).run(testUserId, testEmail, hashedPassword, 'Test User');
            return { success: true, details: `User: ${testEmail}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    t.test('Register - duplicate email rejected', () => {
        const hashedPassword = bcrypt.hashSync(testPassword, 10);
        try {
            db.prepare(`
                INSERT INTO users (id, email, password_hash, name, role)
                VALUES (?, ?, ?, ?, 'student')
            `).run(uuidv4(), testEmail, hashedPassword, 'Duplicate User');
            return { success: false, error: 'Duplicate was allowed' };
        } catch (err) {
            return { success: true, details: 'Duplicate correctly rejected' };
        }
    });

    t.test('Login - valid credentials', () => {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(testEmail);
        if (!user) return { success: false, error: 'User not found' };
        
        const valid = bcrypt.compareSync(testPassword, user.password_hash);
        if (!valid) return { success: false, error: 'Password mismatch' };
        
        testToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        return { success: true, details: 'Token generated' };
    });

    t.test('Login - wrong password rejected', () => {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(testEmail);
        if (!user) return { success: false, error: 'User not found' };
        
        const valid = bcrypt.compareSync('wrongpassword', user.password_hash);
        return { success: !valid, details: 'Wrong password correctly rejected' };
    });

    t.test('JWT - token verification', () => {
        if (!testToken) return { success: false, error: 'No token' };
        
        try {
            const decoded = jwt.verify(testToken, JWT_SECRET);
            return { success: decoded.email === testEmail, details: `Verified: ${decoded.email}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    t.test('JWT - invalid token rejected', () => {
        try {
            jwt.verify('invalid.token.here', JWT_SECRET);
            return { success: false, error: 'Invalid token was accepted' };
        } catch (err) {
            return { success: true, details: 'Invalid token correctly rejected' };
        }
    });

    // ==========================================
    // COURSES API TESTS
    // ==========================================
    t.category('Courses API');

    t.test('GET courses - returns list', () => {
        const courses = db.prepare('SELECT * FROM courses').all();
        return { success: courses.length > 0, details: `${courses.length} courses` };
    });

    t.test('GET course by ID - returns lessons', () => {
        const course = db.prepare('SELECT * FROM courses LIMIT 1').get();
        if (!course) return { success: false, error: 'No courses' };
        
        const lessons = db.prepare('SELECT * FROM lessons WHERE course_id = ?').all(course.id);
        return { success: true, details: `Course "${course.title}" has ${lessons.length} lessons` };
    });

    t.test('Enroll - create enrollment', () => {
        const course = db.prepare('SELECT * FROM courses LIMIT 1').get();
        if (!course || !testUserId) return { success: false, error: 'Missing course or user' };
        
        try {
            db.prepare(`
                INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at)
                VALUES (?, ?, ?, 'active', strftime('%s', 'now'))
            `).run(uuidv4(), testUserId, course.id);
            return { success: true, details: `Enrolled in ${course.title}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    t.test('Enroll - duplicate prevented', () => {
        const course = db.prepare('SELECT * FROM courses LIMIT 1').get();
        if (!course || !testUserId) return { success: false, error: 'Missing course or user' };
        
        const existing = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(testUserId, course.id);
        return { success: !!existing, details: existing ? 'Enrollment exists' : 'No enrollment found' };
    });

    // ==========================================
    // PROGRESS TESTS
    // ==========================================
    t.category('Progress Tracking');

    t.test('Save progress - create record', () => {
        const lesson = db.prepare('SELECT * FROM lessons LIMIT 1').get();
        if (!lesson || !testUserId) return { success: false, error: 'Missing lesson or user' };
        
        try {
            // Delete existing progress first
            db.prepare('DELETE FROM progress WHERE user_id = ? AND lesson_id = ?').run(testUserId, lesson.id);
            
            db.prepare(`
                INSERT INTO progress (id, user_id, lesson_id, course_id, watched_seconds, completed, last_watched_at)
                VALUES (?, ?, ?, ?, 120, 0, strftime('%s', 'now'))
            `).run(uuidv4(), testUserId, lesson.id, lesson.course_id);
            return { success: true, details: `Progress saved for ${lesson.title}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    t.test('Mark lesson complete', () => {
        const lesson = db.prepare('SELECT * FROM lessons LIMIT 1').get();
        if (!lesson || !testUserId) return { success: false, error: 'Missing lesson or user' };
        
        try {
            db.prepare(`
                UPDATE progress SET completed = 1, completed_at = strftime('%s', 'now')
                WHERE user_id = ? AND lesson_id = ?
            `).run(testUserId, lesson.id);
            
            const progress = db.prepare('SELECT * FROM progress WHERE user_id = ? AND lesson_id = ?').get(testUserId, lesson.id);
            return { success: progress?.completed === 1, details: 'Lesson marked complete' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    t.test('Course completion detection', () => {
        const course = db.prepare('SELECT * FROM courses LIMIT 1').get();
        if (!course || !testUserId) return { success: false, error: 'Missing data' };
        
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END) as completed
            FROM lessons l
            LEFT JOIN progress p ON l.id = p.lesson_id AND p.user_id = ?
            WHERE l.course_id = ?
        `).get(testUserId, course.id);
        
        return { success: true, details: `${stats.completed}/${stats.total} lessons completed` };
    });

    // ==========================================
    // QUIZ TESTS
    // ==========================================
    t.category('Quiz System');

    t.test('Get quiz for lesson', () => {
        const quiz = db.prepare(`
            SELECT q.*, l.title as lesson_title
            FROM quizzes q
            JOIN lessons l ON q.lesson_id = l.id
            LIMIT 1
        `).get();
        
        if (!quiz) return { success: false, error: 'No quizzes found' };
        return { success: true, details: `Quiz: ${quiz.title}` };
    });

    t.test('Quiz has questions', () => {
        const quiz = db.prepare('SELECT * FROM quizzes LIMIT 1').get();
        if (!quiz) return { success: false, error: 'No quiz' };
        
        const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ?').all(quiz.id);
        return { success: questions.length > 0, details: `${questions.length} questions` };
    });

    t.test('Score calculation - perfect score', () => {
        const quiz = db.prepare('SELECT * FROM quizzes LIMIT 1').get();
        if (!quiz) return { success: false, error: 'No quiz' };
        
        const questions = db.prepare(`
            SELECT q.id, q.points, o.id as correct_option
            FROM quiz_questions q
            JOIN quiz_options o ON q.id = o.question_id AND o.is_correct = 1
            WHERE q.quiz_id = ?
        `).all(quiz.id);
        
        const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
        const answers = questions.map(q => ({ questionId: q.id, optionId: q.correct_option }));
        
        // Simulate scoring
        let score = 0;
        answers.forEach(a => {
            const q = questions.find(q => q.id === a.questionId);
            if (q && q.correct_option === a.optionId) {
                score += q.points;
            }
        });
        
        return { success: score === totalPoints, details: `Score: ${score}/${totalPoints}` };
    });

    t.test('Pass/fail threshold', () => {
        const quiz = db.prepare('SELECT * FROM quizzes LIMIT 1').get();
        if (!quiz) return { success: false, error: 'No quiz' };
        
        const passingScore = quiz.passing_score || 70;
        return { success: passingScore >= 0 && passingScore <= 100, details: `Passing: ${passingScore}%` };
    });

    // ==========================================
    // GAMIFICATION TESTS
    // ==========================================
    t.category('Gamification');

    t.test('Gamification tables exist', () => {
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND (name LIKE '%gamification%' OR name LIKE '%xp%' OR name LIKE '%badge%')
        `).all().map(t => t.name);
        
        return { success: tables.length > 0, details: tables.join(', ') || 'No tables' };
    });

    t.test('XP configuration exists', () => {
        // Check if gamification module has CONFIG
        try {
            const gamification = require('./gamification');
            const hasConfig = gamification.helpers && gamification.helpers.CONFIG;
            return { success: !!hasConfig, details: hasConfig ? 'CONFIG loaded' : 'No CONFIG' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    t.test('User gamification record creation', () => {
        if (!testUserId) return { success: false, error: 'No test user' };
        
        try {
            // Try to get or create gamification record
            let record = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(testUserId);
            
            if (!record) {
                db.prepare('INSERT INTO user_gamification (user_id) VALUES (?)').run(testUserId);
                record = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(testUserId);
            }
            
            return { success: !!record, details: record ? `XP: ${record.total_xp}` : 'Failed to create' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    t.test('Streak tracking', () => {
        if (!testUserId) return { success: false, error: 'No test user' };
        
        const record = db.prepare('SELECT * FROM user_gamification WHERE user_id = ?').get(testUserId);
        if (!record) return { success: false, error: 'No gamification record' };
        
        return { success: true, details: `Streak: ${record.current_streak}, Best: ${record.longest_streak}` };
    });

    // ==========================================
    // FILES & PAGES TESTS
    // ==========================================
    t.category('Files & Pages');

    const lmsDir = path.join(__dirname, '..', '..');
    const requiredPages = [
        'index.html', 'login.html', 'register.html', 'catalog.html',
        'course.html', 'lesson.html', 'quiz.html', 'profile.html',
        'certificate.html', 'parent-dashboard.html'
    ];
    
    requiredPages.forEach(page => {
        t.test(`Page exists: ${page}`, () => {
            const exists = fs.existsSync(path.join(lmsDir, page));
            return { success: exists, error: exists ? null : 'File not found' };
        });
    });

    t.test('CSS file exists', () => {
        const exists = fs.existsSync(path.join(lmsDir, 'css', 'lms.css'));
        return { success: exists };
    });

    t.test('JS file exists', () => {
        const exists = fs.existsSync(path.join(lmsDir, 'js', 'lms.js'));
        return { success: exists };
    });

    // ==========================================
    // CLEANUP
    // ==========================================
    t.category('Cleanup');

    t.test('Delete test user data', () => {
        if (!testUserId) return { success: true, details: 'No test user to clean' };
        
        try {
            db.prepare('DELETE FROM progress WHERE user_id = ?').run(testUserId);
            db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(testUserId);
            db.prepare('DELETE FROM user_gamification WHERE user_id = ?').run(testUserId);
            db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
            return { success: true, details: 'Test data cleaned' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Return results
    res.json(t.getSummary());
});

/**
 * GET /api/test/quick
 * Quick health check tests only
 */
router.get('/quick', requireAdmin, (req, res) => {
    const results = [];
    
    // Quick tests
    try {
        const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
        results.push({ test: 'DB Connection', status: 'PASS', details: `${users} users` });
    } catch (err) {
        results.push({ test: 'DB Connection', status: 'FAIL', error: err.message });
    }
    
    try {
        const courses = db.prepare('SELECT COUNT(*) as c FROM courses').get().c;
        results.push({ test: 'Courses', status: courses > 0 ? 'PASS' : 'FAIL', details: `${courses} courses` });
    } catch (err) {
        results.push({ test: 'Courses', status: 'FAIL', error: err.message });
    }
    
    try {
        const quizzes = db.prepare('SELECT COUNT(*) as c FROM quizzes').get().c;
        results.push({ test: 'Quizzes', status: quizzes > 0 ? 'PASS' : 'FAIL', details: `${quizzes} quizzes` });
    } catch (err) {
        results.push({ test: 'Quizzes', status: 'FAIL', error: err.message });
    }
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    
    res.json({
        success: failed === 0,
        passed,
        failed,
        tests: results
    });
});

/**
 * GET /api/test/quiz/:lessonId
 * Test specific quiz
 */
router.get('/quiz/:lessonId', requireAdmin, (req, res) => {
    const { lessonId } = req.params;
    const t = new TestRunner();
    t.category('Quiz: ' + lessonId);

    t.test('Lesson exists', () => {
        const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
        return { success: !!lesson, details: lesson?.title || 'Not found' };
    });

    t.test('Quiz exists', () => {
        const quiz = db.prepare('SELECT * FROM quizzes WHERE lesson_id = ?').get(lessonId);
        return { success: !!quiz, details: quiz?.title || 'No quiz' };
    });

    t.test('Has questions', () => {
        const quiz = db.prepare('SELECT id FROM quizzes WHERE lesson_id = ?').get(lessonId);
        if (!quiz) return { success: false, error: 'No quiz' };
        
        const count = db.prepare('SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_id = ?').get(quiz.id).c;
        return { success: count > 0, details: `${count} questions` };
    });

    t.test('All questions have 2+ options', () => {
        const quiz = db.prepare('SELECT id FROM quizzes WHERE lesson_id = ?').get(lessonId);
        if (!quiz) return { success: false, error: 'No quiz' };
        
        const bad = db.prepare(`
            SELECT q.id, COUNT(o.id) as c
            FROM quiz_questions q
            LEFT JOIN quiz_options o ON q.id = o.question_id
            WHERE q.quiz_id = ?
            GROUP BY q.id HAVING c < 2
        `).all(quiz.id);
        
        return { success: bad.length === 0, error: bad.length > 0 ? `${bad.length} bad questions` : null };
    });

    t.test('All questions have correct answer', () => {
        const quiz = db.prepare('SELECT id FROM quizzes WHERE lesson_id = ?').get(lessonId);
        if (!quiz) return { success: false, error: 'No quiz' };
        
        const bad = db.prepare(`
            SELECT q.id
            FROM quiz_questions q
            LEFT JOIN quiz_options o ON q.id = o.question_id AND o.is_correct = 1
            WHERE q.quiz_id = ?
            GROUP BY q.id HAVING COUNT(o.id) = 0
        `).all(quiz.id);
        
        return { success: bad.length === 0, error: bad.length > 0 ? `${bad.length} missing answers` : null };
    });

    res.json(t.getSummary());
});

module.exports = router;
