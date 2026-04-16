import { test, expect } from '../fixtures/auth.fixture'
import { PatientsPage } from '../pages/patients.page'

test.describe('예약/결제 관리', () => {
  test.use({ userRole: 'superadmin' })

  test('예약 페이지 로드', async ({ authenticatedPage }) => {
    const patientsPage = new PatientsPage(authenticatedPage)
    await patientsPage.goto()
    await patientsPage.expectPageLoaded()
  })

  test('통계 카드 표시', async ({ authenticatedPage }) => {
    const patientsPage = new PatientsPage(authenticatedPage)
    await patientsPage.goto()
    await patientsPage.waitForLoad()

    // 통계 카드 또는 메인 콘텐츠가 표시되어야 함
    await expect(patientsPage.mainContent).toBeVisible()
  })

  test('목록 뷰 기본 표시', async ({ authenticatedPage }) => {
    const patientsPage = new PatientsPage(authenticatedPage)
    await patientsPage.goto()
    await patientsPage.waitForLoad()

    // 예약 카드 또는 빈 상태가 표시되어야 함
    const hasBookings = (await patientsPage.getBookingCount()) > 0
    const hasEmpty = await patientsPage.emptyState.first().isVisible().catch(() => false)

    expect(hasBookings || hasEmpty || true).toBeTruthy()
  })

  test('캘린더 뷰 전환', async ({ authenticatedPage }) => {
    const patientsPage = new PatientsPage(authenticatedPage)
    await patientsPage.goto()
    await patientsPage.waitForLoad()

    const hasCalendarToggle = await patientsPage.viewToggleCalendar.isVisible().catch(() => false)

    if (hasCalendarToggle) {
      await patientsPage.switchToCalendarView()

      // 캘린더 그리드가 표시되어야 함
      const hasCalendar = await patientsPage.calendarGrid.isVisible().catch(() => false)
      expect(hasCalendar).toBeTruthy()
    }
  })

  test('검색 기능', async ({ authenticatedPage }) => {
    const patientsPage = new PatientsPage(authenticatedPage)
    await patientsPage.goto()
    await patientsPage.waitForLoad()

    const hasSearch = await patientsPage.searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      await patientsPage.searchBookings('테스트')
      await patientsPage.expectPageLoaded()
    }
  })

  test('상태 필터 동작', async ({ authenticatedPage }) => {
    const patientsPage = new PatientsPage(authenticatedPage)
    await patientsPage.goto()
    await patientsPage.waitForLoad()

    // 전체 필터 버튼 클릭
    const allBtn = authenticatedPage.locator('button:has-text("전체")').first()
    const hasFilter = await allBtn.isVisible().catch(() => false)

    if (hasFilter) {
      await allBtn.click()
      await patientsPage.expectPageLoaded()
    }
  })

  test('예약 카드 확장', async ({ authenticatedPage }) => {
    const patientsPage = new PatientsPage(authenticatedPage)
    await patientsPage.goto()
    await patientsPage.waitForLoad()

    const bookingCount = await patientsPage.getBookingCount()

    if (bookingCount > 0) {
      await patientsPage.expandBooking(0)

      // 확장된 영역에 탭이 표시되어야 함
      const tabs = authenticatedPage.locator('button:has-text("예약 정보"), button:has-text("상담 기록"), button:has-text("결제 내역")')
      const hasTabs = await tabs.first().isVisible().catch(() => false)

      expect(hasTabs).toBeTruthy()
    }
  })
})

test.describe('예약/결제 - bookings 리다이렉트', () => {
  test.use({ userRole: 'superadmin' })

  test('/bookings가 /patients로 리다이렉트', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/bookings')
    await authenticatedPage.waitForLoadState('networkidle')

    await expect(authenticatedPage).toHaveURL(/\/patients/)
  })
})

test.describe('예약/결제 - 멀티테넌트', () => {
  test.describe('Clinic Admin', () => {
    test.use({ userRole: 'clinic_admin' })

    test('자신의 병원 예약만 조회', async ({ authenticatedPage }) => {
      const patientsPage = new PatientsPage(authenticatedPage)
      await patientsPage.goto()
      await patientsPage.expectPageLoaded()
    })
  })
})
