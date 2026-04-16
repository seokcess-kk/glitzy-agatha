import { Page, Locator, expect } from '@playwright/test'

export class LeadsPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly leadsTable: Locator
  readonly tableRows: Locator
  readonly searchInput: Locator
  readonly statusFilter: Locator
  readonly channelFilter: Locator
  readonly dateRangePicker: Locator
  readonly exportButton: Locator
  readonly pagination: Locator
  readonly emptyState: Locator
  readonly loadingSpinner: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.leadsTable = page.locator('table, [data-testid="leads-table"]')
    this.tableRows = page.locator('tbody tr, [data-testid="lead-row"]')
    this.searchInput = page.locator('input[placeholder*="검색"], [data-testid="search-input"]')
    this.statusFilter = page.locator('[data-testid="status-filter"], select:has-text("상태")')
    this.channelFilter = page.locator('[data-testid="channel-filter"], select:has-text("채널")')
    this.dateRangePicker = page.locator('[data-testid="date-range"], input[type="date"]')
    this.exportButton = page.locator('button:has-text("내보내기"), button:has-text("Export")')
    this.pagination = page.locator('[data-testid="pagination"], nav[aria-label="pagination"]')
    this.emptyState = page.locator('[data-testid="empty-state"], text=데이터가 없습니다')
    this.loadingSpinner = page.locator('[data-testid="loading"], .animate-spin')
  }

  async goto() {
    await this.page.goto('/leads')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForTableLoad() {
    // 로딩 완료 대기
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
    // 테이블 또는 빈 상태 표시 대기
    await Promise.race([
      this.leadsTable.waitFor({ state: 'visible', timeout: 10000 }),
      this.emptyState.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {})
  }

  async searchLeads(query: string) {
    await this.searchInput.fill(query)
    await this.page.keyboard.press('Enter')
    await this.waitForTableLoad()
  }

  async filterByStatus(status: string) {
    await this.statusFilter.click()
    await this.page.click(`[data-value="${status}"], text=${status}`)
    await this.waitForTableLoad()
  }

  async filterByChannel(channel: string) {
    await this.channelFilter.click()
    await this.page.click(`[data-value="${channel}"], text=${channel}`)
    await this.waitForTableLoad()
  }

  async getRowCount(): Promise<number> {
    await this.waitForTableLoad()
    return this.tableRows.count()
  }

  async clickRow(index: number) {
    await this.tableRows.nth(index).click()
  }

  async updateLeadStatus(rowIndex: number, newStatus: string) {
    await this.tableRows.nth(rowIndex).locator('[data-testid="status-select"]').click()
    await this.page.click(`[data-value="${newStatus}"]`)
  }

  async expectTableVisible() {
    await expect(this.leadsTable).toBeVisible()
  }

  async expectRowCount(count: number) {
    await expect(this.tableRows).toHaveCount(count)
  }

  async expectRowContainsText(index: number, text: string) {
    await expect(this.tableRows.nth(index)).toContainText(text)
  }
}
