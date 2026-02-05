/**
 * Jest Configuration for HAI Tech Academy LMS
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    
    // Coverage settings
    collectCoverageFrom: [
        'api/**/*.js',
        '!api/db/init.js',
        '!api/db/seed.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'text-summary', 'html'],
    
    // Timeouts
    testTimeout: 30000,
    
    // Setup/teardown
    setupFilesAfterEnv: ['./tests/setup.js'],
    
    // Verbose output
    verbose: true,
    
    // Force exit after tests complete
    forceExit: true,
    
    // Detect open handles
    detectOpenHandles: true,
    
    // Projects for different test types
    projects: [
        {
            displayName: 'unit',
            testMatch: ['<rootDir>/tests/api/**/*.test.js'],
            testEnvironment: 'node'
        },
        {
            displayName: 'frontend',
            testMatch: ['<rootDir>/tests/frontend/**/*.test.js'],
            testEnvironment: 'node'
        },
        {
            displayName: 'e2e',
            testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
            testEnvironment: 'node'
        },
        {
            displayName: 'release',
            testMatch: ['<rootDir>/tests/release.test.js'],
            testEnvironment: 'node'
        }
    ]
};
