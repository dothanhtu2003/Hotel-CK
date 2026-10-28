import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: '**/*.e2e.ts', fullyParallel: false, workers: 1, timeout: 30_000, reporter: 'list',
  use: { baseURL: 'http://localhost:5174', viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'only-on-failure',
    launchOptions: { ...(process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : { channel: 'chrome' }) } },
  webServer: [
    { command: 'node scripts/test-backend.mjs', url: 'http://127.0.0.1:3301/api/health', reuseExistingServer: false, timeout: 60_000 },
    { command: 'node node_modules/vite/bin/vite.js --host localhost --port 5174 --strictPort', url: 'http://localhost:5174', env: { VITE_API_BASE_URL: 'http://127.0.0.1:3301/api' }, reuseExistingServer: false },
  ],
});
