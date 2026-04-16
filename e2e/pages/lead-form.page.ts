import { Page, Locator, expect } from '@playwright/test'

export class LeadFormPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly mainContent: Locator
  readonly utmBadges: Locator
  readonly nameInput: Locator
  readonly phoneInput: Locator
  readonly submitButton: Locator
  readonly utmDetailsToggle: Locator
  readonly utmSourceInput: Locator
  readonly utmMediumInput: Locator
  readonly utmCampaignInput: Locator
  readonly resultCard: Locator
  readonly clientWarning: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.mainContent = page.locator('main')
    this.utmBadges = page.locator('[class*="badge"], [class*="Badge"]')
    this.nameInput = page.locator('input[placeholder*="이름"], input[name="name"]')
    this.phoneInput = page.locator('input[type="tel"], input[placeholder*="010"]')
    this.submitButton = page.locator('button:has-text("리드 등록")')
    this.utmDetailsToggle = page.locator('summary, details')
    this.utmSourceInput = page.locator('input[name="utm_source"], input[placeholder*="utm_source"]')
    this.utmMediumInput = page.locator('input[name="utm_medium"], input[placeholder*="utm_medium"]')
    this.utmCampaignInput = page.locator('input[name="utm_campaign"], input[placeholder*="utm_campaign"]')
    this.resultCard = page.locator('[class*="border-green"], [class*="border-red"]')
    this.clientWarning = page.locator('text=클라이언트을 먼저 선택해주세요, [class*="border-amber"]')
  }

  async goto(utmParams?: string) {
    const url = utmParams ? `/lead-form?${utmParams}` : '/lead-form'
    await this.page.goto(url)
    await this.page.waitForLoadState('networkidle')
  }

  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  async fillPhone(phone: string) {
    await this.phoneInput.fill(phone)
  }

  async submitLead() {
    await this.submitButton.click()
  }

  async toggleUtmDetails() {
    await this.utmDetailsToggle.first().click()
  }

  async expectPageLoaded() {
    await expect(this.mainContent).toBeVisible()
  }
}
