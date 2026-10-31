import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Every test but the tour's own starts past the first-visit tour.
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:5173', localStorage: [{ name: 'logina.demoTourSeen', value: '1' }] }] },
  },
  webServer: [
    { command: 'pnpm --dir ../.. exec tsx tools/dev-stack.ts', url: 'http://localhost:8090/api/v1/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm exec vite --port 5173', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
  ],
});
