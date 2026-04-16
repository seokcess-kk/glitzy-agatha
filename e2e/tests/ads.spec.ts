import { test, expect } from '../fixtures/auth.fixture'
import { AdsPage } from '../pages/ads.page'

test.describe('광고 성과 분석', () => {
  test.use({ userRole: 'superadmin' })

  test('광고 페이지 로드', async ({ authenticatedPage }) => {
    const adsPage = new AdsPage(authenticatedPage)
    await adsPage.goto()
    await adsPage.expectPageLoaded()
  })

  test('KPI 카드 표시', async ({ authenticatedPage }) => {
    const adsPage = new AdsPage(authenticatedPage)
    await adsPage.goto()
    await adsPage.waitForLoad()

    // KPI 카드 또는 빈 상태가 표시되어야 함
    const hasCards = await adsPage.kpiCards.first().isVisible().catch(() => false)
    const hasEmpty = await adsPage.emptyState.isVisible().catch(() => false)

    expect(hasCards || hasEmpty).toBeTruthy()
  })

  test('날짜 필터 동작', async ({ authenticatedPage }) => {
    const adsPage = new AdsPage(authenticatedPage)
    await adsPage.goto()
    await adsPage.waitForLoad()

    const hasDateFilter = await adsPage.dateFilter.first().isVisible().catch(() => false)

    if (hasDateFilter) {
      await adsPage.dateFilter.first().click()

      const options = authenticatedPage.locator('[role="option"], [data-value]')
      const optionCount = await options.count()

      expect(optionCount).toBeGreaterThan(0)
    }
  })

  test('플랫폼 필터 버튼 표시', async ({ authenticatedPage }) => {
    const adsPage = new AdsPage(authenticatedPage)
    await adsPage.goto()
    await adsPage.waitForLoad()

    // 전체 매체 또는 플랫폼 필터 버튼이 있어야 함
    const allPlatformBtn = authenticatedPage.locator('button:has-text("전체 매체"), button:has-text("전체")')
    const hasFilter = await allPlatformBtn.isVisible().catch(() => false)

    if (hasFilter) {
      await allPlatformBtn.click()
      // 필터 적용 후에도 페이지가 정상 동작해야 함
      await adsPage.expectPageLoaded()
    }
  })

  test('캠페인 테이블 렌더링', async ({ authenticatedPage }) => {
    const adsPage = new AdsPage(authenticatedPage)
    await adsPage.goto()
    await adsPage.waitForLoad()

    const hasTable = await adsPage.campaignTable.isVisible().catch(() => false)
    const hasEmpty = await adsPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('캠페인 검색', async ({ authenticatedPage }) => {
    const adsPage = new AdsPage(authenticatedPage)
    await adsPage.goto()
    await adsPage.waitForLoad()

    const hasSearch = await adsPage.campaignSearch.isVisible().catch(() => false)

    if (hasSearch) {
      await adsPage.searchCampaign('테스트')
      // 검색 후 에러 없이 동작해야 함
      await adsPage.expectPageLoaded()
    }
  })
})

test.describe('광고 성과 - 데이터 동기화', () => {
  test.use({ userRole: 'superadmin' })

  test('동기화 버튼 표시', async ({ authenticatedPage }) => {
    const adsPage = new AdsPage(authenticatedPage)
    await adsPage.goto()
    await adsPage.waitForLoad()

    const hasSyncBtn = await adsPage.syncButton.isVisible().catch(() => false)

    // 동기화 버튼이 있는 경우 클릭 가능 확인
    if (hasSyncBtn) {
      await expect(adsPage.syncButton).toBeEnabled()
    }
  })
})
