/**
 * Demo fixture 집계 함수들
 *
 * 모든 API 응답을 base.ts 의 광고 원본에서 파생:
 *   - 리드 = 클릭 × 1.2% (결정적 rng로 변동)
 *   - 예약 = 리드 × 28%
 *   - 방문 = 예약 × 75%
 *   - 결제 = 방문 × 65%
 *   - 매출 = 결제 × 병원별 ARPC
 *
 * 모든 함수는 결정적: 동일 입력 → 동일 출력.
 */

import { filterAdRows, getDemoAdRows, DemoAdRow, DemoPlatform } from './base'
import { DEMO_CLINICS, getDemoClinic } from './clinics'
import { hash32, mulberry32 } from '../seed'

// ── 상수 ──
const LEAD_RATE = 0.012 // 클릭 대비 리드
const BOOK_RATE = 0.28 // 리드 대비 예약
const VISIT_RATE = 0.75 // 예약 대비 방문
const PAY_RATE = 0.65 // 방문 대비 결제
const CANCEL_RATE = 0.08 // 예약 취소율 (funnel에서 차감)

// 병원 규모별 ARPC (₩)
function arpcFor(clinicId: number): number {
  const c = getDemoClinic(clinicId)
  if (!c) return 450_000
  if (c.size === 'large') return 820_000
  if (c.size === 'medium') return 560_000
  return 380_000
}

// ── 매체 → 채널 (normalizeChannel과 동일한 라벨) ──
const PLATFORM_TO_CHANNEL: Record<DemoPlatform, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
}

const PLATFORM_API_LABEL: Record<DemoPlatform, string> = {
  meta: 'meta_ads',
  google: 'google_ads',
  tiktok: 'tiktok_ads',
}

const PLATFORM_CREATIVE_PREFIX: Record<DemoPlatform, string> = {
  meta: 'meta',
  google: 'google',
  tiktok: 'tiktok',
}

// ── 헬퍼 ──
interface Aggregates {
  spend: number
  clicks: number
  impressions: number
  leads: number
  bookings: number
  visits: number
  payments: number
  revenue: number
}

function aggregate(rows: DemoAdRow[]): Aggregates {
  let spend = 0, clicks = 0, impressions = 0
  for (const r of rows) {
    spend += r.spend_amount
    clicks += r.clicks
    impressions += r.impressions
  }
  // 결정적 변동: rng 기반 비율 ±5%
  const seed = rows.length > 0 ? hash32(`agg|${rows[0].clinic_id}|${rows[0].stat_date}|${rows.length}`) : 0
  const rng = mulberry32(seed)
  const leadRateJitter = LEAD_RATE * (0.95 + rng() * 0.1)
  const leads = Math.round(clicks * leadRateJitter)
  const bookings = Math.round(leads * BOOK_RATE)
  const visits = Math.round(bookings * VISIT_RATE)
  const payments = Math.round(visits * PAY_RATE)

  // 매출: 결제건수 × 병원별 ARPC 평균 (병원별 가중평균)
  const byClinic = new Map<number, number>()
  for (const r of rows) {
    byClinic.set(r.clinic_id, (byClinic.get(r.clinic_id) || 0) + r.spend_amount)
  }
  const totalSpend = spend || 1
  let avgArpc = 0
  for (const [cid, s] of byClinic) {
    avgArpc += arpcFor(cid) * (s / totalSpend)
  }
  if (avgArpc === 0) avgArpc = 500_000
  const revenue = Math.round(payments * avgArpc)

  return { spend, clicks, impressions, leads, bookings, visits, payments, revenue }
}

function toDateOnly(iso: string | null): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

