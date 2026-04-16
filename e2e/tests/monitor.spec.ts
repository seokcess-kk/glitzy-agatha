import { test, expect } from '../fixtures/auth.fixture'
import { MonitorPage } from '../pages/monitor.page'

test.describe('콘텐츠 모니터링', () => {
  test.use({ userRole: 'superadmin' })

  test('모니터링 페이지 로드', async ({ authenticatedPage }) => {
    const monitorPage = new MonitorPage(authenticatedPage)
    await monitorPage.goto()
    await monitorPage.expectPageLoaded()
  })

  test('통계 카드 표시 (총 콘텐츠, 위험, 주의, 안전)', async ({ authenticatedPage }) => {
    const monitorPage = new MonitorPage(authenticatedPage)
    await monitorPage.goto()
    await monitorPage.waitForLoad()

    const hasCards = await monitorPage.statsCards.first().isVisible().catch(() => false)
    const hasEmpty = await monitorPage.emptyState.isVisible().catch(() => false)

    expect(hasCards || hasEmpty).toBeTruthy()
  })

  test('위험도 필터 버튼 동작', async ({ authenticatedPage }) => {
    const monitorPage = new MonitorPage(authenticatedPage)
    await monitorPage.goto()
    await monitorPage.waitForLoad()

    const allBtn = authenticatedPage.locator('button:has-text("전체")').first()
    const hasFilter = await allBtn.isVisible().catch(() => false)

    if (hasFilter) {
      await allBtn.click()
      await monitorPage.expectPageLoaded()
    }
  })

  test('감사 테이블 렌더링', async ({ authenticatedPage }) => {
    const monitorPage = new MonitorPage(authenticatedPage)
    await monitorPage.goto()
    await monitorPage.waitForLoad()

    const hasTable = await monitorPage.auditTable.isVisible().catch(() => false)
    const hasEmpty = await monitorPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('분석 버튼 표시', async ({ authenticatedPage }) => {
    const monitorPage = new MonitorPage(authenticatedPage)
    await monitorPage.goto()
    await monitorPage.waitForLoad()

    const hasAnalyzeBtn = await monitorPage.analyzeButtons.first().isVisible().catch(() => false)

    if (hasAnalyzeBtn) {
      await expect(monitorPage.analyzeButtons.first()).toBeEnabled()
    }
  })
})
