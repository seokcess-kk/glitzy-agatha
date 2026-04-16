import { Page, Locator, expect } from '@playwright/test'

export class UtmPage {
  readonly page: Page
  readonly pageTitle: Locator
  readonly baseUrlInput: Locator
  readonly sourceSelect: Locator
  readonly mediumSelect: Locator
  readonly campaignInput: Locator
  readonly contentInput: Locator
  readonly termInput: Locator
  readonly generatedUrlDisplay: Locator
  readonly copyButton: Locator
  readonly saveButton: Locator
  readonly resetButton: Locator
  readonly historyList: Locator
  readonly historyItems: Locator
  readonly historySearchInput: Locator
  readonly qrCodeContainer: Locator

  constructor(page: Page) {
    this.page = page
    this.pageTitle = page.locator('h1')
    this.baseUrlInput = page.locator('input[placeholder*="URL"], input[name="baseUrl"], [data-testid="base-url"]')
    this.sourceSelect = page.locator('[data-testid="utm-source"], select[name="utm_source"]')
    this.mediumSelect = page.locator('[data-testid="utm-medium"], select[name="utm_medium"]')
    this.campaignInput = page.locator('input[name="utm_campaign"], [data-testid="utm-campaign"]')
    this.contentInput = page.locator('input[name="utm_content"], [data-testid="utm-content"]')
    this.termInput = page.locator('input[name="utm_term"], [data-testid="utm-term"]')
    this.generatedUrlDisplay = page.locator('[data-testid="generated-url"], .generated-url, code')
    this.copyButton = page.locator('button:has-text("복사"), [data-testid="copy-button"]')
    this.saveButton = page.locator('button:has-text("저장"), [data-testid="save-button"]')
    this.resetButton = page.locator('button:has-text("초기화"), button:has-text("Reset")')
    this.historyList = page.locator('[data-testid="utm-history"], .utm-history')
    this.historyItems = page.locator('[data-testid="history-item"], .history-item')
    this.historySearchInput = page.locator('[data-testid="history-search"], input[placeholder*="히스토리"]')
    this.qrCodeContainer = page.locator('[data-testid="qr-code"], canvas, svg')
  }

  async goto() {
    await this.page.goto('/utm')
    await this.page.waitForLoadState('networkidle')
  }

  async fillBaseUrl(url: string) {
    await this.baseUrlInput.fill(url)
  }

  async selectSource(source: string) {
    await this.sourceSelect.click()
    await this.page.locator(`[data-value="${source}"], [role="option"]:has-text("${source}")`).click()
  }

  async selectMedium(medium: string) {
    await this.mediumSelect.click()
    await this.page.locator(`[data-value="${medium}"], [role="option"]:has-text("${medium}")`).click()
  }

  async fillCampaign(campaign: string) {
    await this.campaignInput.fill(campaign)
  }

  async fillContent(content: string) {
    await this.contentInput.fill(content)
  }

  async fillTerm(term: string) {
    await this.termInput.fill(term)
  }

  async generateUtmLink(options: {
    baseUrl: string
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }) {
    await this.fillBaseUrl(options.baseUrl)

    if (options.source) {
      await this.selectSource(options.source)
    }
    if (options.medium) {
      await this.selectMedium(options.medium)
    }
    if (options.campaign) {
      await this.fillCampaign(options.campaign)
    }
    if (options.content) {
      await this.fillContent(options.content)
    }
    if (options.term) {
      await this.fillTerm(options.term)
    }
  }

  async copyGeneratedUrl() {
    await this.copyButton.click()
  }

  async saveToHistory() {
    await this.saveButton.click()
  }

  async resetForm() {
    await this.resetButton.click()
  }

  async searchHistory(query: string) {
    await this.historySearchInput.fill(query)
  }

  async getGeneratedUrl(): Promise<string> {
    return (await this.generatedUrlDisplay.textContent()) || ''
  }

  async getHistoryItemCount(): Promise<number> {
    return this.historyItems.count()
  }

  async clickHistoryItem(index: number) {
    await this.historyItems.nth(index).click()
  }

  async expectGeneratedUrlContains(text: string) {
    const url = await this.getGeneratedUrl()
    expect(url).toContain(text)
  }

  async expectQrCodeVisible() {
    await expect(this.qrCodeContainer).toBeVisible()
  }
}
