import { test, expect } from '@playwright/test'

/**
 * Demo mode E2E
 *
 * 사전 조건:
 *   1. .env.local에 DEMO_ACCESS_KEY 설정됨
 *   2. scripts/seed-demo-user.ts 실행 완료 (users 테이블에 demo_viewer 존재)
 *   3. npm run dev 중 (playwright.config.ts의 webServer가 자동 실행)
 *
 * 이 스펙은 storageState를 사용하지 않는 전용 프로젝트(`demo`)에서 실행된다.
 */

const DEMO_KEY = process.env.DEMO_ACCESS_KEY || ''

// dev server 콜드 컴파일을 고려한 여유 타임아웃
test.describe.configure({ timeout: 90_000 })

test.describe('Demo mode', () => {
  test.skip(!DEMO_KEY, 'DEMO_ACCESS_KEY 환경변수가 설정되지 않았습니다')

  test.describe('진입', () => {
    test('올바른 키로 진입 시 / 리다이렉트 + 세션 쿠키 설정', async ({ page, context }) => {
      await page.goto(`/demo/enter?key=${DEMO_KEY}`, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/$|\/\?/)

      const cookies = await context.cookies()
      const sessionCookie = cookies.find(c => c.name.includes('next-auth.session-token'))
      const demoCookie = cookies.find(c => c.name === 'samantha_demo')

      expect(sessionCookie?.value).toBeTruthy()
      expect(demoCookie?.value).toBe('1')
    })

    test('잘못된 키 → 401', async ({ request }) => {
      const res = await request.get('/demo/enter?key=wrong-key-value', { maxRedirects: 0 })
      expect(res.status()).toBe(401)
    })

    test('키 누락 → 401', async ({ request }) => {
      const res = await request.get('/demo/enter', { maxRedirects: 0 })
      expect(res.status()).toBe(401)
    })
  })

  test.describe('허용 페이지 접근', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/demo/enter?key=${DEMO_KEY}`, { waitUntil: 'domcontentloaded' })
    })

    for (const path of ['/', '/ads', '/patients', '/campaigns']) {
      test(`${path} 접근 가능`, async ({ page }) => {
        const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
        expect(res?.status()).toBeLessThan(400)
        // 리다이렉트가 걸리면 /로 돌아가는데, 허용 페이지는 그대로 머물러야 함
        const url = new URL(page.url())
        if (path === '/') {
          expect(url.pathname).toBe('/')
        } else {
          expect(url.pathname.startsWith(path)).toBeTruthy()
        }
      })
    }

    test('응답 헤더에 X-Robots-Tag: noindex 포함', async ({ page }) => {
      const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
      const headers = res?.headers() || {}
      expect(headers['x-robots-tag']).toContain('noindex')
    })
  })

  test.describe('차단 페이지 → / 리다이렉트', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/demo/enter?key=${DEMO_KEY}`, { waitUntil: 'domcontentloaded' })
    })

    for (const path of ['/leads', '/bookings', '/admin', '/monitor']) {
      test(`${path} 접근 시 / 로 리다이렉트`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        const pathname = new URL(page.url()).pathname
        expect(pathname).toBe('/')
      })
    }
  })

  test.describe('API 화이트리스트', () => {
    test.beforeEach(async ({ request }) => {
      const res = await request.get(`/demo/enter?key=${DEMO_KEY}`)
      expect(res.ok()).toBeTruthy()
    })

    test('허용 API GET → 200', async ({ request }) => {
      const res = await request.get('/api/dashboard/kpi?clinic_id=1001')
      expect(res.status()).toBe(200)
    })

    test('허용 API에 POST → 405 read-only', async ({ request }) => {
      const res = await request.post('/api/bookings?clinic_id=1001', {
        data: { customer_name: 'x', phone_number: '010-0000-0000' },
      })
      expect(res.status()).toBe(405)
    })

    test('비허용 API → 404', async ({ request }) => {
      const res = await request.get('/api/patients?clinic_id=1001')
      expect(res.status()).toBe(404)
    })

    test('/api/admin/clinics (화이트리스트) → 200', async ({ request }) => {
      const res = await request.get('/api/admin/clinics')
      expect(res.status()).toBe(200)
      const clinics = await res.json()
      expect(Array.isArray(clinics)).toBeTruthy()
      expect(clinics.length).toBeGreaterThanOrEqual(6)
    })
  })

  test.describe('종료', () => {
    test('/demo/exit → /login + 세션 쿠키 무효화', async ({ page, context }) => {
      await page.goto(`/demo/enter?key=${DEMO_KEY}`, { waitUntil: 'domcontentloaded' })

      await page.goto('/demo/exit', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/login/)

      // 쿠키가 삭제되거나 값이 비어있어야 함
      const cookies = await context.cookies()
      const sessionCookie = cookies.find(c => c.name.includes('next-auth.session-token'))
      const demoCookie = cookies.find(c => c.name === 'samantha_demo')

      const sessionCleared = !sessionCookie || sessionCookie.value === ''
      const demoCleared = !demoCookie || demoCookie.value === ''
      expect(sessionCleared).toBeTruthy()
      expect(demoCleared).toBeTruthy()
    })
  })
})
