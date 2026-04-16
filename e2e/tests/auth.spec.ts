import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('인증', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    await loginPage.goto()
  })

  test('로그인 페이지가 올바르게 표시됨', async () => {
    await loginPage.expectFormVisible()
  })

  test('유효한 자격 증명으로 로그인 성공', async ({ page }) => {
    const user = TEST_USERS.superadmin

    await loginPage.login(user.email, user.password)
    await loginPage.expectLoginSuccess()

    // 대시보드에 도착했는지 확인
    await expect(page.locator('main')).toBeVisible()
  })

  test('잘못된 비밀번호로 로그인 실패', async () => {
    await loginPage.login(TEST_USERS.superadmin.email, 'wrong-password')
    await loginPage.expectLoginFailure()
  })

  test('빈 이메일로 로그인 시도 실패', async ({ page }) => {
    await loginPage.login('', 'any-password')

    // HTML5 유효성 검사 또는 커스텀 에러
    const isInvalid = await page.locator('input[name="email"]:invalid').count() > 0
    const hasError = await loginPage.errorMessage.isVisible().catch(() => false)

    expect(isInvalid || hasError).toBeTruthy()
  })

  test('빈 비밀번호로 로그인 시도 실패', async ({ page }) => {
    await loginPage.login(TEST_USERS.superadmin.email, '')

    const isInvalid = await page.locator('input[name="password"]:invalid').count() > 0
    const hasError = await loginPage.errorMessage.isVisible().catch(() => false)

    expect(isInvalid || hasError).toBeTruthy()
  })

  test('미인증 사용자가 보호된 페이지 접근 시 로그인 페이지로 리다이렉트', async ({ page }) => {
    // 직접 보호된 페이지로 이동 시도
    await page.goto('/leads')

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/)
  })

  test('미인증 사용자가 대시보드 접근 시 로그인 페이지로 리다이렉트', async ({ page }) => {
    await page.goto('/')

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('로그아웃', () => {
  test('로그인 후 로그아웃 성공', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_USERS.superadmin.email, TEST_USERS.superadmin.password)
    await loginPage.expectLoginSuccess()

    // 로그아웃 버튼 클릭
    const logoutButton = page.locator('button:has-text("로그아웃"), a:has-text("로그아웃")')

    if (await logoutButton.isVisible()) {
      await logoutButton.click()
    } else {
      // 드롭다운 메뉴에서 찾기
      await page.locator('[data-testid="user-menu"]').click().catch(() => {})
      await page.click('text=로그아웃').catch(() => {})
    }

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})
