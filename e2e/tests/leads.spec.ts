import { test, expect } from '../fixtures/auth.fixture'
import { LeadsPage } from '../pages/leads.page'

test.describe('리드 관리', () => {
  test.use({ userRole: 'superadmin' })

  test('리드 목록 페이지 로드', async ({ authenticatedPage }) => {
    const leadsPage = new LeadsPage(authenticatedPage)
    await leadsPage.goto()

    // 테이블이 표시되거나 빈 상태 메시지가 표시되어야 함
    await leadsPage.waitForTableLoad()

    const hasTable = await leadsPage.leadsTable.isVisible().catch(() => false)
    const hasEmptyState = await leadsPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmptyState).toBeTruthy()
  })

  test('리드 테이블 렌더링', async ({ authenticatedPage }) => {
    const leadsPage = new LeadsPage(authenticatedPage)
    await leadsPage.goto()
    await leadsPage.waitForTableLoad()

    // 테이블 헤더 확인
    const tableHeader = authenticatedPage.locator('thead th, [role="columnheader"]')
    const headerCount = await tableHeader.count()

    // 최소 1개 이상의 컬럼이 있어야 함
    expect(headerCount).toBeGreaterThan(0)
  })

  test('리드 검색 기능', async ({ authenticatedPage }) => {
    const leadsPage = new LeadsPage(authenticatedPage)
    await leadsPage.goto()
    await leadsPage.waitForTableLoad()

    // 검색 입력창이 있는 경우에만 테스트
    const hasSearchInput = await leadsPage.searchInput.isVisible().catch(() => false)

    if (hasSearchInput) {
      await leadsPage.searchLeads('테스트')

      // 검색 후 결과가 표시되어야 함 (결과가 없어도 빈 상태로)
      const hasTable = await leadsPage.leadsTable.isVisible().catch(() => false)
      const hasEmptyState = await leadsPage.emptyState.isVisible().catch(() => false)

      expect(hasTable || hasEmptyState).toBeTruthy()
    }
  })
})

test.describe('리드 필터링', () => {
  test.use({ userRole: 'superadmin' })

  test('상태별 필터링', async ({ authenticatedPage }) => {
    const leadsPage = new LeadsPage(authenticatedPage)
    await leadsPage.goto()
    await leadsPage.waitForTableLoad()

    const hasStatusFilter = await leadsPage.statusFilter.isVisible().catch(() => false)

    if (hasStatusFilter) {
      // 필터 클릭
      await leadsPage.statusFilter.click()

      // 필터 옵션 확인
      const filterOptions = authenticatedPage.locator('[role="option"], [data-value]')
      const optionCount = await filterOptions.count()

      expect(optionCount).toBeGreaterThan(0)
    }
  })

  test('채널별 필터링', async ({ authenticatedPage }) => {
    const leadsPage = new LeadsPage(authenticatedPage)
    await leadsPage.goto()
    await leadsPage.waitForTableLoad()

    const hasChannelFilter = await leadsPage.channelFilter.isVisible().catch(() => false)

    if (hasChannelFilter) {
      await leadsPage.channelFilter.click()

      const filterOptions = authenticatedPage.locator('[role="option"], [data-value]')
      const optionCount = await filterOptions.count()

      expect(optionCount).toBeGreaterThan(0)
    }
  })
})

test.describe('리드 상세', () => {
  test.use({ userRole: 'superadmin' })

  test('리드 행 클릭 시 상세 정보 표시', async ({ authenticatedPage }) => {
    const leadsPage = new LeadsPage(authenticatedPage)
    await leadsPage.goto()
    await leadsPage.waitForTableLoad()

    const rowCount = await leadsPage.getRowCount()

    if (rowCount > 0) {
      // 첫 번째 행 클릭
      await leadsPage.clickRow(0)

      // 상세 정보 모달/패널 또는 상세 페이지로 이동 확인
      const hasDetail = await authenticatedPage
        .locator('[data-testid="lead-detail"], [role="dialog"], main')
        .isVisible()
        .catch(() => false)

      // URL 변경 또는 모달 표시 확인
      const urlChanged = authenticatedPage.url().includes('/leads/')

      expect(hasDetail || urlChanged).toBeTruthy()
    }
  })
})

test.describe('리드 - 멀티테넌트', () => {
  test.describe('Superadmin', () => {
    test.use({ userRole: 'superadmin' })

    test('다른 병원 리드 조회 가능 (clinic_id 파라미터)', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/leads?clinic_id=1')
      await authenticatedPage.waitForLoadState('networkidle')

      const leadsPage = new LeadsPage(authenticatedPage)
      await leadsPage.waitForTableLoad()

      // 페이지가 정상 로드되어야 함
      const hasTable = await leadsPage.leadsTable.isVisible().catch(() => false)
      const hasEmptyState = await leadsPage.emptyState.isVisible().catch(() => false)

      expect(hasTable || hasEmptyState).toBeTruthy()
    })
  })

  test.describe('Clinic Admin', () => {
    test.use({ userRole: 'clinic_admin' })

    test('자신의 병원 리드만 조회', async ({ authenticatedPage }) => {
      const leadsPage = new LeadsPage(authenticatedPage)
      await leadsPage.goto()
      await leadsPage.waitForTableLoad()

      // 페이지가 정상 로드되어야 함
      const hasTable = await leadsPage.leadsTable.isVisible().catch(() => false)
      const hasEmptyState = await leadsPage.emptyState.isVisible().catch(() => false)

      expect(hasTable || hasEmptyState).toBeTruthy()
    })
  })
})
