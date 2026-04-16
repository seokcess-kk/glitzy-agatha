import { Page, Locator, expect } from '@playwright/test'

export class MonitorPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly refreshButton: Locator
  readonly statsCards: Locator
  readonly riskFilterButtons: Locator
  readonly auditTable: Locator
  readonly auditTableRows: Locator
  readonly analyzeButtons: Locator
  readonly loadingSkeleton: Locator
  readonly emptyState: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.refreshButton = page.locator('button:has(.lucide-refresh-cw)')
    this.statsCards = page.locator('.glass-card, [class*="glass"]').filter({ has: page.locator('p, span') })
    this.riskFilterButtons = page.locator('button:has-text("전체"), button:has-text("위험"), button:has-text("주의"), button:has-text("안전"), button:has-text("미분석")')
    this.auditTable = page.locator('table')
    this.auditTableRows = page.locator('table tbody tr')
    this.analyzeButtons = page.locator('button:has-text("분석")')
    this.loadingSkeleton = page.locator('.animate-pulse, [class*="skeleton"]')
    this.emptyState = page.locator('text=콘텐츠가 없습니다, text=포스트를 먼저 등록')
  }

  async goto() {
    await this.page.goto('/monitor')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingSkeleton.first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async filterByRisk(level: string) {
    await this.page.locator(`button:has-text("${level}")`).first().click()
  }

  async clickAnalyze(index: number) {
    await this.analyzeButtons.nth(index).click()
  }

  async expandRow(index: number) {
    await this.auditTableRows.nth(index).click()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}
