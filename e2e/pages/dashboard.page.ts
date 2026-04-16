import { Page, Locator, expect } from '@playwright/test'

export class DashboardPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly sidebar: Locator
  readonly mainContent: Locator
  readonly statsCards: Locator
  readonly chartContainer: Locator
  readonly userMenu: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1').first()
    this.sidebar = page.locator('aside, nav[role="navigation"]')
    this.mainContent = page.locator('main')
    this.statsCards = page.locator('[data-testid="stats-card"], .stats-card')
    this.chartContainer = page.locator('[data-testid="chart"], .recharts-wrapper')
    this.userMenu = page.locator('[data-testid="user-menu"], button:has-text("로그아웃")')
  }

  async goto() {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }

  async expectDashboardLoaded() {
    await expect(this.mainContent).toBeVisible()
  }

  async navigateTo(menuItem: string) {
    await this.page.click(`a:has-text("${menuItem}"), button:has-text("${menuItem}")`)
  }

  async logout() {
    // 로그아웃 버튼 찾기 (다양한 UI 패턴 지원)
    const logoutButton = this.page.locator('button:has-text("로그아웃"), a:has-text("로그아웃")')
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
    } else {
      // 드롭다운 메뉴 열기
      await this.userMenu.click()
      await this.page.click('text=로그아웃')
    }
  }

  async expectClientIdVisible(clientId: number) {
    // superadmin이 특정 클라이언트 데이터를 조회할 때 URL 확인
    await expect(this.page).toHaveURL(new RegExp(`client_id=${clientId}`))
  }
}
