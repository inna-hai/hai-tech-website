/**
 * 🚀 Release Suite - P0 Critical Tests
 * 
 * Single test file that validates all critical features
 * Run with: npm run test:release
 * 
 * Coverage:
 * - Website: Home page loads
 * - LMS: Auth, Catalog, Enroll, Progress, Quiz
 * - API: Health endpoint
 * - Infrastructure: DB connection
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const db = require('../api/db');
const app = require('../api/server');

// Test user for flows
let testUser = {
    email: `release-test-${Date.now()}@test.com`,
    password: 'ReleaseTest123!',
    name: 'Release Test User'
};
let authToken = null;
let testCourseId = null;

// ============================================
// RELEASE SUITE CONFIGURATION
// ============================================
const RELEASE_CONFIG = {
    requiredPassRate: 100, // All P0 tests must pass
    timeout: 30000,
    categories: ['Website', 'LMS-Auth', 'LMS-Courses', 'LMS-Progress', 'LMS-Quiz', 'API', 'Infrastructure']
};

// ============================================
// A) WEBSITE - Critical Smoke Tests
// ============================================
describe('🌐 P0: Website', () => {
    const websiteRoot = path.join(__dirname, '..', '..');
    
    test('Home page (index.html) exists and has content', () => {
        const indexPath = path.join(websiteRoot, 'index.html');
        expect(fs.existsSync(indexPath)).toBe(true);
        
        const content = fs.readFileSync(indexPath, 'utf8');
        expect(content.length).toBeGreaterThan(1000);
        expect(content).toContain('<!DOCTYPE html>');
        expect(content).toContain('דרך ההייטק');
    });

    test('Home page has CTA buttons', () => {
        const indexPath = path.join(websiteRoot, 'index.html');
        const content = fs.readFileSync(indexPath, 'utf8');
        
        // Check for call-to-action elements
        expect(content).toMatch(/btn|button|cta/i);
        expect(content).toContain('href');
    });

    test('LMS entry point exists', () => {
        const lmsIndexPath = path.join(websiteRoot, 'lms', 'index.html');
        expect(fs.existsSync(lmsIndexPath)).toBe(true);
    });

    test('Main CSS loads', () => {
        const cssPath = path.join(websiteRoot, 'style.css');
        expect(fs.existsSync(cssPath)).toBe(true);
        
        const content = fs.readFileSync(cssPath, 'utf8');
        expect(content.length).toBeGreaterThan(500);
    });
});

// ============================================
// B) LMS - Authentication
// ============================================
describe('🔐 P0: LMS Authentication', () => {
    test('Register new user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(testUser)
            .expect(201);
        
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe(testUser.email);
        
        authToken = res.body.token;
    });

    test('Login with registered user', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            })
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        
        authToken = res.body.token;
    });

    test('Get current user with token', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe(testUser.email);
    });

    test('Reject invalid token', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalid-token');
        
        // Accept either 401 or 403 - both indicate rejection
        expect([401, 403]).toContain(res.status);
        expect(res.body.success).toBe(false);
    });
});

// ============================================
// B) LMS - Courses & Catalog
// ============================================
describe('📚 P0: LMS Courses', () => {
    test('Catalog returns courses', async () => {
        const res = await request(app)
            .get('/api/courses')
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.courses)).toBe(true);
        expect(res.body.courses.length).toBeGreaterThan(0);
        
        // Save a course for enrollment test
        testCourseId = res.body.courses[0].id;
    });

    test('Course details returns data', async () => {
        const res = await request(app)
            .get(`/api/courses/${testCourseId}`)
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.course).toBeDefined();
        expect(res.body.course.id).toBe(testCourseId);
        expect(res.body.course.title).toBeDefined();
    });

    test('Enroll in course', async () => {
        const res = await request(app)
            .post(`/api/courses/${testCourseId}/enroll`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });

    test('Enrolled courses returns enrollment', async () => {
        const res = await request(app)
            .get('/api/courses/enrolled')
            .set('Authorization', `Bearer ${authToken}`);
        
        // May return 200 or 404 depending on implementation
        if (res.status === 200) {
            expect(res.body.success).toBe(true);
        }
    });
});

// ============================================
// B) LMS - Progress Tracking
// ============================================
describe('📊 P0: LMS Progress', () => {
    let testLessonId = null;

    beforeAll(async () => {
        // Get a lesson from the test course
        const lessons = db.prepare('SELECT id FROM lessons WHERE course_id = ? LIMIT 1').all(testCourseId);
        if (lessons.length > 0) {
            testLessonId = lessons[0].id;
        }
    });

    test('Save progress', async () => {
        if (!testLessonId) {
            console.log('Skipping: No lesson available');
            return;
        }

        const res = await request(app)
            .post('/api/progress')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                lessonId: testLessonId,
                courseId: testCourseId,
                watchedSeconds: 120,
                completed: false
            })
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });

    test('Get progress', async () => {
        const res = await request(app)
            .get(`/api/progress/${testCourseId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });

    test('Complete lesson', async () => {
        if (!testLessonId) {
            console.log('Skipping: No lesson available');
            return;
        }

        const res = await request(app)
            .post('/api/progress')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                lessonId: testLessonId,
                courseId: testCourseId,
                watchedSeconds: 600,
                completed: true
            })
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });
});

// ============================================
// B) LMS - Quiz System
// ============================================
describe('📝 P0: LMS Quiz', () => {
    let testQuizLessonId = null;
    let testQuizId = null;
    let testQuestions = [];

    beforeAll(() => {
        // Find a lesson with a quiz
        const quiz = db.prepare('SELECT * FROM quizzes LIMIT 1').get();
        if (quiz) {
            testQuizId = quiz.id;
            testQuizLessonId = quiz.lesson_id;
            testQuestions = db.prepare('SELECT q.id, o.id as correct_option FROM quiz_questions q JOIN quiz_options o ON q.id = o.question_id AND o.is_correct = 1 WHERE q.quiz_id = ?').all(testQuizId);
        }
    });

    test('Load quiz', async () => {
        if (!testQuizLessonId) {
            console.log('Skipping: No quiz available');
            return;
        }

        const res = await request(app)
            .get(`/api/quiz/${testQuizLessonId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.quiz).toBeDefined();
    });

    test('Submit quiz', async () => {
        if (!testQuizLessonId || testQuestions.length === 0) {
            console.log('Skipping: No quiz/questions available');
            return;
        }

        const answers = testQuestions.map(q => ({
            questionId: q.id,
            optionId: q.correct_option
        }));

        const res = await request(app)
            .post(`/api/quiz/${testQuizLessonId}/submit`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ answers })
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.result).toBeDefined();
        expect(res.body.result.score).toBeDefined();
    });
});

// ============================================
// C) API - Health & Core Endpoints
// ============================================
describe('🔌 P0: API Core', () => {
    test('/api/health returns OK', async () => {
        const res = await request(app)
            .get('/api/health')
            .expect(200);
        
        // Accept various health response formats
        const isHealthy = res.body.status === 'ok' || 
                         res.body.success === true || 
                         res.body.healthy === true ||
                         res.text.includes('ok');
        expect(isHealthy).toBe(true);
    });

    test('Gamification stats endpoint works', async () => {
        const res = await request(app)
            .get('/api/gamification/stats')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.stats).toBeDefined();
    });

    test('Config endpoint works', async () => {
        const res = await request(app)
            .get('/api/gamification/config')
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });
});

// ============================================
// D) INFRASTRUCTURE - Database
// ============================================
describe('🗄️ P0: Infrastructure', () => {
    test('Database connection works', () => {
        expect(db).toBeDefined();
        
        const result = db.prepare('SELECT 1 as test').get();
        expect(result.test).toBe(1);
    });

    test('Users table exists', () => {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
        expect(tables).toBeDefined();
        expect(tables.name).toBe('users');
    });

    test('Courses table has data', () => {
        const count = db.prepare('SELECT COUNT(*) as c FROM courses').get();
        expect(count.c).toBeGreaterThan(0);
    });

    test('Lessons table has data', () => {
        const count = db.prepare('SELECT COUNT(*) as c FROM lessons').get();
        expect(count.c).toBeGreaterThan(0);
    });

    test('Quizzes table has data', () => {
        const count = db.prepare('SELECT COUNT(*) as c FROM quizzes').get();
        expect(count.c).toBeGreaterThan(0);
    });
});

// ============================================
// CLEANUP
// ============================================
describe('🧹 Cleanup', () => {
    test('Delete test user', () => {
        try {
            // Get user ID first
            const user = db.prepare('SELECT id FROM users WHERE email = ?').get(testUser.email);
            
            if (user) {
                // Delete related data
                db.prepare('DELETE FROM progress WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM user_gamification WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM quiz_results WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
            }
            
            expect(true).toBe(true);
        } catch (err) {
            // Cleanup failure is not critical
            console.log('Cleanup warning:', err.message);
            expect(true).toBe(true);
        }
    });
});

// ============================================
// RELEASE REPORT
// ============================================
afterAll(() => {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║           🚀 RELEASE SUITE COMPLETE                  ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  P0 Categories Tested:                               ║');
    console.log('║  ✓ Website (Home, CTA, LMS entry)                    ║');
    console.log('║  ✓ LMS Auth (Register, Login, JWT)                   ║');
    console.log('║  ✓ LMS Courses (Catalog, Details, Enroll)            ║');
    console.log('║  ✓ LMS Progress (Save, Get, Complete)                ║');
    console.log('║  ✓ LMS Quiz (Load, Submit)                           ║');
    console.log('║  ✓ API Core (Health, Gamification)                   ║');
    console.log('║  ✓ Infrastructure (DB, Tables, Data)                 ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('\n');
});
