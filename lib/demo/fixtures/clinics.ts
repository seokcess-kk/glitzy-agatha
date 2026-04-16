/**
 * Demo 병원 6개
 * ID 1001~1006 — 실 clinics.id와 충돌 방지 (seed-demo-user.ts에서 MAX 검증)
 */

export interface DemoClinic {
  id: number
  name: string
  slug: string
  size: 'large' | 'medium' | 'small'
  monthlyBudget: number
  /** 매체별 spend 비중 (합계 1.0) */
  platformShare: {
    meta: number
    google: number
    tiktok: number
  }
}

export const DEMO_CLINICS: DemoClinic[] = [
  {
    id: 1001,
    name: '글리치 강남점',
    slug: 'glitzy-gangnam',
    size: 'large',
    monthlyBudget: 24_000_000,
    platformShare: { meta: 0.50, google: 0.35, tiktok: 0.15 },
  },
  {
    id: 1002,
    name: '글리치 분당점',
    slug: 'glitzy-bundang',
    size: 'medium',
    monthlyBudget: 11_000_000,
    platformShare: { meta: 0.30, google: 0.60, tiktok: 0.10 },
  },
  {
    id: 1003,
    name: '스마일 성형외과',
    slug: 'smile-ps',
    size: 'medium',
    monthlyBudget: 9_800_000,
    platformShare: { meta: 0.40, google: 0.15, tiktok: 0.45 },
  },
  {
    id: 1004,
    name: '프리미엄 피부과',
    slug: 'premium-derma',
    size: 'large',
    monthlyBudget: 18_500_000,
    platformShare: { meta: 0.35, google: 0.55, tiktok: 0.10 },
  },
  {
    id: 1005,
    name: '리본 치과',
    slug: 'ribbon-dental',
    size: 'small',
    monthlyBudget: 4_200_000,
    platformShare: { meta: 0.45, google: 0.45, tiktok: 0.10 },
  },
  {
    id: 1006,
    name: '맑은눈 안과',
    slug: 'clear-eye',
    size: 'small',
    monthlyBudget: 5_600_000,
    platformShare: { meta: 0.25, google: 0.65, tiktok: 0.10 },
  },
]

export function getDemoClinic(id: number): DemoClinic | undefined {
  return DEMO_CLINICS.find(c => c.id === id)
}

/** /api/admin/clinics 응답 형식으로 변환 */
export function demoClinicsApiShape() {
  return DEMO_CLINICS.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    is_active: true,
    created_at: '2025-01-01T00:00:00+09:00',
    notify_phones: [],
  }))
}