function kstNow(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function kstDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

// ═══════════════════════════════════════════════════════════════
// API 응답 형태별 빌더
// ═══════════════════════════════════════════════════════════════

// ── /api/dashboard/kpi ──
export function demoKpi(
  clinicId: number | null,
  startDate: string | null,
  endDate: string | null,
  compare: boolean
) {
  const start = toDateOnly(startDate) || kstDateDaysAgo(30)
  const end = toDateOnly(endDate) || kstNow()
  const rows = filterAdRows(clinicId, start, end)
  const agg = aggregate(rows)

  const cpl = agg.leads > 0 ? Math.round(agg.spend / agg.leads) : 0
  const roas = agg.spend > 0 ? Number((agg.revenue / agg.spend).toFixed(2)) : 0
  const bookingRate = agg.leads > 0 ? Number(((agg.bookings / agg.leads) * 100).toFixed(1)) : 0
  const cpc = agg.clicks > 0 ? Math.round(agg.spend / agg.clicks) : 0
  const ctr = agg.impressions > 0 ? Number(((agg.clicks / agg.impressions) * 100).toFixed(2)) : 0
  const cac = agg.payments > 0 ? Math.round(agg.spend / agg.payments) : 0
  const arpc = agg.payments > 0 ? Math.round(agg.revenue / agg.payments) : 0

  // today summary — 오늘/어제 데이터
  const today = kstNow()
  const yesterday = kstDateDaysAgo(1)
  const todayRows = filterAdRows(clinicId, today, today)
  const yRows = filterAdRows(clinicId, yesterday, yesterday)
  const todayAgg = aggregate(todayRows)
  const yAgg = aggregate(yRows)

  const base = {
    cpl, roas, bookingRate,
    totalRevenue: agg.revenue,
    totalLeads: agg.leads,
    totalSpend: agg.spend,
    totalConsultations: agg.visits,
    cac, arpc,
    payingCustomerCount: agg.payments,
    totalClicks: agg.clicks,
    totalImpressions: agg.impressions,
    cpc, ctr,
    today: {
      leads: todayAgg.leads,
      bookings: todayAgg.bookings,
      revenue: todayAgg.revenue,
      leadsDiff: todayAgg.leads - yAgg.leads,
      bookingsDiff: todayAgg.bookings - yAgg.bookings,
      revenueDiff: todayAgg.revenue - yAgg.revenue,
    },
  }

  if (!compare) return base

  // 전기간 비교
  const startDateObj = new Date(start + 'T00:00:00+09:00')
  const endDateObj = new Date(end + 'T00:00:00+09:00')
  const duration = endDateObj.getTime() - startDateObj.getTime()
  const prevStart = new Date(startDateObj.getTime() - duration - 86400000)
  const prevEnd = new Date(startDateObj.getTime() - 86400000)
  const prevStartStr = prevStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const prevEndStr = prevEnd.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const prevRows = filterAdRows(clinicId, prevStartStr, prevEndStr)
  const prev = aggregate(prevRows)
  const prevCpl = prev.leads > 0 ? Math.round(prev.spend / prev.leads) : 0
  const prevRoas = prev.spend > 0 ? Number((prev.revenue / prev.spend).toFixed(2)) : 0
  const prevBookingRate = prev.leads > 0 ? Number(((prev.bookings / prev.leads) * 100).toFixed(1)) : 0
  const prevCpc = prev.clicks > 0 ? Math.round(prev.spend / prev.clicks) : 0
  const prevCtr = prev.impressions > 0 ? Number(((prev.clicks / prev.impressions) * 100).toFixed(2)) : 0
  const prevCac = prev.payments > 0 ? Math.round(prev.spend / prev.payments) : 0
  const prevArpc = prev.payments > 0 ? Math.round(prev.revenue / prev.payments) : 0

  const calc = (p: number, c: number) => {
    if (p === 0) return c > 0 ? 100 : 0
    return Number((((c - p) / p) * 100).toFixed(1))
  }

  return {
    ...base,
    comparison: {
      cpl: calc(prevCpl, cpl),
      roas: calc(prevRoas, roas),
      bookingRate: calc(prevBookingRate, bookingRate),
      totalRevenue: calc(prev.revenue, agg.revenue),
      totalLeads: calc(prev.leads, agg.leads),
      totalConsultations: calc(prev.visits, agg.visits),
      totalSpend: calc(prev.spend, agg.spend),
      cac: calc(prevCac, cac),
      arpc: calc(prevArpc, arpc),
      cpc: calc(prevCpc, cpc),
      ctr: calc(prevCtr, ctr),
    },
  }
}

// ── /api/dashboard/trend (28일) ──
export function demoTrend(clinicId: number | null, startDate: string | null) {
  const today = kstNow()
  const DAYS = 28
  const start = startDate ? toDateOnly(startDate) : kstDateDaysAgo(DAYS)

  const dayMap = new Map<string, { date: string; spend: number; leads: number }>()
  for (let i = DAYS; i >= 0; i--) {
    const d = kstDateDaysAgo(i)
    if (start && d >= start && d <= today) {
      dayMap.set(d, { date: d, spend: 0, leads: 0 })
    }
  }

  const rows = filterAdRows(clinicId, start, today)
  for (const r of rows) {
    const entry = dayMap.get(r.stat_date)
    if (!entry) continue
    entry.spend += r.spend_amount
    // 일별 리드: 해당일 해당 clinic의 클릭 × LEAD_RATE
    entry.leads += Math.round(r.clicks * LEAD_RATE)
  }
  return [...dayMap.values()]
}

// ── /api/dashboard/funnel ──
export function demoFunnel(clinicId: number | null, startDate: string | null, endDate: string | null, groupBy: string) {
  const start = toDateOnly(startDate)
  const end = toDateOnly(endDate)
  const rows = filterAdRows(clinicId, start, end)

  if (groupBy === 'total' || !groupBy) {
    const agg = aggregate(rows)
    return { type: 'total', funnel: buildFunnelStages(agg) }
  }

  // 채널별 분기
  const byPlatform = new Map<DemoPlatform, DemoAdRow[]>()
  for (const r of rows) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, [])
    byPlatform.get(r.platform)!.push(r)
  }
  const funnels = Array.from(byPlatform.entries()).map(([platform, platformRows]) => {
    const agg = aggregate(platformRows)
    return { group: PLATFORM_TO_CHANNEL[platform], funnel: buildFunnelStages(agg) }
  }).sort((a, b) => b.funnel.stages[0].count - a.funnel.stages[0].count)
  return { type: groupBy, funnels }
}

