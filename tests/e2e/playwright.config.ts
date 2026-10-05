import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: '.', testMatch: '*.spec.ts', workers: 1,
    use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 360, height: 800 }, timezoneId: 'America/Los_Angeles', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
    webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
});
