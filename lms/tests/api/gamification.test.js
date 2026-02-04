/**
 * Gamification API Tests
 * Tests for XP, levels, badges, streaks
 */

const request = require('supertest');

process.env.NODE_ENV = 'test';

const app = require('../../api/server');

describe('Gamification API', () => {
    let authToken = null;
    const testUser = {
        name: 'Gamification Tester',
        email: `gamify${Date.now()}@example.com`,
        password: 'testpassword123'
    };

    // Setup: Create and login test user
    beforeAll(async () => {
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send(testUser);
        
        authToken = registerRes.body.token;
    });

    // ==========================================
    // Config Endpoint (Public)
    // ==========================================
    describe('GET /api/gamification/config', () => {
        it('should return gamification configuration', async () => {
            const res = await request(app)
                .get('/api/gamification/config')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.levels).toBeDefined();
            expect(res.body.levels).toBeInstanceOf(Array);
            expect(res.body.levels.length).toBeGreaterThan(0);
            expect(res.body.badges).toBeDefined();
            expect(res.body.badges).toBeInstanceOf(Array);
            expect(res.body.xpRewards).toBeDefined();
        });

        it('should return correct level structure', async () => {
            const res = await request(app)
                .get('/api/gamification/config')
                .expect(200);

            const firstLevel = res.body.levels[0];
            expect(firstLevel).toHaveProperty('level');
            expect(firstLevel).toHaveProperty('name');
            expect(firstLevel).toHaveProperty('icon');
            expect(firstLevel).toHaveProperty('minXP');
        });

        it('should return correct badge structure', async () => {
            const res = await request(app)
                .get('/api/gamification/config')
                .expect(200);

            const firstBadge = res.body.badges[0];
            expect(firstBadge).toHaveProperty('id');
            expect(firstBadge).toHaveProperty('name');
            expect(firstBadge).toHaveProperty('description');
            expect(firstBadge).toHaveProperty('icon');
        });
    });

    // ==========================================
    // Stats Endpoint
    // ==========================================
    describe('GET /api/gamification/stats', () => {
        it('should return demo stats without token', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.stats).toBeDefined();
            expect(res.body.stats.totalXP).toBeDefined();
            expect(res.body.stats.level).toBeDefined();
        });

        it('should return user stats with valid token', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.stats).toBeDefined();
            expect(res.body.badges).toBeDefined();
            expect(res.body.dailyChallenges).toBeDefined();
        });

        it('should return correct stats structure', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const stats = res.body.stats;
            expect(stats).toHaveProperty('totalXP');
            expect(stats).toHaveProperty('level');
            expect(stats).toHaveProperty('currentStreak');
            expect(stats).toHaveProperty('longestStreak');
        });
    });

    // ==========================================
    // Lesson Complete Endpoint
    // ==========================================
    describe('POST /api/gamification/lesson-complete', () => {
        it('should reject without token', async () => {
            const res = await request(app)
                .post('/api/gamification/lesson-complete')
                .send({ lessonId: '1', courseId: 'test-course' })
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should award XP for lesson completion', async () => {
            const res = await request(app)
                .post('/api/gamification/lesson-complete')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    lessonId: 'lesson_1', 
                    courseId: 'test-course',
                    watchTime: 300
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.rewards).toBeDefined();
            expect(res.body.rewards).toBeInstanceOf(Array);
            expect(res.body.newStats).toBeDefined();
            expect(res.body.newStats.totalXP).toBeGreaterThan(0);
        });

        it('should update streak on lesson completion', async () => {
            const res = await request(app)
                .post('/api/gamification/lesson-complete')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    lessonId: 'lesson_2', 
                    courseId: 'test-course',
                    watchTime: 300
                })
                .expect(200);

            expect(res.body.newStats.streak).toBeGreaterThanOrEqual(1);
        });
    });

    // ==========================================
    // Quiz Complete Endpoint
    // ==========================================
    describe('POST /api/gamification/quiz-complete', () => {
        it('should reject without token', async () => {
            const res = await request(app)
                .post('/api/gamification/quiz-complete')
                .send({ quizId: '1', score: 80, maxScore: 100, percentage: 80 })
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should award XP for quiz completion', async () => {
            const res = await request(app)
                .post('/api/gamification/quiz-complete')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    quizId: 'quiz_1',
                    lessonId: 'lesson_1',
                    score: 80, 
                    maxScore: 100, 
                    percentage: 80 
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.rewards).toBeDefined();
            expect(res.body.newStats.totalXP).toBeGreaterThan(0);
        });

        it('should award extra XP for perfect score', async () => {
            const res = await request(app)
                .post('/api/gamification/quiz-complete')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    quizId: 'quiz_2',
                    lessonId: 'lesson_2',
                    score: 100, 
                    maxScore: 100, 
                    percentage: 100 
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            // Check for perfect quiz reward
            const xpReward = res.body.rewards.find(r => r.type === 'xp');
            expect(xpReward).toBeDefined();
        });
    });

    // ==========================================
    // Leaderboard Endpoint
    // ==========================================
    describe('GET /api/gamification/leaderboard', () => {
        it('should return leaderboard with valid token', async () => {
            const res = await request(app)
                .get('/api/gamification/leaderboard')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.leaderboard).toBeDefined();
            expect(res.body.leaderboard).toBeInstanceOf(Array);
        });

        it('should support period parameter', async () => {
            const res = await request(app)
                .get('/api/gamification/leaderboard?period=monthly')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.period).toBe('monthly');
        });
    });
});