function buildFunnelStages(agg: Aggregates) {
  const leadCount = agg.leads
  const bookedCount = Math.round(agg.bookings * (1 - CANCEL_RATE))
  const visitedCount = agg.visits
  const consultedCount = Math.round(agg.visits * 0.95)
  const paidCount = agg.payments
  const num = (n: number) => Number(n.toFixed(1))
  return {
    stages: [
      { stage: 'Lead', label: '리드', count: leadCount, rate: 100, dropoff: 0 },
      { stage: 'Booking', label: '예약', count: bookedCount,
        rate: leadCount > 0 ? num((bookedCount / leadCount) * 100) : 0,
        dropoff: leadCount > 0 ? num(((leadCount - bookedCount) / leadCount) * 100) : 0 },
      { stage: 'Visit', label: '방문', count: visitedCount,
        rate: leadCount > 0 ? num((visitedCount / leadCount) * 100) : 0,
        dropoff: bookedCount > 0 ? num(((bookedCount - visitedCount) / bookedCount) * 100) : 0 },
      { stage: 'Consultation', label: '상담', count: consultedCount,
        rate: leadCount > 0 ? num((consultedCount / leadCount) * 100) : 0,
        dropoff: visitedCount > 0 ? num(((visitedCount - consultedCount) / visitedCount) * 100) : 0 },
      { stage: 'Payment', label: '결제', count: paidCount,
        rate: leadCount > 0 ? num((paidCount / leadCount) * 100) : 0,
        dropoff: consultedCount > 0 ? num(((consultedCount - paidCount) / consultedCount) * 100) : 0 },
    ],
    totalConversionRate: leadCount > 0 ? num((paidCount / leadCount) * 100) : 0,
    summary: { leads: leadCount, payments: paidCount },
  }
}

