import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4181', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: { command: 'node tests/fullstack/server.ts', cwd: fileURLToPath(new URL('../..', import.meta.url)), url: 'http://127.0.0.1:4181', reuseExistingServer: false },
});
