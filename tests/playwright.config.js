const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    timeout: 45000,
    retries: 0,
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
    ],
    use: {
        baseURL: 'http://localhost:3001',
        screenshot: 'on',
        video: 'off',
        trace: 'off',
        headless: true,
        viewport: { width: 1400, height: 900 },
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    outputDir: 'test-results',
});
