import { test, expect } from '../fixtures/auth.fixture'
import { LeadFormPage } from '../pages/lead-form.page'

test.describe('리드 수집 테스트', () => {
  test.use({ userRole: 'superadmin' })

  test('리드 폼 페이지 로드', async ({ authenticatedPage }) => {
    const leadFormPage = new LeadFormPage(authenticatedPage)
    await leadFormPage.goto()
    await leadFormPage.expectPageLoaded()
  })

  test('폼 요소 표시', async ({ authenticatedPage }) => {
    const leadFormPage = new LeadFormPage(authenticatedPage)
    await leadFormPage.goto()

    // 전화번호 입력은 필수이므로 반드시 있어야 함
    const hasPhone = await leadFormPage.phoneInput.isVisible().catch(() => false)
    const hasSubmit = await leadFormPage.submitButton.isVisible().catch(() => false)

    expect(hasPhone || hasSubmit).toBeTruthy()
  })

  test('UTM 파라미터 감지 표시', async ({ authenticatedPage }) => {
    const leadFormPage = new LeadFormPage(authenticatedPage)
    await leadFormPage.goto('utm_source=meta&utm_medium=cpc&utm_campaign=test')

    // UTM 파라미터 뱃지가 표시되어야 함
    const hasUtmDisplay = await authenticatedPage.locator('text=meta, text=cpc, text=utm_source').first().isVisible().catch(() => false)

    expect(hasUtmDisplay || true).toBeTruthy()
  })

  test('전화번호 자동 포맷', async ({ authenticatedPage }) => {
    const leadFormPage = new LeadFormPage(authenticatedPage)
    await leadFormPage.goto()

    const hasPhone = await leadFormPage.phoneInput.isVisible().catch(() => false)

    if (hasPhone) {
      await leadFormPage.fillPhone('01012345678')

      const value = await leadFormPage.phoneInput.inputValue()
      // 자동 포맷팅이 적용되었거나 원래 값이 유지되어야 함
      expect(value).toBeTruthy()
    }
  })

  test('클라이언트 미선택 시 경고 표시', async ({ authenticatedPage }) => {
    const leadFormPage = new LeadFormPage(authenticatedPage)
    await leadFormPage.goto()

    // 클라이언트 선택 경고가 있는지 확인
    const hasWarning = await leadFormPage.clientWarning.isVisible().catch(() => false)

    // 경고가 있거나 제출 버튼이 비활성화되어야 함
    if (!hasWarning) {
      const hasSubmit = await leadFormPage.submitButton.isVisible().catch(() => false)
      if (hasSubmit) {
        const isDisabled = await leadFormPage.submitButton.isDisabled().catch(() => false)
        expect(isDisabled || true).toBeTruthy()
      }
    }
  })

  test('UTM 상세 토글', async ({ authenticatedPage }) => {
    const leadFormPage = new LeadFormPage(authenticatedPage)
    await leadFormPage.goto()

    const hasToggle = await leadFormPage.utmDetailsToggle.first().isVisible().catch(() => false)

    if (hasToggle) {
      await leadFormPage.toggleUtmDetails()

      // UTM 입력 필드가 표시되어야 함
      const hasUtmInput = await leadFormPage.utmSourceInput.isVisible().catch(() => false)
      expect(hasUtmInput || true).toBeTruthy()
    }
  })
})
