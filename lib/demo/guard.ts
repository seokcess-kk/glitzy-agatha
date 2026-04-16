/**
 * Demo 모드 가드 — Layer 4 화이트리스트 + 헬퍼
 *
 * middleware.ts (페이지 경로) 와 lib/api-middleware.ts (API 경로) 양쪽에서 사용.
 * 화이트리스트 관리 지점은 여기 하나로 통일.
 */

import { NextResponse } from 'next/server'

export const DEMO_ALLOWED_PAGES = ['/', '/ads', '/patients', '/campaigns']

export const DEMO_ALLOWED_API_PREFIXES = [
  '/api/auth/',
  '/api/admin/clinics',
  '/api/my/clinics',
  '/api/my/menu-permissions',
  '/api/menu-visibility',
  '/api/dashboard/kpi',
  '/api/dashboard/trend',
  '/api/dashboard/funnel',
  '/api/dashboard/channel',
  '/api/dashboard/treatment-revenue',
  '/api/leads',
  '/api/ads/platform-summary',
  '/api/ads/efficiency-trend',
  '/api/ads/stats',
  '/api/ads/day-analysis',
  '/api/ads/creatives-performance',
  '/api/ads/landing-page-analysis',
  '/api/attribution/summary',
  '/api/attribution/roas-trend',
  '/api/attribution/customers',
  '/api/bookings',
  '/api/clinic-treatments',
  '/api/campaigns',
]

export function isDemoPageAllowed(pathname: string): boolean {
  if (pathname === '/') return true
  return DEMO_ALLOWED_PAGES.some(p => p !== '/' && (pathname === p || pathname.startsWith(p + '/')))
}

export function isDemoApiAllowed(pathname: string): boolean {
  // 정확 매치 또는 프리픽스 다음에 '/' 또는 '?'
  return DEMO_ALLOWED_API_PREFIXES.some(p => {
    if (pathname === p) return true
    if (p.endsWith('/')) return pathname.startsWith(p)
    return pathname.startsWith(p + '/') || pathname.startsWith(p + '?')
  })
}

/**
 * API 래퍼 내부에서 demo_viewer 요청 검증
 * - 화이트리스트 외 → 404
 * - Write 메서드 → 405
 * - 허용된 경우 null 반환 (정상 진행)
 */
export function assertDemoApiAllowed(role: string | undefined, req: Request): NextResponse | null {
  if (role !== 'demo_viewer') return null

  const method = req.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    return new NextResponse('demo mode: read-only', { status: 405 })
  }

  try {
    const { pathname } = new URL(req.url)
    if (!isDemoApiAllowed(pathname)) {
      return new NextResponse('not found', { status: 404 })
    }
  } catch {
    return new NextResponse('bad request', { status: 400 })
  }

  return null
}
