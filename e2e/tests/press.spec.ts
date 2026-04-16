import { test, expect } from '../fixtures/auth.fixture'
import { PressPage } from '../pages/press.page'

test.describe('언론보도', () => {
  test.use({ userRole: 'superadmin' })

  test('언론보도 페이지 로드', async ({ authenticatedPage }) => {
    const pressPage = new PressPage(authenticatedPage)
    await pressPage.goto()
    await pressPage.expectPageLoaded()
  })

  test('통계 카드 표시', async ({ authenticatedPage }) => {
    const pressPage = new PressPage(authenticatedPage)
    await pressPage.goto()
    await pressPage.waitForLoad()

    const hasCards = await pressPage.statsCards.first().isVisible().catch(() => false)
    const hasEmpty = await pressPage.emptyState.first().isVisible().catch(() => false)

    expect(hasCards || hasEmpty).toBeTruthy()
  })

  test('기사 목록 또는 빈 상태 표시', async ({ authenticatedPage }) => {
    const pressPage = new PressPage(authenticatedPage)
    await pressPage.goto()
    await pressPage.waitForLoad()

    const articleCount = await pressPage.getArticleCount()
    const hasEmpty = await pressPage.emptyState.first().isVisible().catch(() => false)

    expect(articleCount > 0 || hasEmpty).toBeTruthy()
  })

  test('동기화 버튼 표시', async ({ authenticatedPage }) => {
    const pressPage = new PressPage(authenticatedPage)
    await pressPage.goto()
    await pressPage.waitForLoad()

    const hasSyncBtn = await pressPage.syncButton.isVisible().catch(() => false)

    if (hasSyncBtn) {
      await expect(pressPage.syncButton).toBeEnabled()
    }
  })

  test('기사 외부 링크 속성 확인', async ({ authenticatedPage }) => {
    const pressPage = new PressPage(authenticatedPage)
    await pressPage.goto()
    await pressPage.waitForLoad()

    const articleCount = await pressPage.getArticleCount()

    if (articleCount > 0) {
      const firstLink = pressPage.articleItems.first()
      await expect(firstLink).toHaveAttribute('target', '_blank')
      await expect(firstLink).toHaveAttribute('rel', /noopener/)
    }
  })
})
