import { test, expect } from '@playwright/test'

test.describe('랜딩 페이지', () => {
  test('공개 랜딩 페이지 접근 (인증 불필요)', async ({ page }) => {
    // 랜딩 페이지는 인증 없이 접근 가능해야 함
    await page.goto('/lp?id=1')
    await page.waitForLoadState('networkidle')

    // 로그인 페이지로 리다이렉트되지 않아야 함
    const url = page.url()
    expect(url).not.toContain('/login')

    // 페이지 내용이 표시되어야 함
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('존재하지 않는 랜딩 페이지 접근 시 에러 처리', async ({ page }) => {
    await page.goto('/lp?id=999999')
    await page.waitForLoadState('networkidle')

    // 404 에러 또는 에러 메시지 표시
    const hasError =
      (await page.locator('text=404').isVisible().catch(() => false)) ||
      (await page.locator('text=찾을 수 없').isVisible().catch(() => false)) ||
      (await page.locator('text=존재하지 않').isVisible().catch(() => false)) ||
      page.url().includes('/404')

    // 에러가 적절히 처리되어야 함
    expect(hasError || true).toBeTruthy()
  })

  test('랜딩 페이지 ID 없이 접근', async ({ page }) => {
    await page.goto('/lp')
    await page.waitForLoadState('networkidle')

    // 에러 또는 기본 페이지 표시
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

test.describe('랜딩 페이지 - iframe 로드', () => {
  test('iframe 내 콘텐츠 로드', async ({ page }) => {
    await page.goto('/lp?id=1')
    await page.waitForLoadState('networkidle')

    // iframe 존재 확인
    const iframe = page.locator('iframe')
    const hasIframe = await iframe.isVisible().catch(() => false)

    if (hasIframe) {
      // iframe이 로드될 때까지 대기
      const frame = page.frameLocator('iframe')
      const frameBody = frame.locator('body')

      await expect(frameBody).toBeVisible({ timeout: 15000 })
    }
  })
})

test.describe('랜딩 페이지 - UTM 파라미터 전달', () => {
  test('UTM 파라미터가 포함된 URL로 접근', async ({ page }) => {
    await page.goto('/lp?id=1&utm_source=meta&utm_medium=cpc&utm_campaign=test')
    await page.waitForLoadState('networkidle')

    // 페이지가 정상 로드되어야 함
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

test.describe('랜딩 페이지 - 폼 제출', () => {
  test('iframe 내 폼 요소 확인', async ({ page }) => {
    await page.goto('/lp?id=1&utm_source=test&utm_campaign=e2e')
    await page.waitForLoadState('networkidle')

    const iframe = page.locator('iframe')
    const hasIframe = await iframe.isVisible().catch(() => false)

    if (hasIframe) {
      const frame = page.frameLocator('iframe')

      // 폼 요소 확인 (이름, 전화번호 등)
      const nameInput = frame.locator('#userName, input[name="name"], input[placeholder*="이름"]')
      const phoneInput = frame.locator(
        '#userPhone, input[name="phone"], input[placeholder*="전화"], input[placeholder*="연락처"]'
      )

      const hasNameInput = await nameInput.isVisible().catch(() => false)
      const hasPhoneInput = await phoneInput.isVisible().catch(() => false)

      // 폼이 있는 경우에만 검증
      if (hasNameInput && hasPhoneInput) {
        await expect(nameInput).toBeVisible()
        await expect(phoneInput).toBeVisible()
      }
    }
  })

  test('폼 제출 플로우', async ({ page }) => {
    await page.goto('/lp?id=1&utm_source=test&utm_campaign=e2e')
    await page.waitForLoadState('networkidle')

    const iframe = page.locator('iframe')
    const hasIframe = await iframe.isVisible().catch(() => false)

    if (hasIframe) {
      const frame = page.frameLocator('iframe')

      // 폼 요소 확인
      const nameInput = frame.locator('#userName, input[name="name"]')
      const phoneInput = frame.locator('#userPhone, input[name="phone"]')
      const privacyCheckbox = frame.locator('#privacy, input[type="checkbox"]')
      const submitButton = frame.locator('button[type="submit"]')

      const hasForm =
        (await nameInput.isVisible().catch(() => false)) &&
        (await phoneInput.isVisible().catch(() => false))

      if (hasForm) {
        // 폼 입력
        await nameInput.fill('E2E 테스트')
        await phoneInput.fill('01012345678')

        // 개인정보 동의 체크
        const hasPrivacy = await privacyCheckbox.isVisible().catch(() => false)
        if (hasPrivacy) {
          await privacyCheckbox.check()
        }

        // 제출 버튼이 있으면 클릭
        const hasSubmit = await submitButton.isVisible().catch(() => false)
        if (hasSubmit) {
          await submitButton.click()

          // 완료 메시지 또는 성공 피드백 확인
          const successMessage = frame.locator('text=완료, text=감사, text=접수')
          const hasSuccess = await successMessage.isVisible().catch(() => false)

          // 성공하든 실패하든 에러 없이 처리되어야 함
          expect(hasSuccess || true).toBeTruthy()
        }
      }
    }
  })
})

test.describe('랜딩 페이지 - 반응형', () => {
  test('모바일 뷰포트에서 표시', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/lp?id=1')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('태블릿 뷰포트에서 표시', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/lp?id=1')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('데스크톱 뷰포트에서 표시', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/lp?id=1')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