// ── /api/dashboard/channel ──
export function demoChannel(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const start = toDateOnly(startDate)
  const end = toDateOnly(endDate)
  const rows = filterAdRows(clinicId, start, end)

  const byPlatform = new Map<DemoPlatform, DemoAdRow[]>()
  for (const r of rows) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, [])
    byPlatform.get(r.platform)!.push(r)
  }

  const result = Array.from(byPlatform.entries()).map(([platform, platformRows]) => {
    const agg = aggregate(platformRows)
    const payingCustomers = agg.payments
    return {
      channel: PLATFORM_TO_CHANNEL[platform],
      leads: agg.leads,
      spend: agg.spend,
      revenue: agg.revenue,
      payingCustomers,
      clicks: agg.clicks,
      impressions: agg.impressions,
      cpl: agg.leads > 0 ? Math.round(agg.spend / agg.leads) : 0,
      roas: agg.spend > 0 ? Number((agg.revenue / agg.spend).toFixed(2)) : 0,
      ctr: agg.impressions > 0 ? Number(((agg.clicks / agg.impressions) * 100).toFixed(2)) : 0,
      conversionRate: agg.leads > 0 ? Number(((payingCustomers / agg.leads) * 100).toFixed(1)) : 0,
    }
  }).sort((a, b) => b.leads - a.leads)

  return result
}

// ── /api/dashboard/treatment-revenue ──
const DEMO_TREATMENTS = [
  '보톡스 이마',
  '필러 볼륨',
  '리프팅 레이저',
  '여드름 치료',
  '미백 관리',
  '피부 재생',
  '눈썹 문신',
  '체형 관리',
]

export function demoTreatmentRevenue(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const rows = filterAdRows(clinicId, toDateOnly(startDate), toDateOnly(endDate))
  const agg = aggregate(rows)
  if (agg.revenue === 0) return []

  // 시술별 비중 결정적 분배 (8개 시술, 총합 100%)
  const seed = hash32(`treatment|${clinicId ?? 'all'}|${startDate}|${endDate}`)
  const rng = mulberry32(seed)
  const weights = DEMO_TREATMENTS.map(() => 0.5 + rng())
  const totalW = weights.reduce((a, b) => a + b, 0)
  const result = DEMO_TREATMENTS.map((name, i) => ({
    name,
    amount: Math.round(agg.revenue * (weights[i] / totalW)),
  }))
  return result.sort((a, b) => b.amount - a.amount)
}

// ── /api/ads/platform-summary ──
export function demoPlatformSummary(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const start = toDateOnly(startDate)
  const end = toDateOnly(endDate)
  const rows = filterAdRows(clinicId, start, end)

  const byPlatform = new Map<DemoPlatform, DemoAdRow[]>()
  for (const r of rows) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, [])
    byPlatform.get(r.platform)!.push(r)
  }

  const result = Array.from(byPlatform.entries()).map(([platform, platformRows]) => {
    const agg = aggregate(platformRows)
    const channel = PLATFORM_TO_CHANNEL[platform]
    const prefix = PLATFORM_CREATIVE_PREFIX[platform]

    // 소스별 세분화: feed / search / reels 등 (매체별 2~3종)
    const sourceTypes = platform === 'meta' ? ['feed', 'reels'] : platform === 'google' ? ['search', 'display'] : ['feed', 'spark']
    const sourceSplit = platform === 'meta' ? [0.7, 0.3] : platform === 'google' ? [0.75, 0.25] : [0.6, 0.4]
    const sources = sourceTypes.map((t, i) => {
      const share = sourceSplit[i]
      return {
        source: `${prefix}_${t}`,
        label: `${channel} ${t}`,
        spend: Math.round(agg.spend * share),
        clicks: Math.round(agg.clicks * share),
        impressions: Math.round(agg.impressions * share),
        leads: Math.round(agg.leads * share),
        cpl: agg.leads > 0 ? Math.round((agg.spend * share) / Math.max(1, agg.leads * share)) : 0,
        cpc: agg.clicks > 0 ? Math.round(agg.spend / agg.clicks) : 0,
        ctr: agg.impressions > 0 ? Number(((agg.clicks / agg.impressions) * 100).toFixed(2)) : 0,
      }
    }).sort((a, b) => b.leads - a.leads || b.spend - a.spend)

    return {
      channel,
      spend: agg.spend,
      clicks: agg.clicks,
      impressions: agg.impressions,
      leads: agg.leads,
      revenue: agg.revenue,
      payingCustomers: agg.payments,
      cpl: agg.leads > 0 ? Math.round(agg.spend / agg.leads) : 0,
      cpc: agg.clicks > 0 ? Math.round(agg.spend / agg.clicks) : 0,
      ctr: agg.impressions > 0 ? Number(((agg.clicks / agg.impressions) * 100).toFixed(2)) : 0,
      roas: agg.spend > 0 ? Number((agg.revenue / agg.spend).toFixed(2)) : 0,
      conversionRate: agg.leads > 0 ? Number(((agg.payments / agg.leads) * 100).toFixed(1)) : 0,
      sources,
    }
  }).sort((a, b) => b.leads - a.leads)

  return result
}

