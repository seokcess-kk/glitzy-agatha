import { test, expect } from '../fixtures/auth.fixture'
import { ContentPage } from '../pages/content.page'

test.describe('브랜드 콘텐츠 분석', () => {
  test.use({ userRole: 'superadmin' })

  test('콘텐츠 페이지 로드', async ({ authenticatedPage }) => {
    const contentPage = new ContentPage(authenticatedPage)
    await contentPage.goto()
    await contentPage.expectPageLoaded()
  })

  test('KPI 카드 표시', async ({ authenticatedPage }) => {
    const contentPage = new ContentPage(authenticatedPage)
    await contentPage.goto()
    await contentPage.waitForLoad()

    const hasCards = await contentPage.kpiCards.first().isVisible().catch(() => false)
    const hasEmpty = await contentPage.emptyState.isVisible().catch(() => false)

    expect(hasCards || hasEmpty).toBeTruthy()
  })

  test('플랫폼 필터 동작', async ({ authenticatedPage }) => {
    const contentPage = new ContentPage(authenticatedPage)
    await contentPage.goto()
    await contentPage.waitForLoad()

    const allBtn = authenticatedPage.locator('button:has-text("전체")').first()
    const hasFilter = await allBtn.isVisible().catch(() => false)

    if (hasFilter) {
      await allBtn.click()
      await contentPage.expectPageLoaded()
    }
  })

  test('콘텐츠 추가 다이얼로그 열기', async ({ authenticatedPage }) => {
    const contentPage = new ContentPage(authenticatedPage)
    await contentPage.goto()
    await contentPage.waitForLoad()

    const hasAddBtn = await contentPage.addContentButton.isVisible().catch(() => false)

    if (hasAddBtn) {
      await contentPage.openAddContentDialog()
      await expect(contentPage.dialog).toBeVisible()

      // 닫기
      await contentPage.dialogCancelButton.click()
    }
  })

  test('콘텐츠 테이블 렌더링', async ({ authenticatedPage }) => {
    const contentPage = new ContentPage(authenticatedPage)
    await contentPage.goto()
    await contentPage.waitForLoad()

    const hasTable = await contentPage.contentTable.isVisible().catch(() => false)
    const hasEmpty = await contentPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('콘텐츠 검색', async ({ authenticatedPage }) => {
    const contentPage = new ContentPage(authenticatedPage)
    await contentPage.goto()
    await contentPage.waitForLoad()

    const hasSearch = await contentPage.contentSearch.isVisible().catch(() => false)

    if (hasSearch) {
      await contentPage.searchContent('테스트')
      await contentPage.expectPageLoaded()
    }
  })
})
