import { Page, expect } from '@playwright/test'

/**
 * 토스트 메시지 확인
 */
export async function expectToast(page: Page, message: string) {
  const toast = page.locator('[data-sonner-toast], [role="alert"], .toast')
  await expect(toast).toContainText(message)
}

/**
 * 토스트 메시지가 사라질 때까지 대기
 */
export async function waitForToastDismiss(page: Page) {
  const toast = page.locator('[data-sonner-toast], [role="alert"], .toast')
  await toast.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
}

/**
 * API 응답 대기
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number }
) {
  return page.waitForResponse(
    (response) => {
      const url = response.url()
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern)
      }
      return urlPattern.test(url)
    },
    { timeout: options?.timeout || 10000 }
  )
}

/**
 * 네트워크 요청 모킹
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: { status?: number; body?: unknown }
) {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status: response.status || 200,
      contentType: 'application/json',
      body: JSON.stringify(response.body || {}),
    })
  })
}

/**
 * 날짜 포맷 (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
export function today(): string {
  return formatDate(new Date())
}

/**
 * N일 전 날짜
 */
export function daysAgo(n: number): string {
  const date = new Date()
  date.setDate(date.getDate() - n)
  return formatDate(date)
}

/**
 * 테이블 데이터 추출
 */
export async function extractTableData(
  page: Page,
  tableSelector: string
): Promise<string[][]> {
  const rows = page.locator(`${tableSelector} tbody tr`)
  const rowCount = await rows.count()
  const data: string[][] = []

  for (let i = 0; i < rowCount; i++) {
    const cells = rows.nth(i).locator('td')
    const cellCount = await cells.count()
    const rowData: string[] = []

    for (let j = 0; j < cellCount; j++) {
      const text = await cells.nth(j).textContent()
      rowData.push(text?.trim() || '')
    }

    data.push(rowData)
  }

  return data
}

/**
 * 클립보드 내용 확인 (브라우저 권한 필요)
 */
export async function getClipboardText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    return navigator.clipboard.readText()
  })
}

/**
 * 스크린샷 저장 (디버깅용)
 */
export async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `playwright-report/debug-${name}-${Date.now()}.png`,
    fullPage: true,
  })
}

/**
 * 로컬 스토리지 값 설정
 */
export async function setLocalStorage(
  page: Page,
  key: string,
  value: string
) {
  await page.evaluate(
    ({ k, v }) => {
      localStorage.setItem(k, v)
    },
    { k: key, v: value }
  )
}

/**
 * 로컬 스토리지 값 조회
 */
export async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

/**
 * 페이지 로딩 완료 대기
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle')
  // 추가로 React hydration 완료 대기
  await page.waitForFunction(() => {
    return document.readyState === 'complete'
  })
}

/**
 * 모바일 뷰포트 설정
 */
export async function setMobileViewport(page: Page) {
  await page.setViewportSize({ width: 375, height: 667 })
}

/**
 * 데스크톱 뷰포트 설정
 */
export async function setDesktopViewport(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 })
}
