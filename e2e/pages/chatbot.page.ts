import { Page, Locator, expect } from '@playwright/test'

export class ChatbotPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly refreshButton: Locator
  readonly statsCards: Locator
  readonly sendRateProgress: Locator
  readonly leadsTable: Locator
  readonly leadsTableRows: Locator
  readonly loadingSkeleton: Locator
  readonly emptyState: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.refreshButton = page.locator('button:has(.lucide-refresh-cw)')
    this.statsCards = page.locator('.glass-card, [class*="glass"]').filter({ has: page.locator('p, span') })
    this.sendRateProgress = page.locator('[class*="rounded-full"]:has([class*="bg-emerald"]), [role="progressbar"]')
    this.leadsTable = page.locator('table')
    this.leadsTableRows = page.locator('table tbody tr')
    this.loadingSkeleton = page.locator('.animate-pulse, [class*="skeleton"]')
    this.emptyState = page.locator('text=인입된 리드가 없습니다')
  }

  async goto() {
    await this.page.goto('/chatbot')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingSkeleton.first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async clickRefresh() {
    await this.refreshButton.click()
  }

  async getLeadCount(): Promise<number> {
    return this.leadsTableRows.count()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}
