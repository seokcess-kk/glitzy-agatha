import { Page, Locator, expect } from '@playwright/test'

export class AdsPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly dateFilter: Locator
  readonly refreshButton: Locator
  readonly syncButton: Locator
  readonly platformFilterButtons: Locator
  readonly kpiCards: Locator
  readonly campaignTable: Locator
  readonly campaignTableRows: Locator
  readonly campaignSearch: Locator
  readonly loadingSkeleton: Locator
  readonly emptyState: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.dateFilter = page.locator('button:has-text("최근"), [role="combobox"]')
    this.refreshButton = page.locator('button:has(.lucide-refresh-cw), button:has-text("새로고침")')
    this.syncButton = page.locator('button:has-text("지금 데이터 수집"), button:has-text("수집 중")')
    this.platformFilterButtons = page.locator('button:has-text("전체 매체"), button:has-text("Meta"), button:has-text("Google"), button:has-text("TikTok")')
    this.kpiCards = page.locator('.glass-card, [class*="glass"]').filter({ has: page.locator('p, span') })
    this.campaignTable = page.locator('table')
    this.campaignTableRows = page.locator('table tbody tr')
    this.campaignSearch = page.locator('input[placeholder*="캠페인"]')
    this.loadingSkeleton = page.locator('.animate-pulse, [class*="skeleton"]')
    this.emptyState = page.locator('text=광고 데이터가 없습니다')
  }

  async goto() {
    await this.page.goto('/ads')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingSkeleton.first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async selectDateRange(days: string) {
    await this.dateFilter.first().click()
    await this.page.locator(`[role="option"]:has-text("${days}"), [data-value="${days}"]`).click()
  }

  async clickPlatformFilter(platform: string) {
    await this.page.locator(`button:has-text("${platform}")`).click()
  }

  async searchCampaign(query: string) {
    await this.campaignSearch.fill(query)
  }

  async clickSync() {
    await this.syncButton.click()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}
