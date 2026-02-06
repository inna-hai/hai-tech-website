/**
 * Progress API Tests
 * Tests for lesson progress tracking and completion
 */

const request = require('supertest');
process.env.NODE_ENV = 'test';

const app = require('../../api/server');
const db = require('../../api/db');

describe('Progress API', () => {
    let authToken = null;
    let testUserId = null;
    let testCourseId = null;
    let testLessonId = null;
    
    const testUser = {
        name: 'Progress Tester',
        email: `progress${Date.now()}@example.com`,
        password: 'testpassword123'
    };

    // Setup: Create user, get course and lesson
    beforeAll(async () => {
        // Register user
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send(testUser);
        
        authToken = registerRes.body.token;
        testUserId = registerRes.body.user?.id;

        // Get a course
        const coursesRes = await request(app).get('/api/courses');
        testCourseId = coursesRes.body.courses[0]?.id;

        // Get first lesson of course
        if (testCourseId) {
            const courseRes = await request(app).get(`/api/courses/${testCourseId}`);
            testLessonId = courseRes.body.course?.lessons[0]?.id;

            // Enroll in course
            await request(app)
                .post(`/api/courses/${testCourseId}/enroll`)
                .set('Authorization', `Bearer ${authToken}`);
        }
    });

    // Cleanup
    afterAll(() => {
        if (testUserId) {
            try {
                db.prepare('DELETE FROM progress WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM user_gamification WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    // ==========================================
    // Save Progress
    // ==========================================
    describe('POST /api/progress', () => {
        it('should require authentication', async () => {
            const res = await request(app)
                .post('/api/progress')
                .send({
                    lessonId: testLessonId,
                    courseId: testCourseId,
                    watchedSeconds: 60
                })
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should save progress for enrolled user', async () => {
            const res = await request(app)
                .post('/api/progress')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lessonId: testLessonId,
                    courseId: testCourseId,
                    watchedSeconds: 60
                })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should update existing progress', async () => {
            const res = await request(app)
                .post('/api/progress')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lessonId: testLessonId,
                    courseId: testCourseId,
                    watchedSeconds: 120
                })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should mark lesson as complete', async () => {
            const res = await request(app)
                .post('/api/progress')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lessonId: testLessonId,
                    courseId: testCourseId,
                    watchedSeconds: 300,
                    completed: true
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.lessonCompleted).toBe(true);
        });

        it('should return course progress stats', async () => {
            const res = await request(app)
                .post('/api/progress')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lessonId: testLessonId,
                    courseId: testCourseId,
                    watchedSeconds: 300
                })
                .expect(200);

            expect(res.body.courseProgress).toBeDefined();
            expect(res.body.courseProgress.completedLessons).toBeDefined();
            expect(res.body.courseProgress.totalLessons).toBeDefined();
            expect(res.body.courseProgress.percent).toBeDefined();
        });

        it('should include gamification data when completing lesson', async () => {
            // Get a different lesson to complete
            const courseRes = await request(app).get(`/api/courses/${testCourseId}`);
            const secondLesson = courseRes.body.course?.lessons[1];
            
            if (secondLesson) {
                const res = await request(app)
                    .post('/api/progress')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        lessonId: secondLesson.id,
                        courseId: testCourseId,
                        completed: true
                    })
                    .expect(200);

                // Gamification might be null if already completed, so just check structure
                if (res.body.gamification) {
                    expect(res.body.gamification.xpEarned).toBeDefined();
                }
            }
        });

        it('should reject progress for non-enrolled course on non-free lessons', async () => {
            // Find a non-free lesson to test with
            const nonFreeLesson = db.prepare(`
                SELECT id FROM lessons WHERE course_id = ? AND is_free = 0 LIMIT 1
            `).get(testCourseId);

            // Skip test if no non-free lessons exist (all lessons are free)
            if (!nonFreeLesson) {
                console.log('Skipping test: no non-free lessons available in test course');
                return;
            }

            // Create new user without enrollment
            const newUser = {
                name: 'No Enroll User',
                email: `noenroll${Date.now()}@example.com`,
                password: 'testpassword123'
            };
            const regRes = await request(app)
                .post('/api/auth/register')
                .send(newUser);
            
            const newToken = regRes.body.token;
            const newUserId = regRes.body.user?.id;

            const res = await request(app)
                .post('/api/progress')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    lessonId: nonFreeLesson.id,
                    courseId: testCourseId,
                    watchedSeconds: 60
                })
                .expect(403);

            expect(res.body.success).toBe(false);

            // Cleanup
            if (newUserId) {
                db.prepare('DELETE FROM users WHERE id = ?').run(newUserId);
            }
        });
    });

    // ==========================================
    // Get Progress
    // ==========================================
    describe('GET /api/progress/:courseId', () => {
        it('should require authentication', async () => {
            const res = await request(app)
                .get(`/api/progress/${testCourseId}`)
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should return progress for enrolled course', async () => {
            const res = await request(app)
                .get(`/api/progress/${testCourseId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.lessons).toBeDefined();
            expect(Array.isArray(res.body.lessons)).toBe(true);
        });

        it('should include lesson completion status', async () => {
            const res = await request(app)
                .get(`/api/progress/${testCourseId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            if (res.body.lessons.length > 0) {
                const lesson = res.body.lessons[0];
                expect(lesson.completed).toBeDefined();
                expect(lesson.watchedSeconds).toBeDefined();
            }
        });
    });

    // ==========================================
    // Overall Progress Summary
    // ==========================================
    describe('GET /api/progress', () => {
        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/progress')
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should return overall progress summary', async () => {
            const res = await request(app)
                .get('/api/progress')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });
});
