import { test as base, Page } from '@playwright/test'

// 사용자 역할 타입
export type UserRole = 'superadmin' | 'clinic_admin'

// 테스트 계정 정보
export const TEST_USERS: Record<UserRole, { email: string; password: string }> = {
  superadmin: {
    email: process.env.E2E_SUPERADMIN_EMAIL || 'admin@glitzy.co.kr',
    password: process.env.E2E_SUPERADMIN_PASSWORD || 'test-password',
  },
  clinic_admin: {
    email: process.env.E2E_CLINIC_EMAIL || 'clinic@test.com',
    password: process.env.E2E_CLINIC_PASSWORD || 'test-password',
  },
}

// 로그인 헬퍼 함수
export async function loginAs(page: Page, role: UserRole): Promise<void> {
  const user = TEST_USERS[role]

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')

  // 대시보드 리다이렉트 대기
  await page.waitForURL('/', { timeout: 15000 })
}

// 확장된 test fixture
interface AuthFixtures {
  authenticatedPage: Page
  userRole: UserRole
}

export const test = base.extend<AuthFixtures>({
  userRole: ['superadmin', { option: true }],

  authenticatedPage: async ({ page, userRole }, use) => {
    await loginAs(page, userRole)
    await use(page)
  },
})

export { expect } from '@playwright/test'
