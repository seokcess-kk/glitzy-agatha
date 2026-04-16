import { Page, Locator, expect } from '@playwright/test'

export class PatientsPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly viewToggleList: Locator
  readonly viewToggleCalendar: Locator
  readonly statsCards: Locator
  readonly searchInput: Locator
  readonly statusFilterButtons: Locator
  readonly bookingCards: Locator
  readonly calendarGrid: Locator
  readonly loadingSkeleton: Locator
  readonly emptyState: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.viewToggleList = page.locator('button:has(.lucide-list), button:has-text("목록")')
    this.viewToggleCalendar = page.locator('button:has(.lucide-calendar), button:has-text("캘린더")')
    this.statsCards = page.locator('.glass-card, [class*="glass"]').filter({ has: page.locator('p, span') })
    this.searchInput = page.locator('input[placeholder*="이름 또는 전화번호"]')
    this.statusFilterButtons = page.locator('button:has-text("전체"), button:has-text("예약확정"), button:has-text("방문완료"), button:has-text("취소"), button:has-text("노쇼")')
    this.bookingCards = page.locator('[class*="glass-card"]').filter({ has: page.locator('button[aria-expanded]') })
    this.calendarGrid = page.locator('[class*="grid-cols-7"]')
    this.loadingSkeleton = page.locator('.animate-pulse, [class*="skeleton"]')
    this.emptyState = page.locator('text=예약 데이터가 없습니다, text=검색 결과가 없습니다')
  }

  async goto() {
    await this.page.goto('/patients')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingSkeleton.first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async switchToCalendarView() {
    await this.viewToggleCalendar.click()
  }

  async switchToListView() {
    await this.viewToggleList.click()
  }

  async searchBookings(query: string) {
    await this.searchInput.fill(query)
  }

  async filterByStatus(status: string) {
    await this.page.locator(`button:has-text("${status}")`).click()
  }

  async expandBooking(index: number) {
    const expandButtons = this.page.locator('button[aria-expanded]')
    await expandButtons.nth(index).click()
  }

  async getBookingCount(): Promise<number> {
    return this.bookingCards.count()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}
