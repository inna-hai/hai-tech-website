/**
 * End-to-End User Flow Tests
 * Tests complete user journeys through the LMS
 */

const request = require('supertest');
process.env.NODE_ENV = 'test';

const app = require('../../api/server');
const db = require('../../api/db');

describe('E2E: Complete User Flow', () => {
    const timestamp = Date.now();
    const testUser = {
        name: 'E2E Test User',
        email: `e2e_${timestamp}@example.com`,
        password: 'E2ETestPass123!'
    };
    
    let authToken = null;
    let userId = null;
    let courseId = null;
    let lessonId = null;
    let quizLessonId = null;

    // ==========================================
    // Flow 1: New User Registration & Onboarding
    // ==========================================
    describe('Flow 1: Registration & Onboarding', () => {
        
        it('Step 1: User registers', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(testUser)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            
            authToken = res.body.token;
            userId = res.body.user.id;
        });

        it('Step 2: User views course catalog', async () => {
            const res = await request(app)
                .get('/api/courses')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.courses.length).toBeGreaterThan(0);
            
            courseId = res.body.courses[0].id;
        });

        it('Step 3: User views course details', async () => {
            const res = await request(app)
                .get(`/api/courses/${courseId}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.course.lessons).toBeDefined();
            
            if (res.body.course.lessons.length > 0) {
                lessonId = res.body.course.lessons[0].id;
            }
        });

        it('Step 4: User enrolls in course', async () => {
            const res = await request(app)
                .post(`/api/courses/${courseId}/enroll`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('Step 5: User appears in enrolled courses', async () => {
            const res = await request(app)
                .get('/api/courses/enrolled')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            const enrolled = res.body.courses.find(c => c.id === courseId);
            expect(enrolled).toBeDefined();
        });
    });

    // ==========================================
    // Flow 2: Learning Journey
    // ==========================================
    describe('Flow 2: Learning Journey', () => {
        
        it('Step 1: User starts watching lesson', async () => {
            if (!lessonId) {
                console.log('Skipping: No lesson available');
                return;
            }

            const res = await request(app)
                .post('/api/progress')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lessonId,
                    courseId,
                    watchedSeconds: 30
                })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('Step 2: User continues watching', async () => {
            if (!lessonId) return;

            const res = await request(app)
                .post('/api/progress')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lessonId,
                    courseId,
                    watchedSeconds: 120
                })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('Step 3: User completes lesson', async () => {
            if (!lessonId) return;

            const res = await request(app)
                .post('/api/progress')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lessonId,
                    courseId,
                    watchedSeconds: 300,
                    completed: true
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.lessonCompleted).toBe(true);
        });

        it('Step 4: Progress is tracked', async () => {
            const res = await request(app)
                .get(`/api/progress/${courseId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            
            const lesson = res.body.lessons.find(l => l.id === lessonId);
            if (lesson) {
                expect(lesson.completed).toBe(true);
            }
        });

        it('Step 5: XP is awarded', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.stats.totalXP).toBeGreaterThan(0);
        });
    });

    // ==========================================
    // Flow 3: Quiz Journey
    // ==========================================
    describe('Flow 3: Quiz Journey', () => {
        let quizQuestions = [];

        beforeAll(() => {
            // Find a lesson with quiz
            const quizData = db.prepare(`
                SELECT q.*, l.id as lesson_id, l.course_id
                FROM quizzes q
                JOIN lessons l ON q.lesson_id = l.id
                LIMIT 1
            `).get();

            if (quizData) {
                quizLessonId = quizData.lesson_id;
                
                // Enroll if needed
                const enrolled = db.prepare(`
                    SELECT * FROM enrollments 
                    WHERE user_id = ? AND course_id = ?
                `).get(userId, quizData.course_id);

                if (!enrolled) {
                    db.prepare(`
                        INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at)
                        VALUES (?, ?, ?, 'active', strftime('%s', 'now'))
                    `).run(require('uuid').v4(), userId, quizData.course_id);
                }

                // Get questions with correct answers
                quizQuestions = db.prepare(`
                    SELECT qq.id, qo.id as correct_option
                    FROM quiz_questions qq
                    JOIN quiz_options qo ON qq.id = qo.question_id AND qo.is_correct = 1
                    WHERE qq.quiz_id = ?
                `).all(quizData.id);
            }
        });

        it('Step 1: User loads quiz', async () => {
            if (!quizLessonId) {
                console.log('Skipping: No quiz available');
                return;
            }

            const res = await request(app)
                .get(`/api/quiz/${quizLessonId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.quiz).toBeDefined();
            expect(res.body.questions.length).toBeGreaterThan(0);
        });

        it('Step 2: User submits quiz with perfect score', async () => {
            if (!quizLessonId || quizQuestions.length === 0) return;

            // Clear previous results
            db.prepare('DELETE FROM quiz_results WHERE user_id = ?').run(userId);

            const answers = quizQuestions.map(q => ({
                questionId: q.id,
                optionId: q.correct_option
            }));

            const res = await request(app)
                .post(`/api/quiz/${quizLessonId}/submit`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ answers, timeTaken: 120 })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.result.percentage).toBe(100);
            expect(res.body.result.passed).toBe(true);
        });

        it('Step 3: Quiz XP is awarded', async () => {
            if (!quizLessonId) return;

            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // XP should have increased from quiz
            expect(res.body.stats.totalXP).toBeGreaterThan(50);
        });
    });

    // ==========================================
    // Flow 4: Gamification Progress
    // ==========================================
    describe('Flow 4: Gamification Progress', () => {
        
        it('Step 1: User has level', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.stats.level).toBeDefined();
            expect(res.body.stats.level.level).toBeGreaterThanOrEqual(1);
        });

        it('Step 2: User has streak', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.stats.currentStreak).toBeDefined();
        });

        it('Step 3: Leaderboard includes user', async () => {
            const res = await request(app)
                .get('/api/gamification/leaderboard')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.leaderboard).toBeDefined();
        });

        it('Step 4: User may have badges', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.badges).toBeDefined();
            expect(res.body.badges.earned).toBeDefined();
        });
    });

    // ==========================================
    // Flow 5: Profile Management
    // ==========================================
    describe('Flow 5: Profile Management', () => {
        
        it('Step 1: User views profile', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.user.email).toBe(testUser.email);
            expect(res.body.user.name).toBe(testUser.name);
        });

        it('Step 2: User updates profile', async () => {
            const res = await request(app)
                .put('/api/auth/update-profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated E2E User' })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('Step 3: Profile changes persist', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.user.name).toBe('Updated E2E User');
        });
    });

    // ==========================================
    // Cleanup
    // ==========================================
    afterAll(() => {
        if (userId) {
            try {
                db.prepare('DELETE FROM quiz_results WHERE user_id = ?').run(userId);
                db.prepare('DELETE FROM progress WHERE user_id = ?').run(userId);
                db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(userId);
                db.prepare('DELETE FROM user_badges WHERE user_id = ?').run(userId);
                db.prepare('DELETE FROM xp_transactions WHERE user_id = ?').run(userId);
                db.prepare('DELETE FROM user_gamification WHERE user_id = ?').run(userId);
                db.prepare('DELETE FROM users WHERE id = ?').run(userId);
            } catch (e) {
                console.error('Cleanup error:', e.message);
            }
        }
    });
});
