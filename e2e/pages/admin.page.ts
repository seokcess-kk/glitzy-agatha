import { Page, Locator, expect } from '@playwright/test'

export class AdminUsersPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly createUserButton: Locator
  readonly usersTable: Locator
  readonly usersTableRows: Locator
  readonly loadingState: Locator
  readonly emptyState: Locator
  // Create User Dialog
  readonly dialog: Locator
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly roleSelect: Locator
  readonly clientSelect: Locator
  readonly dialogCreateButton: Locator
  readonly dialogCancelButton: Locator
  // Toggle buttons
  readonly toggleButtons: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.createUserButton = page.locator('button:has-text("계정 생성"), button:has-text("사용자 추가")')
    this.usersTable = page.locator('table')
    this.usersTableRows = page.locator('table tbody tr')
    this.loadingState = page.locator('text=로딩 중')
    this.emptyState = page.locator('text=등록된 계정이 없습니다')
    // Dialog
    this.dialog = page.locator('[role="dialog"]')
    this.usernameInput = page.locator('[role="dialog"] input[name="username"], [role="dialog"] input[placeholder*="아이디"]')
    this.passwordInput = page.locator('[role="dialog"] input[name="password"], [role="dialog"] input[type="password"]')
    this.roleSelect = page.locator('[role="dialog"] select, [role="dialog"] button:has-text("역할")')
    this.clientSelect = page.locator('[role="dialog"] select:nth-of-type(2), [role="dialog"] button:has-text("클라이언트")')
    this.dialogCreateButton = page.locator('[role="dialog"] button:has-text("생성"), [role="dialog"] button:has-text("추가")')
    this.dialogCancelButton = page.locator('[role="dialog"] button:has-text("취소")')
    // Toggle
    this.toggleButtons = page.locator('button[aria-label*="활성화"], button[aria-label*="비활성화"], button:has(.lucide-toggle-right), button:has(.lucide-toggle-left)')
  }

  async goto() {
    await this.page.goto('/admin/users')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingState.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async openCreateDialog() {
    await this.createUserButton.click()
    await expect(this.dialog).toBeVisible()
  }

  async getUserCount(): Promise<number> {
    return this.usersTableRows.count()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}

export class AdminClientsPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly createClientButton: Locator
  readonly clientsTable: Locator
  readonly clientsTableRows: Locator
  readonly loadingState: Locator
  readonly emptyState: Locator
  // Create Dialog
  readonly dialog: Locator
  readonly nameInput: Locator
  readonly slugInput: Locator
  readonly dialogCreateButton: Locator
  readonly dialogCancelButton: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.createClientButton = page.locator('button:has-text("클라이언트 등록"), button:has-text("클라이언트 추가")')
    this.clientsTable = page.locator('table')
    this.clientsTableRows = page.locator('table tbody tr')
    this.loadingState = page.locator('text=로딩 중')
    this.emptyState = page.locator('text=등록된 클라이언트이 없습니다')
    // Dialog
    this.dialog = page.locator('[role="dialog"]')
    this.nameInput = page.locator('[role="dialog"] input[name="name"], [role="dialog"] input[placeholder*="성형외과"]')
    this.slugInput = page.locator('[role="dialog"] input[name="slug"], [role="dialog"] input[placeholder*="mirae"]')
    this.dialogCreateButton = page.locator('[role="dialog"] button:has-text("등록"), [role="dialog"] button:has-text("생성")')
    this.dialogCancelButton = page.locator('[role="dialog"] button:has-text("취소")')
  }

  async goto() {
    await this.page.goto('/admin/clients')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingState.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async openCreateDialog() {
    await this.createClientButton.click()
    await expect(this.dialog).toBeVisible()
  }

  async getClientCount(): Promise<number> {
    return this.clientsTableRows.count()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}

export class AdminAdCreativesPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly createButton: Locator
  readonly creativesTable: Locator
  readonly creativesTableRows: Locator
  readonly loadingState: Locator
  readonly emptyState: Locator
  // Dialog
  readonly dialog: Locator
  readonly nameInput: Locator
  readonly utmContentInput: Locator
  readonly clientSelect: Locator
  readonly platformSelect: Locator
  readonly dialogSaveButton: Locator
  readonly dialogCancelButton: Locator
  // Action buttons
  readonly editButtons: Locator
  readonly deleteButtons: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.createButton = page.locator('button:has-text("소재 등록"), button:has-text("소재 추가"), button:has-text("추가")')
    this.creativesTable = page.locator('table')
    this.creativesTableRows = page.locator('table tbody tr')
    this.loadingState = page.locator('text=로딩 중')
    this.emptyState = page.locator('text=등록된 광고 소재가 없습니다')
    // Dialog
    this.dialog = page.locator('[role="dialog"]')
    this.nameInput = page.locator('[role="dialog"] input[name="name"], [role="dialog"] input[placeholder*="소재"]')
    this.utmContentInput = page.locator('[role="dialog"] input[name="utm_content"], [role="dialog"] input[placeholder*="utm_content"]')
    this.clientSelect = page.locator('[role="dialog"] select').first()
    this.platformSelect = page.locator('[role="dialog"] select').nth(1)
    this.dialogSaveButton = page.locator('[role="dialog"] button:has-text("저장"), [role="dialog"] button:has-text("등록")')
    this.dialogCancelButton = page.locator('[role="dialog"] button:has-text("취소")')
    // Actions
    this.editButtons = page.locator('button:has(.lucide-pencil), button:has(.lucide-edit)')
    this.deleteButtons = page.locator('button:has(.lucide-trash)')
  }

  async goto() {
    await this.page.goto('/admin/ad-creatives')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingState.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async openCreateDialog() {
    await this.createButton.click()
    await expect(this.dialog).toBeVisible()
  }

  async getCreativeCount(): Promise<number> {
    return this.creativesTableRows.count()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}

export class AdminLandingPagesPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly createButton: Locator
  readonly landingPagesTable: Locator
  readonly landingPagesTableRows: Locator
  readonly loadingState: Locator
  readonly emptyState: Locator
  readonly copyButtons: Locator
  // Dialog
  readonly dialog: Locator
  readonly nameInput: Locator
  readonly fileSelect: Locator
  readonly clientSelect: Locator
  readonly descriptionInput: Locator
  readonly activeToggle: Locator
  readonly dialogSaveButton: Locator
  readonly dialogCancelButton: Locator
  // Actions
  readonly editButtons: Locator
  readonly deleteButtons: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.createButton = page.locator('button:has-text("랜딩 페이지 등록"), button:has-text("추가")')
    this.landingPagesTable = page.locator('table')
    this.landingPagesTableRows = page.locator('table tbody tr')
    this.loadingState = page.locator('text=로딩 중')
    this.emptyState = page.locator('text=등록된 랜딩 페이지가 없습니다')
    this.copyButtons = page.locator('button[aria-label="URL 복사"], button:has(.lucide-copy)')
    // Dialog
    this.dialog = page.locator('[role="dialog"]')
    this.nameInput = page.locator('[role="dialog"] input[name="name"], [role="dialog"] input[placeholder*="프로모션"]')
    this.fileSelect = page.locator('[role="dialog"] select').first()
    this.clientSelect = page.locator('[role="dialog"] select').nth(1)
    this.descriptionInput = page.locator('[role="dialog"] textarea')
    this.activeToggle = page.locator('[role="dialog"] button[role="switch"]')
    this.dialogSaveButton = page.locator('[role="dialog"] button:has-text("저장"), [role="dialog"] button:has-text("등록")')
    this.dialogCancelButton = page.locator('[role="dialog"] button:has-text("취소")')
    // Actions
    this.editButtons = page.locator('button:has(.lucide-pencil), button:has(.lucide-edit)')
    this.deleteButtons = page.locator('button:has(.lucide-trash)')
  }

  async goto() {
    await this.page.goto('/admin/landing-pages')
    await this.page.waitForLoadState('networkidle')
  }

  async waitForLoad() {
    await this.loadingState.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  }

  async openCreateDialog() {
    await this.createButton.click()
    await expect(this.dialog).toBeVisible()
  }

  async getLandingPageCount(): Promise<number> {
    return this.landingPagesTableRows.count()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}
