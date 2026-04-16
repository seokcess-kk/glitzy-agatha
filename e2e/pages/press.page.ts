import { Page, Locator, expect } from '@playwright/test'

export class PressPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly refreshButton: Locator
  readonly syncButton: Locator
  readonly statsCards: Locator
  readonly articleGroups: Locator
  readonly articleItems: Locator
  readonly loadingSkeleton: Locator
  readonly emptyState: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.refreshButton = page.locator('button:has(.lucide-refresh-cw)')
    this.syncButton = page.locator('button:has-text("수집"), button:has-text("동기화")')
    this.statsCards = page.locator('.glass-card, [class*="glass"]').filter({ has: page.locator('p, span') })
    this.articleGroups = page.locator('[class*="glass-card"]').filter({ has: page.locator('a[target="_blank"]') })
    this.articleItems = page.locator('a[target="_blank"]')
    this.loadingSkeleton = page.locator('.animate-pulse, [class*="skeleton"]')
    this.emptyState = page.locator('text=수집된 언론보도가 없습니다, text=언론보도가 없습니다')
  }

  async goto() {
    await this.page.goto('/press')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingSkeleton.first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async clickSync() {
    await this.syncButton.click()
  }

  async getArticleCount(): Promise<number> {
    return this.articleItems.count()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}