// ── /api/ads/efficiency-trend ──
export function demoEfficiencyTrend(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const today = kstNow()
  const start = toDateOnly(startDate) || kstDateDaysAgo(28)
  const end = toDateOnly(endDate) || today

  const dayMap = new Map<string, { date: string; spend: number; clicks: number; impressions: number; leads: number; cpl: number; cpc: number; ctr: number }>()
  const startD = new Date(start + 'T00:00:00+09:00')
  const endD = new Date(end + 'T00:00:00+09:00')
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    dayMap.set(key, { date: key, spend: 0, clicks: 0, impressions: 0, leads: 0, cpl: 0, cpc: 0, ctr: 0 })
  }

  const rows = filterAdRows(clinicId, start, end)
  for (const r of rows) {
    const entry = dayMap.get(r.stat_date)
    if (!entry) continue
    entry.spend += r.spend_amount
    entry.clicks += r.clicks
    entry.impressions += r.impressions
    entry.leads += Math.round(r.clicks * LEAD_RATE)
  }

  for (const entry of dayMap.values()) {
    entry.cpl = entry.leads > 0 ? Math.round(entry.spend / entry.leads) : 0
    entry.cpc = entry.clicks > 0 ? Math.round(entry.spend / entry.clicks) : 0
    entry.ctr = entry.impressions > 0 ? Number(((entry.clicks / entry.impressions) * 100).toFixed(2)) : 0
  }
  return [...dayMap.values()]
}

