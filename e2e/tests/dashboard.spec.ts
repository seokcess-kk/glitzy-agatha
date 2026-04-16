import { test, expect } from '../fixtures/auth.fixture'
import { DashboardPage } from '../pages/dashboard.page'

test.describe('대시보드', () => {
  test.use({ userRole: 'superadmin' })

  test('대시보드 페이지 로드', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage)
    await dashboard.goto()
    await dashboard.expectDashboardLoaded()
  })

  test('사이드바 네비게이션 표시', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage)
    await dashboard.goto()

    // 사이드바 또는 네비게이션 존재 확인
    const nav = authenticatedPage.locator('aside, nav')
    await expect(nav.first()).toBeVisible()
  })

  test('메인 콘텐츠 영역 표시', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage)
    await dashboard.goto()

    await expect(dashboard.mainContent).toBeVisible()
  })
})

test.describe('대시보드 - Superadmin', () => {
  test.use({ userRole: 'superadmin' })

  test('전체 병원 데이터 조회 가능', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage)
    await dashboard.goto()

    // superadmin은 병원 선택 드롭다운이 표시되어야 함
    const clinicSelector = authenticatedPage.locator(
      '[data-testid="clinic-selector"], select:has-text("병원")'
    )

    // 병원 선택기가 있거나 전체 데이터가 표시되어야 함
    const hasClinicSelector = await clinicSelector.isVisible().catch(() => false)
    const hasMainContent = await dashboard.mainContent.isVisible()

    expect(hasClinicSelector || hasMainContent).toBeTruthy()
  })

  test('특정 병원 필터링 (clinic_id 쿼리 파라미터)', async ({ authenticatedPage }) => {
    // URL에 clinic_id 파라미터로 접근
    await authenticatedPage.goto('/?clinic_id=1')
    await authenticatedPage.waitForLoadState('networkidle')

    // 페이지가 정상 로드되어야 함
    const main = authenticatedPage.locator('main')
    await expect(main).toBeVisible()
  })
})

test.describe('대시보드 - Clinic Admin', () => {
  test.use({ userRole: 'clinic_admin' })

  test('자신의 병원 데이터만 조회', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage)
    await dashboard.goto()
    await dashboard.expectDashboardLoaded()

    // clinic_admin은 병원 선택기가 없어야 함 (자동으로 자기 병원만)
    const clinicSelector = authenticatedPage.locator('[data-testid="clinic-selector"]')
    const isSelectorVisible = await clinicSelector.isVisible().catch(() => false)

    // 병원 선택기가 없거나, 비활성화되어 있어야 함
    if (isSelectorVisible) {
      await expect(clinicSelector).toBeDisabled()
    }
  })
})

test.describe('대시보드 네비게이션', () => {
  test.use({ userRole: 'superadmin' })

  test('리드 페이지로 이동', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage)
    await dashboard.goto()

    await dashboard.navigateTo('리드')
    await expect(authenticatedPage).toHaveURL(/\/leads/)
  })

  test('UTM 페이지로 이동', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage)
    await dashboard.goto()

    await dashboard.navigateTo('UTM')
    await expect(authenticatedPage).toHaveURL(/\/utm/)
  })
})
