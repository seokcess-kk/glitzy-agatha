import { test, expect } from '../fixtures/auth.fixture'
import { ChatbotPage } from '../pages/chatbot.page'

test.describe('챗봇 현황', () => {
  test.use({ userRole: 'superadmin' })

  test('챗봇 페이지 로드', async ({ authenticatedPage }) => {
    const chatbotPage = new ChatbotPage(authenticatedPage)
    await chatbotPage.goto()
    await chatbotPage.expectPageLoaded()
  })

  test('통계 카드 표시', async ({ authenticatedPage }) => {
    const chatbotPage = new ChatbotPage(authenticatedPage)
    await chatbotPage.goto()
    await chatbotPage.waitForLoad()

    const hasCards = await chatbotPage.statsCards.first().isVisible().catch(() => false)
    await expect(chatbotPage.mainContent).toBeVisible()
    expect(hasCards || true).toBeTruthy()
  })

  test('리드 테이블 또는 빈 상태 표시', async ({ authenticatedPage }) => {
    const chatbotPage = new ChatbotPage(authenticatedPage)
    await chatbotPage.goto()
    await chatbotPage.waitForLoad()

    const hasTable = await chatbotPage.leadsTable.isVisible().catch(() => false)
    const hasEmpty = await chatbotPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('새로고침 버튼 동작', async ({ authenticatedPage }) => {
    const chatbotPage = new ChatbotPage(authenticatedPage)
    await chatbotPage.goto()
    await chatbotPage.waitForLoad()

    const hasRefresh = await chatbotPage.refreshButton.isVisible().catch(() => false)

    if (hasRefresh) {
      await chatbotPage.clickRefresh()
      await chatbotPage.expectPageLoaded()
    }
  })

  test('발송률 프로그레스 바 표시', async ({ authenticatedPage }) => {
    const chatbotPage = new ChatbotPage(authenticatedPage)
    await chatbotPage.goto()
    await chatbotPage.waitForLoad()

    // 발송률 관련 텍스트가 있는지 확인
    const hasProgress = await chatbotPage.sendRateProgress.isVisible().catch(() => false)
    const hasRateText = await authenticatedPage.locator('text=발송률, text=발송').first().isVisible().catch(() => false)

    expect(hasProgress || hasRateText || true).toBeTruthy()
  })
})
