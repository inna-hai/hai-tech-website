/**
 * Courses API Tests
 * Tests for course listing, details, and enrollment
 */

const request = require('supertest');
process.env.NODE_ENV = 'test';

const app = require('../../api/server');
const db = require('../../api/db');

describe('Courses API', () => {
    let authToken = null;
    let testUserId = null;
    const testUser = {
        name: 'Course Tester',
        email: `course${Date.now()}@example.com`,
        password: 'testpassword123'
    };

    // Setup: Create and login test user
    beforeAll(async () => {
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send(testUser);
        
        authToken = registerRes.body.token;
        testUserId = registerRes.body.user?.id;
    });

    // Cleanup
    afterAll(() => {
        if (testUserId) {
            try {
                db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM progress WHERE user_id = ?').run(testUserId);
                db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    // ==========================================
    // Course Listing
    // ==========================================
    describe('GET /api/courses', () => {
        it('should return list of courses', async () => {
            const res = await request(app)
                .get('/api/courses')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.courses).toBeDefined();
            expect(Array.isArray(res.body.courses)).toBe(true);
            expect(res.body.courses.length).toBeGreaterThan(0);
        });

        it('should return course with required fields', async () => {
            const res = await request(app)
                .get('/api/courses')
                .expect(200);

            const course = res.body.courses[0];
            expect(course.id).toBeDefined();
            expect(course.title).toBeDefined();
            expect(course.description).toBeDefined();
        });

        it('should include lesson count', async () => {
            const res = await request(app)
                .get('/api/courses')
                .expect(200);

            const course = res.body.courses[0];
            expect(course.lessonCount).toBeDefined();
            expect(typeof course.lessonCount).toBe('number');
        });
    });

    // ==========================================
    // Course Details
    // ==========================================
    describe('GET /api/courses/:id', () => {
        let courseId;

        beforeAll(async () => {
            const res = await request(app).get('/api/courses');
            courseId = res.body.courses[0]?.id;
        });

        it('should return course details', async () => {
            const res = await request(app)
                .get(`/api/courses/${courseId}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.course).toBeDefined();
            expect(res.body.course.id).toBe(courseId);
        });

        it('should include lessons array', async () => {
            const res = await request(app)
                .get(`/api/courses/${courseId}`)
                .expect(200);

            expect(res.body.course.lessons).toBeDefined();
            expect(Array.isArray(res.body.course.lessons)).toBe(true);
        });

        it('should return lessons in correct order', async () => {
            const res = await request(app)
                .get(`/api/courses/${courseId}`)
                .expect(200);

            const lessons = res.body.course.lessons;
            if (lessons.length > 1) {
                for (let i = 1; i < lessons.length; i++) {
                    expect(lessons[i].order).toBeGreaterThanOrEqual(lessons[i-1].order);
                }
            }
        });

        it('should return 404 for non-existent course', async () => {
            const res = await request(app)
                .get('/api/courses/non-existent-id-12345')
                .expect(404);

            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // Course Enrollment
    // ==========================================
    describe('POST /api/courses/:id/enroll', () => {
        let courseId;

        beforeAll(async () => {
            const res = await request(app).get('/api/courses');
            courseId = res.body.courses[0]?.id;
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .post(`/api/courses/${courseId}/enroll`)
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should enroll authenticated user', async () => {
            // First, remove any existing enrollment
            if (testUserId) {
                db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?')
                    .run(testUserId, courseId);
            }

            const res = await request(app)
                .post(`/api/courses/${courseId}/enroll`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should prevent duplicate enrollment', async () => {
            const res = await request(app)
                .post(`/api/courses/${courseId}/enroll`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(res.body.success).toBe(false);
        });

        it('should return 404 for non-existent course', async () => {
            const res = await request(app)
                .post('/api/courses/non-existent-id/enroll')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // Enrolled Courses
    // ==========================================
    describe('GET /api/courses/enrolled', () => {
        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/courses/enrolled')
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should return enrolled courses', async () => {
            const res = await request(app)
                .get('/api/courses/enrolled')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.courses).toBeDefined();
            expect(Array.isArray(res.body.courses)).toBe(true);
        });
    });
});
