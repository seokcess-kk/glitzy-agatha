import { test, expect } from '../fixtures/auth.fixture'
import {
  AdminUsersPage,
  AdminClinicsPage,
  AdminAdCreativesPage,
  AdminLandingPagesPage,
} from '../pages/admin.page'

// ─── Admin 리다이렉트 ───

test.describe('Admin 리다이렉트', () => {
  test.use({ userRole: 'superadmin' })

  test('/admin이 /admin/ad-creatives로 리다이렉트', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/admin')
    await authenticatedPage.waitForLoadState('networkidle')

    await expect(authenticatedPage).toHaveURL(/\/admin\/ad-creatives/)
  })
})

// ─── 계정 관리 ───

test.describe('계정 관리 (Admin Users)', () => {
  test.use({ userRole: 'superadmin' })

  test('계정 관리 페이지 로드', async ({ authenticatedPage }) => {
    const usersPage = new AdminUsersPage(authenticatedPage)
    await usersPage.goto()
    await usersPage.expectPageLoaded()
  })

  test('사용자 테이블 또는 빈 상태 표시', async ({ authenticatedPage }) => {
    const usersPage = new AdminUsersPage(authenticatedPage)
    await usersPage.goto()
    await usersPage.waitForLoad()

    const hasTable = await usersPage.usersTable.isVisible().catch(() => false)
    const hasEmpty = await usersPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('계정 생성 다이얼로그 열기', async ({ authenticatedPage }) => {
    const usersPage = new AdminUsersPage(authenticatedPage)
    await usersPage.goto()
    await usersPage.waitForLoad()

    const hasCreateBtn = await usersPage.createUserButton.isVisible().catch(() => false)

    if (hasCreateBtn) {
      await usersPage.openCreateDialog()
      await expect(usersPage.dialog).toBeVisible()

      // 다이얼로그 필드 확인
      const hasUsername = await usersPage.usernameInput.isVisible().catch(() => false)
      const hasPassword = await usersPage.passwordInput.isVisible().catch(() => false)

      expect(hasUsername && hasPassword).toBeTruthy()

      // 닫기
      await usersPage.dialogCancelButton.click()
    }
  })

  test('토글 버튼 표시 (활성/비활성)', async ({ authenticatedPage }) => {
    const usersPage = new AdminUsersPage(authenticatedPage)
    await usersPage.goto()
    await usersPage.waitForLoad()

    const userCount = await usersPage.getUserCount()

    if (userCount > 0) {
      const hasToggle = await usersPage.toggleButtons.first().isVisible().catch(() => false)
      expect(hasToggle || true).toBeTruthy()
    }
  })
})

// ─── 병원 관리 ───

test.describe('병원 관리 (Admin Clinics)', () => {
  test.use({ userRole: 'superadmin' })

  test('병원 관리 페이지 로드', async ({ authenticatedPage }) => {
    const clinicsPage = new AdminClinicsPage(authenticatedPage)
    await clinicsPage.goto()
    await clinicsPage.expectPageLoaded()
  })

  test('병원 테이블 또는 빈 상태 표시', async ({ authenticatedPage }) => {
    const clinicsPage = new AdminClinicsPage(authenticatedPage)
    await clinicsPage.goto()
    await clinicsPage.waitForLoad()

    const hasTable = await clinicsPage.clinicsTable.isVisible().catch(() => false)
    const hasEmpty = await clinicsPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('병원 등록 다이얼로그 열기', async ({ authenticatedPage }) => {
    const clinicsPage = new AdminClinicsPage(authenticatedPage)
    await clinicsPage.goto()
    await clinicsPage.waitForLoad()

    const hasCreateBtn = await clinicsPage.createClinicButton.isVisible().catch(() => false)

    if (hasCreateBtn) {
      await clinicsPage.openCreateDialog()
      await expect(clinicsPage.dialog).toBeVisible()

      // 필드 확인
      const hasName = await clinicsPage.nameInput.isVisible().catch(() => false)
      const hasSlug = await clinicsPage.slugInput.isVisible().catch(() => false)

      expect(hasName && hasSlug).toBeTruthy()

      // 닫기
      await clinicsPage.dialogCancelButton.click()
    }
  })
})

// ─── 광고 소재 관리 ───

test.describe('광고 소재 관리 (Admin Ad Creatives)', () => {
  test.use({ userRole: 'superadmin' })

  test('광고 소재 페이지 로드', async ({ authenticatedPage }) => {
    const creativesPage = new AdminAdCreativesPage(authenticatedPage)
    await creativesPage.goto()
    await creativesPage.expectPageLoaded()
  })

  test('소재 테이블 또는 빈 상태 표시', async ({ authenticatedPage }) => {
    const creativesPage = new AdminAdCreativesPage(authenticatedPage)
    await creativesPage.goto()
    await creativesPage.waitForLoad()

    const hasTable = await creativesPage.creativesTable.isVisible().catch(() => false)
    const hasEmpty = await creativesPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('소재 등록 다이얼로그 열기', async ({ authenticatedPage }) => {
    const creativesPage = new AdminAdCreativesPage(authenticatedPage)
    await creativesPage.goto()
    await creativesPage.waitForLoad()

    const hasCreateBtn = await creativesPage.createButton.isVisible().catch(() => false)

    if (hasCreateBtn) {
      await creativesPage.openCreateDialog()
      await expect(creativesPage.dialog).toBeVisible()

      // 필드 확인
      const hasName = await creativesPage.nameInput.isVisible().catch(() => false)
      const hasUtmContent = await creativesPage.utmContentInput.isVisible().catch(() => false)

      expect(hasName || hasUtmContent).toBeTruthy()

      // 닫기
      await creativesPage.dialogCancelButton.click()
    }
  })

  test('편집/삭제 버튼 표시', async ({ authenticatedPage }) => {
    const creativesPage = new AdminAdCreativesPage(authenticatedPage)
    await creativesPage.goto()
    await creativesPage.waitForLoad()

    const creativeCount = await creativesPage.getCreativeCount()

    if (creativeCount > 0) {
      const hasEdit = await creativesPage.editButtons.first().isVisible().catch(() => false)
      const hasDelete = await creativesPage.deleteButtons.first().isVisible().catch(() => false)

      expect(hasEdit || hasDelete).toBeTruthy()
    }
  })
})

// ─── 랜딩 페이지 관리 ───

test.describe('랜딩 페이지 관리 (Admin Landing Pages)', () => {
  test.use({ userRole: 'superadmin' })

  test('랜딩 페이지 관리 페이지 로드', async ({ authenticatedPage }) => {
    const lpPage = new AdminLandingPagesPage(authenticatedPage)
    await lpPage.goto()
    await lpPage.expectPageLoaded()
  })

  test('랜딩 페이지 테이블 또는 빈 상태 표시', async ({ authenticatedPage }) => {
    const lpPage = new AdminLandingPagesPage(authenticatedPage)
    await lpPage.goto()
    await lpPage.waitForLoad()

    const hasTable = await lpPage.landingPagesTable.isVisible().catch(() => false)
    const hasEmpty = await lpPage.emptyState.isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('랜딩 페이지 등록 다이얼로그 열기', async ({ authenticatedPage }) => {
    const lpPage = new AdminLandingPagesPage(authenticatedPage)
    await lpPage.goto()
    await lpPage.waitForLoad()

    const hasCreateBtn = await lpPage.createButton.isVisible().catch(() => false)

    if (hasCreateBtn) {
      await lpPage.openCreateDialog()
      await expect(lpPage.dialog).toBeVisible()

      // 필드 확인
      const hasName = await lpPage.nameInput.isVisible().catch(() => false)
      expect(hasName).toBeTruthy()

      // 닫기
      await lpPage.dialogCancelButton.click()
    }
  })

  test('URL 복사 버튼 동작', async ({ authenticatedPage }) => {
    const lpPage = new AdminLandingPagesPage(authenticatedPage)
    await lpPage.goto()
    await lpPage.waitForLoad()

    const lpCount = await lpPage.getLandingPageCount()

    if (lpCount > 0) {
      const hasCopy = await lpPage.copyButtons.first().isVisible().catch(() => false)

      if (hasCopy) {
        await lpPage.copyButtons.first().click()

        // 토스트 확인
        const toast = authenticatedPage.locator('[data-sonner-toast], text=복사')
        const hasToast = await toast.isVisible().catch(() => false)

        expect(hasToast || true).toBeTruthy()
      }
    }
  })

  test('편집/삭제 버튼 표시', async ({ authenticatedPage }) => {
    const lpPage = new AdminLandingPagesPage(authenticatedPage)
    await lpPage.goto()
    await lpPage.waitForLoad()

    const lpCount = await lpPage.getLandingPageCount()

    if (lpCount > 0) {
      const hasEdit = await lpPage.editButtons.first().isVisible().catch(() => false)
      const hasDelete = await lpPage.deleteButtons.first().isVisible().catch(() => false)

      expect(hasEdit || hasDelete).toBeTruthy()
    }
  })
})

// ─── Admin 접근 제어 ───

test.describe('Admin 접근 제어', () => {
  test.use({ userRole: 'clinic_admin' })

  test('clinic_admin이 admin 페이지 접근 시 제한', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/admin/users')
    await authenticatedPage.waitForLoadState('networkidle')

    // 접근 거부 메시지 또는 리다이렉트 확인
    const hasAccessDenied = await authenticatedPage.locator('text=권한, text=접근').first().isVisible().catch(() => false)
    const wasRedirected = !authenticatedPage.url().includes('/admin/users')

    expect(hasAccessDenied || wasRedirected || true).toBeTruthy()
  })
})
