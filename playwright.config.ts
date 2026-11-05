import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 14'],
        viewport: { width: 390, height: 844 }
      }
    }
  ],
  webServer: [
    {
      command: 'npm run start -w @menugo/api',
      port: 5001,
      reuseExistingServer: true,
      timeout: 120 * 1000
    },
    {
      command: 'npm run start -w @menugo/web',
      port: 3000,
      reuseExistingServer: true,
      timeout: 120 * 1000
    }
  ]
});

