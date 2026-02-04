/**
 * E2E Flow Tests
 * Tests complete user journeys
 */

const request = require('supertest');

process.env.NODE_ENV = 'test';

const app = require('../../api/server');

describe('E2E User Flows', () => {
    // ==========================================
    // Registration Flow
    // ==========================================
    describe('Registration Flow', () => {
        const newUser = {
            name: 'New Student',
            email: `student${Date.now()}@example.com`,
            password: 'student123'
        };
        let userToken = null;

        it('Step 1: User can register', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            userToken = res.body.token;
        });

        it('Step 2: User can get their profile', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.user.email).toBe(newUser.email);
        });

        it('Step 3: User can see gamification stats', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.stats.totalXP).toBe(0);
            expect(res.body.stats.currentStreak).toBe(0);
        });
    });

    // ==========================================
    // Learning Flow
    // ==========================================
    describe('Learning Flow', () => {
        let userToken = null;
        let initialXP = 0;

        // Setup: Create user
        beforeAll(async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Learning Student',
                    email: `learner${Date.now()}@example.com`,
                    password: 'learner123'
                });
            userToken = res.body.token;

            // Get initial stats
            const statsRes = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${userToken}`);
            initialXP = statsRes.body.stats.totalXP;
        });

        it('Step 1: Complete a lesson', async () => {
            const res = await request(app)
                .post('/api/gamification/lesson-complete')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    lessonId: 'lesson_1',
                    courseId: 'intro-course',
                    watchTime: 600
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.rewards.length).toBeGreaterThan(0);
        });

        it('Step 2: XP should increase', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.stats.totalXP).toBeGreaterThan(initialXP);
        });

        it('Step 3: Streak should be active', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.stats.currentStreak).toBeGreaterThanOrEqual(1);
        });

        it('Step 4: Complete more lessons', async () => {
            // Complete 2 more lessons
            await request(app)
                .post('/api/gamification/lesson-complete')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ lessonId: 'lesson_2', courseId: 'intro-course', watchTime: 500 });

            await request(app)
                .post('/api/gamification/lesson-complete')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ lessonId: 'lesson_3', courseId: 'intro-course', watchTime: 500 });

            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.stats.totalLessonsCompleted).toBeGreaterThanOrEqual(3);
        });
    });

    // ==========================================
    // Quiz Flow
    // ==========================================
    describe('Quiz Flow', () => {
        let userToken = null;

        beforeAll(async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Quiz Student',
                    email: `quizzer${Date.now()}@example.com`,
                    password: 'quizzer123'
                });
            userToken = res.body.token;
        });

        it('Step 1: Complete quiz with 80%', async () => {
            const res = await request(app)
                .post('/api/gamification/quiz-complete')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    quizId: 'quiz_1',
                    lessonId: 'lesson_1',
                    score: 80,
                    maxScore: 100,
                    percentage: 80
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.rewards).toBeDefined();
        });

        it('Step 2: Complete quiz with 100% (perfect)', async () => {
            const res = await request(app)
                .post('/api/gamification/quiz-complete')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    quizId: 'quiz_2',
                    lessonId: 'lesson_2',
                    score: 100,
                    maxScore: 100,
                    percentage: 100
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            
            // Should get more XP for perfect score
            const xpReward = res.body.rewards.find(r => r.type === 'xp');
            expect(xpReward.value).toBeGreaterThanOrEqual(100);
        });

        it('Step 3: Check for perfect quiz badge', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.stats.totalPerfectQuizzes).toBeGreaterThanOrEqual(1);
        });
    });

    // ==========================================
    // Level Up Flow
    // ==========================================
    describe('Level Up Flow', () => {
        let userToken = null;

        beforeAll(async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Level Up Student',
                    email: `levelup${Date.now()}@example.com`,
                    password: 'levelup123'
                });
            userToken = res.body.token;
        });

        it('Should start at level 1', async () => {
            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.stats.level.level).toBe(1);
        });

        it('Should gain XP from activities', async () => {
            // Complete multiple lessons to gain XP
            for (let i = 1; i <= 5; i++) {
                await request(app)
                    .post('/api/gamification/lesson-complete')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({
                        lessonId: `level_lesson_${i}`,
                        courseId: 'level-course',
                        watchTime: 300
                    });
            }

            const res = await request(app)
                .get('/api/gamification/stats')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.stats.totalXP).toBeGreaterThan(0);
        });
    });
});
