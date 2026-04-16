import { Page, Locator, expect } from '@playwright/test'

export class ContentPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly syncButton: Locator
  readonly addContentButton: Locator
  readonly platformFilterButtons: Locator  // 유튜브, 인스타 피드, 인스타 릴스, 틱톡, 네이버 블로그
  readonly kpiCards: Locator
  readonly analyticsTable: Locator
  readonly contentTable: Locator
  readonly contentTableRows: Locator
  readonly contentSearch: Locator
  readonly groupingSelect: Locator
  readonly loadingSkeleton: Locator
  readonly emptyState: Locator
  // Add Content Dialog
  readonly dialog: Locator
  readonly dialogTitleInput: Locator
  readonly dialogUrlInput: Locator
  readonly dialogBudgetInput: Locator
  readonly dialogSaveButton: Locator
  readonly dialogCancelButton: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.syncButton = page.locator('button:has-text("동기화"), button:has-text("Sync")')
    this.addContentButton = page.locator('button:has-text("콘텐츠 추가"), button:has-text("추가")')
    this.platformFilterButtons = page.locator('button:has-text("전체"), button:has-text("유튜브"), button:has-text("인스타"), button:has-text("틱톡"), button:has-text("네이버")')
    this.kpiCards = page.locator('.glass-card, [class*="glass"]').filter({ has: page.locator('p, span') })
    this.analyticsTable = page.locator('table').first()
    this.contentTable = page.locator('table').last()
    this.contentTableRows = page.locator('table:last-of-type tbody tr')
    this.contentSearch = page.locator('input[placeholder*="콘텐츠명 검색"]')
    this.groupingSelect = page.locator('select, button:has-text("캠페인별"), button:has-text("월별"), button:has-text("콘텐츠별")')
    this.loadingSkeleton = page.locator('.animate-pulse, [class*="skeleton"]')
    this.emptyState = page.locator('text=콘텐츠 데이터가 없습니다')
    // Dialog
    this.dialog = page.locator('[role="dialog"]')
    this.dialogTitleInput = page.locator('[role="dialog"] input[name="title"], [role="dialog"] input[placeholder*="제목"]')
    this.dialogUrlInput = page.locator('[role="dialog"] input[name="url"], [role="dialog"] input[placeholder*="URL"]')
    this.dialogBudgetInput = page.locator('[role="dialog"] input[name="budget"], [role="dialog"] input[placeholder*="예산"]')
    this.dialogSaveButton = page.locator('[role="dialog"] button:has-text("저장"), [role="dialog"] button:has-text("추가")')
    this.dialogCancelButton = page.locator('[role="dialog"] button:has-text("취소")')
  }

  async goto() {
    await this.page.goto('/content')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingSkeleton.first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async openAddContentDialog() {
    await this.addContentButton.click()
    await expect(this.dialog).toBeVisible()
  }

  async filterByPlatform(platform: string) {
    await this.page.locator(`button:has-text("${platform}")`).click()
  }

  async searchContent(query: string) {
    await this.contentSearch.fill(query)
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}
