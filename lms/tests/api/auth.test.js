/**
 * Auth API Tests
 * Tests for registration, login, and authentication
 */

const request = require('supertest');
const path = require('path');

// Setup test environment
process.env.NODE_ENV = 'test';

// Import the express app
const app = require('../../api/server');

describe('Auth API', () => {
    const testUser = {
        name: 'Test User',
        email: `test${Date.now()}@example.com`,
        password: 'testpassword123'
    };
    let authToken = null;

    // ==========================================
    // Registration Tests
    // ==========================================
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(testUser)
                .expect('Content-Type', /json/)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe(testUser.email);
            expect(res.body.user.name).toBe(testUser.name);
            expect(res.body.token).toBeDefined();
            
            // Save token for later tests
            authToken = res.body.token;
        });

        it('should reject registration with existing email', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(testUser)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeDefined();
        });

        it('should reject registration without required fields', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'incomplete@test.com' })
                .expect('Content-Type', /json/)
                .expect(400);

            expect(res.body.success).toBe(false);
        });

        it('should reject registration with invalid email', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test',
                    email: 'not-an-email',
                    password: 'password123'
                })
                .expect('Content-Type', /json/)
                .expect(400);

            expect(res.body.success).toBe(false);
        });

        it('should reject registration with short password', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test',
                    email: 'short@test.com',
                    password: '123'
                })
                .expect('Content-Type', /json/)
                .expect(400);

            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // Login Tests
    // ==========================================
    describe('POST /api/auth/login', () => {
        it('should login with correct credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.user).toBeDefined();
            expect(res.body.token).toBeDefined();
            
            authToken = res.body.token;
        });

        it('should reject login with wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrongpassword'
                })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should reject login with non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@test.com',
                    password: 'password123'
                })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // Get Current User Tests
    // ==========================================
    describe('GET /api/auth/me', () => {
        it('should return user data with valid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe(testUser.email);
        });

        it('should reject request without token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should reject request with invalid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalidtoken123')
                .expect('Content-Type', /json/)
                .expect(403);

            expect(res.body.success).toBe(false);
        });
    });
});
