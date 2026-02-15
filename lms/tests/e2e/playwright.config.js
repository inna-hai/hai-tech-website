/**
 * Playwright Configuration
 * HAI Tech Academy - E2E Tests
 */

module.exports = {
    testDir: './browser',
    timeout: 60000,
    retries: 1,
    workers: 1,
    
    use: {
        baseURL: 'http://129.159.135.204:8080',
        headless: true,
        viewport: { width: 1280, height: 720 },
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
        
        // Hebrew/RTL support
        locale: 'he-IL',
        timezoneId: 'Asia/Jerusalem',
    },
    
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
    
    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results.json' }]
    ],
    
    // Web server - use existing servers
    webServer: [
        {
            command: 'echo "Using existing server on port 8080"',
            port: 8080,
            reuseExistingServer: true,
        },
        {
            command: 'echo "Using existing API on port 3001"',
            port: 3001,
            reuseExistingServer: true,
        }
    ]
};
