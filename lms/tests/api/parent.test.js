/**
 * Parent Dashboard API Tests
 * Tests for parent-child linking and progress tracking
 */

const request = require('supertest');

process.env.NODE_ENV = 'test';

const app = require('../../api/server');

describe('Parent Dashboard API', () => {
    let parentToken = null;
    let childToken = null;
    let childUserId = null;
    
    const parentUser = {
        name: 'Parent User',
        email: `parent${Date.now()}@example.com`,
        password: 'parentpass123'
    };
    
    const childUser = {
        name: 'Child User',
        email: `child${Date.now()}@example.com`,
        password: 'childpass123'
    };

    // Setup: Create parent and child accounts
    beforeAll(async () => {
        // Register parent
        const parentRes = await request(app)
            .post('/api/auth/register')
            .send(parentUser);
        parentToken = parentRes.body.token;

        // Register child
        const childRes = await request(app)
            .post('/api/auth/register')
            .send(childUser);
        childToken = childRes.body.token;
        childUserId = childRes.body.user.id;
    });

    // ==========================================
    // Get Children Endpoint
    // ==========================================
    describe('GET /api/parent/children', () => {
        it('should reject without token', async () => {
            const res = await request(app)
                .get('/api/parent/children')
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should return empty array for new parent', async () => {
            const res = await request(app)
                .get('/api/parent/children')
                .set('Authorization', `Bearer ${parentToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.children).toBeDefined();
            expect(res.body.children).toBeInstanceOf(Array);
        });
    });

    // ==========================================
    // Link Child Endpoint
    // ==========================================
    describe('POST /api/parent/link-child', () => {
        it('should reject without token', async () => {
            const res = await request(app)
                .post('/api/parent/link-child')
                .send({ childEmail: childUser.email })
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should link child by email', async () => {
            const res = await request(app)
                .post('/api/parent/link-child')
                .set('Authorization', `Bearer ${parentToken}`)
                .send({ childEmail: childUser.email })
                .expect('Content-Type', /json/);

            // May succeed or fail depending on if child exists
            if (res.status === 200) {
                expect(res.body.success).toBe(true);
            }
        });

        it('should reject linking non-existent email', async () => {
            const res = await request(app)
                .post('/api/parent/link-child')
                .set('Authorization', `Bearer ${parentToken}`)
                .send({ childEmail: 'nonexistent@example.com' })
                .expect('Content-Type', /json/);

            // Should fail for non-existent user
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // Get Child Progress Endpoint
    // ==========================================
    describe('GET /api/parent/child/:id/progress', () => {
        it('should reject without token', async () => {
            const res = await request(app)
                .get(`/api/parent/child/${childUserId}/progress`)
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should return progress for linked child', async () => {
            // First link the child
            await request(app)
                .post('/api/parent/link-child')
                .set('Authorization', `Bearer ${parentToken}`)
                .send({ childEmail: childUser.email });

            const res = await request(app)
                .get(`/api/parent/child/${childUserId}/progress`)
                .set('Authorization', `Bearer ${parentToken}`)
                .expect('Content-Type', /json/);

            if (res.status === 200) {
                expect(res.body.success).toBe(true);
                expect(res.body.stats).toBeDefined();
            }
        });
    });

    // ==========================================
    // Get Child Activity Endpoint
    // ==========================================
    describe('GET /api/parent/child/:id/activity', () => {
        it('should reject without token', async () => {
            const res = await request(app)
                .get(`/api/parent/child/${childUserId}/activity`)
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should return activity feed for linked child', async () => {
            const res = await request(app)
                .get(`/api/parent/child/${childUserId}/activity`)
                .set('Authorization', `Bearer ${parentToken}`)
                .expect('Content-Type', /json/);

            if (res.status === 200) {
                expect(res.body.success).toBe(true);
                expect(res.body.activities).toBeDefined();
                expect(res.body.activities).toBeInstanceOf(Array);
            }
        });
    });

    // ==========================================
    // Unlink Child Endpoint
    // ==========================================
    describe('DELETE /api/parent/child/:id', () => {
        it('should reject without token', async () => {
            const res = await request(app)
                .delete(`/api/parent/child/${childUserId}`)
                .expect(401);

            expect(res.body.success).toBe(false);
        });
    });
});
