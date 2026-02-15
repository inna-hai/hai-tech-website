/**
 * Jest Test Setup
 * Runs before each test file
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-12345';

// Increase timeout for slow tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
    // Generate unique email for tests
    generateEmail: (prefix = 'test') => {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@test.com`;
    },
    
    // Wait helper
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // Common test user
    createTestUser: () => ({
        name: 'Test User',
        email: global.testUtils.generateEmail(),
        password: 'TestPassword123!'
    })
};

// Suppress console.log in tests (optional - uncomment to enable)
// global.console.log = jest.fn();

// Clean up after all tests
afterAll(async () => {
    // Close any open handles
    await new Promise(resolve => setTimeout(resolve, 500));
});
