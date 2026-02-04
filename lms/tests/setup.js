/**
 * Jest Setup File
 * Runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for slow operations
jest.setTimeout(30000);

// Silence console.log during tests (optional)
// global.console = {
//     ...console,
//     log: jest.fn(),
// };

// Clean up after all tests
afterAll(async () => {
    // Give time for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
});
