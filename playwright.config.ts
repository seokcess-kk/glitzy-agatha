import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 테스트 설정
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // 인증 설정 프로젝트 (storageState 생성)
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Chrome 테스트 (인증 필요 - auth/landing-page 제외)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/superadmin.json',
      },
      dependencies: ['setup'],
      testIgnore: /(auth|landing-page|demo)\.spec\.ts/,
    },
    // 인증 없이 실행하는 테스트 (로그인, 랜딩페이지 등)
    {
      name: 'chromium-no-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /(auth|landing-page)\.spec\.ts/,
    },
    // Demo mode 테스트 — 자체 쿠키 발급, storageState 미사용
    {
      name: 'demo',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /demo\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  // 전역 설정
  globalSetup: undefined, // storageState 방식으로 대체
  expect: {
    timeout: 10000,
  },
  timeout: 30000,
})
