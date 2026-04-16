/**
 * Demo 광고 데이터 원본 (Single Source of Truth)
 *
 * 12개월 × 6병원 × 3매체 일별 레코드 생성.
 * 모든 집계(kpi, trend, platform-summary, funnel, day-analysis 등)가 이 배열을 공유.
 *
 * 결정적: 동일 (clinicId, stat_date, platform) → 동일 값.
 * 월 단위 seasonality + 최근 추세 에피소드 심기 + 일 단위 노이즈.
 */

import { DEMO_CLINICS, getDemoClinic } from './clinics'
import { hash32, mulberry32, randInRange } from '../seed'

export type DemoPlatform = 'meta' | 'google' | 'tiktok'

export interface DemoAdRow {
  clinic_id: number
  stat_date: string // YYYY-MM-DD (KST)
  platform: DemoPlatform
  spend_amount: number
  clicks: number
  impressions: number
}

interface PlatformSpec {
  cpcMin: number
  cpcMax: number
  ctrMin: number
  ctrMax: number
}

const PLATFORM_SPEC: Record<DemoPlatform, PlatformSpec> = {
  meta: { cpcMin: 800, cpcMax: 1500, ctrMin: 0.009, ctrMax: 0.015 },
  google: { cpcMin: 1200, cpcMax: 2500, ctrMin: 0.012, ctrMax: 0.022 },
  tiktok: { cpcMin: 400, cpcMax: 900, ctrMin: 0.006, ctrMax: 0.011 },
}

/** 최근 12개월 시작일(KST) — 오늘 기준 12개월 전 1일 */
export function getDemoPeriod(): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  return { start, end }
}

function kstDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 에피소드 — 영상에서 보여줄 스토리 포인트
 * @returns spend multiplier 와 tiktok share override 등
 */
function episodeModifier(clinicId: number, monthsAgo: number): { spendMult: number; tiktokOverride?: number; googleCtrBoost?: number } {
  // 강남점(1001): 최근 3개월 상승 추세
  if (clinicId === 1001) {
    if (monthsAgo === 0) return { spendMult: 1.18 }
    if (monthsAgo === 1) return { spendMult: 1.12 }
    if (monthsAgo === 2) return { spendMult: 1.09 }
  }
  // 스마일 성형(1003): 4개월 전부터 TikTok 비중 급증 (5% → 45%)
  if (clinicId === 1003) {
    if (monthsAgo <= 3) return { spendMult: 1.0, tiktokOverride: 0.45 }
    if (monthsAgo === 4) return { spendMult: 1.0, tiktokOverride: 0.30 }
    if (monthsAgo === 5) return { spendMult: 1.0, tiktokOverride: 0.15 }
    return { spendMult: 1.0, tiktokOverride: 0.05 }
  }
  // 프리미엄 피부과(1004): Google CTR 지속 개선 (12개월 전 대비 최근)
  if (clinicId === 1004) {
    const boost = Math.max(0, (12 - monthsAgo) / 12) * 0.6 // 최근일수록 CTR 부스트
    return { spendMult: 1.0, googleCtrBoost: boost }
  }
  return { spendMult: 1.0 }
}

let _cache: DemoAdRow[] | null = null
let _cacheKey: string | null = null

/**
 * 전체 일별 레코드 생성 (캐시됨).
 * 캐시 키 = 오늘 날짜(YYYY-MM) — 월이 바뀌면 자동 갱신
 */
export function getDemoAdRows(): DemoAdRow[] {
  const { start, end } = getDemoPeriod()
  const key = kstDateStr(end).slice(0, 7)
  if (_cache && _cacheKey === key) return _cache

  const rows: DemoAdRow[] = []
  const now = new Date(end)

  for (const clinic of DEMO_CLINICS) {
    // 일별 루프
    const cursor = new Date(start)
    while (cursor <= end) {
      const monthsAgo = (now.getFullYear() - cursor.getFullYear()) * 12 + (now.getMonth() - cursor.getMonth())
      const ep = episodeModifier(clinic.id, monthsAgo)

      // 월 예산을 30일로 나눠 일일 base spend
      const dailyBudget = clinic.monthlyBudget / 30
      // 주말 감소 / 화수목 증가 (요일별 분석 영상 스토리)
      const dow = cursor.getDay() // 0=일
      const dowMult = dow === 0 || dow === 6 ? 0.78 : dow === 2 || dow === 3 || dow === 4 ? 1.15 : 1.0

      for (const platform of ['meta', 'google', 'tiktok'] as DemoPlatform[]) {
        let share = clinic.platformShare[platform]
        if (clinic.id === 1003 && ep.tiktokOverride !== undefined) {
          // 재분배: tiktok override, 나머지는 meta/google 비율 유지
          const tiktokShare = ep.tiktokOverride
          const othersTotal = 1 - tiktokShare
          const origOthers = clinic.platformShare.meta + clinic.platformShare.google
          if (platform === 'tiktok') share = tiktokShare
          else if (platform === 'meta') share = othersTotal * (clinic.platformShare.meta / origOthers)
          else share = othersTotal * (clinic.platformShare.google / origOthers)
        }

        const seed = hash32(`${clinic.id}|${kstDateStr(cursor)}|${platform}`)
        const rng = mulberry32(seed)

        // ±8% 일별 노이즈
        const noise = randInRange(rng, 0.92, 1.08)
        const spend = Math.round(dailyBudget * share * dowMult * ep.spendMult * noise)
        if (spend <= 0) {
          cursor.setDate(cursor.getDate() + 1)
          continue
        }

        const spec = PLATFORM_SPEC[platform]
        let ctr = randInRange(rng, spec.ctrMin, spec.ctrMax)
        if (platform === 'google' && clinic.id === 1004 && ep.googleCtrBoost) {
          ctr = ctr * (1 + ep.googleCtrBoost)
        }
        const cpc = randInRange(rng, spec.cpcMin, spec.cpcMax)

        const clicks = Math.max(1, Math.round(spend / cpc))
        const impressions = Math.max(clicks, Math.round(clicks / ctr))

        rows.push({
          clinic_id: clinic.id,
          stat_date: kstDateStr(cursor),
          platform,
          spend_amount: spend,
          clicks,
          impressions,
        })
      }

      cursor.setDate(cursor.getDate() + 1)
    }
  }

  _cache = rows
  _cacheKey = key
  return rows
}

/** (clinicId, 시작일, 종료일) 필터 */
export function filterAdRows(
  clinicId: number | null,
  startDate: string | null,
  endDate: string | null
): DemoAdRow[] {
  const rows = getDemoAdRows()
  return rows.filter(r => {
    if (clinicId !== null && r.clinic_id !== clinicId) return false
    if (startDate && r.stat_date < startDate) return false
    if (endDate && r.stat_date > endDate) return false
    return true
  })
}

export { getDemoClinic }