// ── /api/ads/stats ──
// 반환: { stats: [...ad_campaign_stats row 형태], campaignLeadCounts: {} }
export function demoAdStats(clinicId: number | null, days: number, platformFilter: string | null) {
  const since = kstDateDaysAgo(days)
  const today = kstNow()
  const rows = filterAdRows(clinicId, since, today)

  // campaign_id 10개 풀 생성 (결정적)
  const campaigns = generateDemoCampaigns(clinicId)

  // 각 row를 campaign에 배분 (균등)
  const stats: Array<Record<string, unknown>> = []
  const campaignLeadCounts: Record<string, number> = {}

  // 병원별 × 플랫폼별 × 캠페인별 stat_date 집계
  const key = (clinicId: number, platform: DemoPlatform, campaignId: string, date: string) =>
    `${clinicId}|${platform}|${campaignId}|${date}`
  const aggMap = new Map<string, { row: Record<string, unknown> }>()

  for (const r of rows) {
    if (platformFilter && PLATFORM_API_LABEL[r.platform] !== platformFilter) continue

    // 병원의 해당 플랫폼 캠페인만
    const clinicCampaigns = campaigns.filter(c => c.clinic_id === r.clinic_id && c.platform === r.platform)
    if (clinicCampaigns.length === 0) continue

    // 해당 날짜의 spend를 캠페인 수로 분할 (가중치)
    const seed = hash32(`${r.clinic_id}|${r.stat_date}|${r.platform}|split`)
    const rng = mulberry32(seed)
    const weights = clinicCampaigns.map(() => 0.5 + rng())
    const totalW = weights.reduce((a, b) => a + b, 0)

    clinicCampaigns.forEach((camp, idx) => {
      const w = weights[idx] / totalW
      const spend = Math.round(r.spend_amount * w)
      const clicks = Math.round(r.clicks * w)
      const impressions = Math.round(r.impressions * w)
      if (spend <= 0) return
      const k = key(r.clinic_id, r.platform, camp.campaign_id, r.stat_date)
      const existing = aggMap.get(k)
      if (existing) {
        const row = existing.row
        row.spend_amount = Number(row.spend_amount) + spend
        row.clicks = Number(row.clicks) + clicks
        row.impressions = Number(row.impressions) + impressions
      } else {
        aggMap.set(k, {
          row: {
            id: hash32(k) % 100000,
            clinic_id: r.clinic_id,
            campaign_id: camp.campaign_id,
            campaign_name: camp.name,
            platform: PLATFORM_API_LABEL[r.platform],
            campaign_type: camp.campaign_type,
            stat_date: r.stat_date,
            spend_amount: spend,
            clicks,
            impressions,
          },
        })
      }
    })
  }

  for (const { row } of aggMap.values()) stats.push(row)
  stats.sort((a, b) => String(b.stat_date).localeCompare(String(a.stat_date)))

  // 캠페인별 리드 수 산출 (결정적)
  for (const camp of campaigns) {
    const campRows = stats.filter(s => s.campaign_id === camp.campaign_id)
    const totalClicks = campRows.reduce((sum, s) => sum + Number(s.clicks), 0)
    campaignLeadCounts[camp.campaign_id] = Math.round(totalClicks * LEAD_RATE)
  }

  return { stats, campaignLeadCounts }
}

interface DemoCampaign {
  campaign_id: string
  name: string
  clinic_id: number
  platform: DemoPlatform
  campaign_type: string
}

function generateDemoCampaigns(clinicIdFilter: number | null): DemoCampaign[] {
  const campaigns: DemoCampaign[] = []
  const campaignTypes: Record<DemoPlatform, string[]> = {
    meta: ['feed', 'reels'],
    google: ['search', 'display'],
    tiktok: ['feed', 'spark'],
  }
  const nameTemplates = ['봄시즌', '신규 오픈', '리프팅 캠페인', '필러 특가', '브랜드', '리마케팅']

  for (const clinic of DEMO_CLINICS) {
    if (clinicIdFilter !== null && clinic.id !== clinicIdFilter) continue
    for (const platform of ['meta', 'google', 'tiktok'] as DemoPlatform[]) {
      const types = campaignTypes[platform]
      nameTemplates.forEach((tpl, i) => {
        const type = types[i % types.length]
        campaigns.push({
          campaign_id: `${PLATFORM_CREATIVE_PREFIX[platform]}_${clinic.id}_${i}`,
          name: `${clinic.name} ${tpl} ${type}`,
          clinic_id: clinic.id,
          platform,
          campaign_type: type,
        })
      })
    }
  }
  return campaigns
}

// ── /api/ads/day-analysis ──
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function demoDayAnalysis(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const start = toDateOnly(startDate)
  const end = toDateOnly(endDate)
  const rows = filterAdRows(clinicId, start, end)

  const leadsByDay = Array(7).fill(0)
  const spendByDay = Array(7).fill(0)

  for (const r of rows) {
    const d = new Date(r.stat_date + 'T00:00:00+09:00')
    const dow = d.getUTCDay()
    spendByDay[dow] += r.spend_amount
    leadsByDay[dow] += Math.round(r.clicks * LEAD_RATE)
  }

  const byDay = Array.from({ length: 7 }, (_, day) => {
    const leads = leadsByDay[day]
    const spend = spendByDay[day]
    return { day, dayLabel: DAY_LABELS[day], leads, spend, cpl: leads > 0 ? Math.round(spend / leads) : 0 }
  })
  return { byDay }
}
