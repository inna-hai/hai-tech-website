/**
 * Quiz API Tests
 * Tests for quiz retrieval and submission
 */

const request = require('supertest');
process.env.NODE_ENV = 'test';

const app = require('../../api/server');
const db = require('../../api/db');

describe('Quiz API', () => {
    let authToken = null;
    let testUserId = null;
    let testLessonId = null;
    let testQuizId = null;
    let testQuestions = [];
    
    const testUser = {
        name: 'Quiz Tester',
        email: `quiz${Date.now()}@example.com`,
        password: 'testpassword123'
    };

    // Setup
    beforeAll(async () => {
        // Register user
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send(testUser);
        
        authToken = registerRes.body.token;
        testUserId = registerRes.body.user?.id;

        // Get a lesson with quiz
        const quizData = db.prepare(`
            SELECT q.*, l.course_id
            FROM quizzes q
            JOIN lessons l ON q.lesson_id = l.id
            LIMIT 1
        `).get();

        if (quizData) {
            testLessonId = quizData.lesson_id;
            testQuizId = quizData.id;

            // Enroll in course
            await request(app)
                .post(`/api/courses/${quizData.course_id}/enroll`)
                .set('Authorization', `Bearer ${authToken}`);

            // Get questions
            testQuestions = db.prepare(`
                SELECT qq.id, qq.points, qo.id as correct_option
                FROM quiz_questions qq
                JOIN quiz_options qo ON qq.id = qo.question_id AND qo.is_correct = 1
                WHERE qq.quiz_id = ?
            `).all(testQuizId);
        }
    });

    // Cleanup
    afterAll(() => {
        if (testUserId) {
            try {
                db.prepare('DELETE FROM quiz_results WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM progress WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM user_gamification WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM xp_transactions WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    // ==========================================
    // Get Quiz
    // ==========================================
    describe('GET /api/quiz/:lessonId', () => {
        it('should return quiz for lesson', async () => {
            if (!testLessonId) {
                console.log('Skipping: No quiz available');
                return;
            }

            const res = await request(app)
                .get(`/api/quiz/${testLessonId}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.quiz).toBeDefined();
            expect(res.body.questions).toBeDefined();
        });

        it('should return quiz metadata', async () => {
            if (!testLessonId) return;

            const res = await request(app)
                .get(`/api/quiz/${testLessonId}`)
                .expect(200);

            expect(res.body.quiz.title).toBeDefined();
            expect(res.body.quiz.passingScore).toBeDefined();
            expect(res.body.quiz.totalQuestions).toBeDefined();
        });

        it('should return questions with options', async () => {
            if (!testLessonId) return;

            const res = await request(app)
                .get(`/api/quiz/${testLessonId}`)
                .expect(200);

            expect(res.body.questions.length).toBeGreaterThan(0);
            
            const question = res.body.questions[0];
            expect(question.text).toBeDefined();
            expect(question.options).toBeDefined();
            expect(question.options.length).toBeGreaterThanOrEqual(2);
        });

        it('should NOT expose correct answers in GET request', async () => {
            if (!testLessonId) return;

            const res = await request(app)
                .get(`/api/quiz/${testLessonId}`)
                .expect(200);

            const question = res.body.questions[0];
            question.options.forEach(opt => {
                expect(opt.isCorrect).toBeUndefined();
                expect(opt.is_correct).toBeUndefined();
            });
        });

        it('should return 404 for lesson without quiz', async () => {
            // Find a lesson without quiz
            const lessonWithoutQuiz = db.prepare(`
                SELECT l.id FROM lessons l
                LEFT JOIN quizzes q ON l.id = q.lesson_id
                WHERE q.id IS NULL
                LIMIT 1
            `).get();

            if (lessonWithoutQuiz) {
                const res = await request(app)
                    .get(`/api/quiz/${lessonWithoutQuiz.id}`)
                    .expect(404);

                expect(res.body.success).toBe(false);
            }
        });
    });

    // ==========================================
    // Submit Quiz
    // ==========================================
    describe('POST /api/quiz/:lessonId/submit', () => {
        it('should require authentication', async () => {
            if (!testLessonId) return;

            const res = await request(app)
                .post(`/api/quiz/${testLessonId}/submit`)
                .send({ answers: [] })
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should accept quiz submission', async () => {
            if (!testLessonId || testQuestions.length === 0) return;

            const answers = testQuestions.map(q => ({
                questionId: q.id,
                optionId: q.correct_option
            }));

            const res = await request(app)
                .post(`/api/quiz/${testLessonId}/submit`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ answers })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.result).toBeDefined();
        });

        it('should calculate score correctly for perfect answers', async () => {
            if (!testLessonId || testQuestions.length === 0) return;

            // Delete previous result
            db.prepare('DELETE FROM quiz_results WHERE user_id = ? AND quiz_id = ?')
                .run(testUserId, testQuizId);

            const answers = testQuestions.map(q => ({
                questionId: q.id,
                optionId: q.correct_option
            }));

            const res = await request(app)
                .post(`/api/quiz/${testLessonId}/submit`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ answers })
                .expect(200);

            expect(res.body.result.percentage).toBe(100);
            expect(res.body.result.passed).toBe(true);
        });

        it('should calculate score correctly for wrong answers', async () => {
            if (!testLessonId || testQuestions.length === 0) return;

            // Delete previous result
            db.prepare('DELETE FROM quiz_results WHERE user_id = ? AND quiz_id = ?')
                .run(testUserId, testQuizId);

            // Submit all wrong answers (use non-existent option IDs)
            const answers = testQuestions.map(q => ({
                questionId: q.id,
                optionId: 'wrong-option-id'
            }));

            const res = await request(app)
                .post(`/api/quiz/${testLessonId}/submit`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ answers })
                .expect(200);

            expect(res.body.result.percentage).toBe(0);
            expect(res.body.result.passed).toBe(false);
        });

        it('should return detailed results', async () => {
            if (!testLessonId || testQuestions.length === 0) return;

            db.prepare('DELETE FROM quiz_results WHERE user_id = ? AND quiz_id = ?')
                .run(testUserId, testQuizId);

            const answers = testQuestions.map(q => ({
                questionId: q.id,
                optionId: q.correct_option
            }));

            const res = await request(app)
                .post(`/api/quiz/${testLessonId}/submit`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ answers })
                .expect(200);

            expect(res.body.details).toBeDefined();
            expect(Array.isArray(res.body.details)).toBe(true);
            expect(res.body.details.length).toBe(testQuestions.length);
        });

        it('should include gamification rewards for passing', async () => {
            if (!testLessonId || testQuestions.length === 0) return;

            db.prepare('DELETE FROM quiz_results WHERE user_id = ? AND quiz_id = ?')
                .run(testUserId, testQuizId);

            const answers = testQuestions.map(q => ({
                questionId: q.id,
                optionId: q.correct_option
            }));

            const res = await request(app)
                .post(`/api/quiz/${testLessonId}/submit`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ answers })
                .expect(200);

            if (res.body.gamification) {
                expect(res.body.gamification.xpEarned).toBeGreaterThan(0);
            }
        });

        it('should save result to database', async () => {
            if (!testLessonId) return;

            const result = db.prepare(`
                SELECT * FROM quiz_results 
                WHERE user_id = ? AND quiz_id = ?
                ORDER BY completed_at DESC
                LIMIT 1
            `).get(testUserId, testQuizId);

            expect(result).toBeDefined();
            expect(result.score).toBeDefined();
            expect(result.percentage).toBeDefined();
        });
    });

    // ==========================================
    // Quiz Results History
    // ==========================================
    describe('GET /api/quiz/results/:courseId', () => {
        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/quiz/results/some-course-id')
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should return quiz results for course', async () => {
            const quizData = db.prepare(`
                SELECT l.course_id FROM quizzes q
                JOIN lessons l ON q.lesson_id = l.id
                WHERE q.id = ?
            `).get(testQuizId);

            if (quizData) {
                const res = await request(app)
                    .get(`/api/quiz/results/${quizData.course_id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(res.body.success).toBe(true);
            }
        });
    });
});
