import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end checks against the running app (UI on :4200, API on :8087): `npm run e2e`.
 * They are not part of `npm test`. A dev server that is already running is reused.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
