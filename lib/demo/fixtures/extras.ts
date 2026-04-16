/**
 * 추가 fixture 함수들 — 캠페인 분석/귀속/대시보드 루트/환자·캠페인 페이지
 */

import { filterAdRows, DemoAdRow, DemoPlatform } from './base'
import { DEMO_CLINICS, getDemoClinic } from './clinics'
import { hash32, mulberry32 } from '../seed'

const LEAD_RATE = 0.012
const BOOK_RATE = 0.28
const VISIT_RATE = 0.75
const PAY_RATE = 0.65

const PLATFORM_CHANNEL: Record<DemoPlatform, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
}

function toDateOnly(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null
}

function kstNow(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function kstDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function arpcFor(clinicId: number): number {
  const c = getDemoClinic(clinicId)
  if (!c) return 450_000
  if (c.size === 'large') return 820_000
  if (c.size === 'medium') return 560_000
  return 380_000
}

// ═══════════════════════════════════════════════
// /api/ads/creatives-performance
// ═══════════════════════════════════════════════
const CREATIVE_THEMES = [
  { name: '봄시즌 리프팅 A', type: 'video' },
  { name: '필러 특가 배너', type: 'image' },
  { name: '여드름 케어 릴스', type: 'video' },
  { name: '보톡스 신제품 소개', type: 'image' },
  { name: '브랜드 인트로', type: 'video' },
  { name: '리마케팅 카드', type: 'image' },
  { name: '이벤트 쿠폰', type: 'image' },
  { name: '고객 후기 인터뷰', type: 'video' },
]

export function demoCreativesPerformance(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const rows = filterAdRows(clinicId, toDateOnly(startDate), toDateOnly(endDate))
  if (rows.length === 0) return { creatives: [] }

  const byPlatform = new Map<DemoPlatform, { spend: number; clicks: number; impressions: number }>()
  for (const r of rows) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, { spend: 0, clicks: 0, impressions: 0 })
    const e = byPlatform.get(r.platform)!
    e.spend += r.spend_amount
    e.clicks += r.clicks
    e.impressions += r.impressions
  }

  const creatives: Array<Record<string, unknown>> = []
  let idx = 0
  for (const [platform, totals] of byPlatform.entries()) {
    const seed = hash32(`creatives|${clinicId ?? 'all'}|${platform}`)
    const rng = mulberry32(seed)
    // 각 플랫폼당 4개 소재
    for (let i = 0; i < 4; i++) {
      const theme = CREATIVE_THEMES[(idx + i) % CREATIVE_THEMES.length]
      const weight = 0.15 + rng() * 0.35 // 각 소재 15~50%
      const spend = Math.round(totals.spend * weight / 4)
      const clicks = Math.round(totals.clicks * weight / 4)
      const impressions = Math.round(totals.impressions * weight / 4)
      const leads = Math.round(clicks * LEAD_RATE)
      const customers = Math.round(leads * BOOK_RATE * VISIT_RATE * PAY_RATE)
      const revenue = customers * arpcFor(clinicId ?? 1001)
      creatives.push({
        utm_content: `${platform}_${theme.name.replace(/\s/g, '_')}_${i}`,
        name: `${theme.name} ${i + 1}`,
        platform,
        spend,
        clicks,
        impressions,
        cpc: clicks > 0 ? Math.round(spend / clicks) : 0,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
        cpl: leads > 0 ? Math.round(spend / leads) : 0,
        leads,
        customers,
        revenue,
        conversionRate: leads > 0 ? Number(((customers / leads) * 100).toFixed(1)) : 0,
        registered: true,
        file_name: `${theme.name.replace(/\s/g, '_')}.${theme.type === 'video' ? 'mp4' : 'jpg'}`,
        file_type: theme.type,
        campaign_ids: [],
      })
    }
    idx += 4
  }

  creatives.sort((a, b) => (b.spend as number) - (a.spend as number))
  return { creatives }
}

// ═══════════════════════════════════════════════
// /api/ads/landing-page-analysis
// ═══════════════════════════════════════════════
const LP_NAMES = [
  { id: 9001, name: '봄 이벤트 LP' },
  { id: 9002, name: '리프팅 상담 LP' },
  { id: 9003, name: '필러 특가 LP' },
  { id: 9004, name: '여드름 케어 LP' },
  { id: 9005, name: '브랜드 메인 LP' },
]

export function demoLandingPageAnalysis(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const rows = filterAdRows(clinicId, toDateOnly(startDate), toDateOnly(endDate))
  if (rows.length === 0) return { pages: [], trend: [], trendLabels: [], channelBreakdown: [] }

  // 페이지별 성과 (결정적 weight 분배)
  const totalSpend = rows.reduce((s, r) => s + r.spend_amount, 0)
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0)
  const seed = hash32(`lp|${clinicId ?? 'all'}|${startDate}|${endDate}`)
  const rng = mulberry32(seed)
  const weights = LP_NAMES.map(() => 0.5 + rng())
  const sumW = weights.reduce((a, b) => a + b, 0)

  const pages = LP_NAMES.map((lp, i) => {
    const w = weights[i] / sumW
    const spend = Math.round(totalSpend * w)
    const clicks = Math.round(totalClicks * w)
    const leads = Math.round(clicks * LEAD_RATE)
    const customers = Math.round(leads * BOOK_RATE * VISIT_RATE * PAY_RATE)
    const revenue = customers * arpcFor(clinicId ?? 1001)
    return {
      landingPageId: lp.id,
      name: lp.name,
      leads,
      customers,
      spend,
      revenue,
      cpl: leads > 0 ? Math.round(spend / leads) : 0,
      roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
      conversionRate: leads > 0 ? Number(((customers / leads) * 100).toFixed(1)) : 0,
    }
  }).sort((a, b) => b.leads - a.leads)

  // 추이 (최근 14일)
  const trendDays = 14
  const trend: Array<Record<string, string | number>> = []
  const trendLabels = pages.slice(0, 5).map(p => p.name)
  for (let i = trendDays - 1; i >= 0; i--) {
    const date = kstDateDaysAgo(i)
    const entry: Record<string, string | number> = { date }
    pages.slice(0, 5).forEach((p, idx) => {
      const dSeed = hash32(`${date}|${p.landingPageId}`)
      const dRng = mulberry32(dSeed)
      entry[p.name] = Math.round((p.leads / trendDays) * (0.7 + dRng() * 0.6))
    })
    trend.push(entry)
  }

  // 채널별 분해
  const channelBreakdown = pages.map(p => ({
    landingPageId: p.landingPageId,
    name: p.name,
    channels: [
      { channel: 'Meta', leads: Math.round(p.leads * 0.45) },
      { channel: 'Google', leads: Math.round(p.leads * 0.38) },
      { channel: 'TikTok', leads: Math.round(p.leads * 0.17) },
    ],
  }))

  return { pages, trend, trendLabels, channelBreakdown }
}

// ═══════════════════════════════════════════════
// /api/attribution/summary
// ═══════════════════════════════════════════════
export function demoAttributionSummary(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const rows = filterAdRows(clinicId, toDateOnly(startDate), toDateOnly(endDate))

  const byPlatform = new Map<DemoPlatform, { spend: number; clicks: number }>()
  for (const r of rows) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, { spend: 0, clicks: 0 })
    const e = byPlatform.get(r.platform)!
    e.spend += r.spend_amount
    e.clicks += r.clicks
  }

  let totalSpend = 0, totalRevenue = 0
  const payingCustomers = new Set<number>()

  const byChannel = Array.from(byPlatform.entries()).map(([platform, p]) => {
    const leads = Math.round(p.clicks * LEAD_RATE)
    const customers = Math.round(leads * BOOK_RATE * VISIT_RATE * PAY_RATE)
    const revenue = customers * arpcFor(clinicId ?? 1001)
    totalSpend += p.spend
    totalRevenue += revenue
    for (let i = 0; i < customers; i++) payingCustomers.add(hash32(`${platform}|${i}`))
    return {
      channel: PLATFORM_CHANNEL[platform],
      leads,
      spend: p.spend,
      revenue,
      customers,
      roi: p.spend > 0 ? Math.round(((revenue - p.spend) / p.spend) * 100) : 0,
      roas: p.spend > 0 ? Number((revenue / p.spend).toFixed(2)) : 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // 캠페인 단위 귀속 (상위 8개)
  const byCampaign = byChannel.slice(0, 3).flatMap((c, i) =>
    Array.from({ length: 3 }, (_, j) => {
      const share = 1 / (j + 1.5)
      return {
        campaign: `${c.channel} 캠페인 ${j + 1}`,
        channel: c.channel,
        leads: Math.round(c.leads * share * 0.4),
        spend: Math.round(c.spend * share * 0.4),
        revenue: Math.round(c.revenue * share * 0.4),
        customers: Math.round(c.customers * share * 0.4),
        roi: c.roi,
        roas: c.roas,
      }
    })
  )

  return {
    byChannel,
    byCampaign,
    totals: { totalSpend, totalRevenue: Math.round(totalRevenue), totalCustomers: payingCustomers.size },
  }
}

// ═══════════════════════════════════════════════
// /api/attribution/roas-trend
// ═══════════════════════════════════════════════
export function demoAttributionRoasTrend(clinicId: number | null, startDate: string | null, endDate: string | null) {
  const start = toDateOnly(startDate) || kstDateDaysAgo(28)
  const end = toDateOnly(endDate) || kstNow()
  const rows = filterAdRows(clinicId, start, end)

  const dayMap = new Map<string, Record<string, { spend: number; revenue: number }>>()
  for (const r of rows) {
    const channel = PLATFORM_CHANNEL[r.platform]
    if (!dayMap.has(r.stat_date)) dayMap.set(r.stat_date, {})
    const day = dayMap.get(r.stat_date)!
    if (!day[channel]) day[channel] = { spend: 0, revenue: 0 }
    day[channel].spend += r.spend_amount
    // 매출: 클릭 × LEAD_RATE × 전환 × ARPC
    const leads = Math.round(r.clicks * LEAD_RATE)
    const customers = Math.round(leads * BOOK_RATE * VISIT_RATE * PAY_RATE)
    day[channel].revenue += customers * arpcFor(r.clinic_id)
  }

  const result = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, channels]) => {
    const computed: Record<string, { spend: number; revenue: number; roas: number }> = {}
    for (const [ch, data] of Object.entries(channels)) {
      computed[ch] = {
        spend: data.spend,
        revenue: Math.round(data.revenue),
        roas: data.spend > 0 ? Number((data.revenue / data.spend).toFixed(2)) : 0,
      }
    }
    return { date, channels: computed }
  })
  return result
}

// ═══════════════════════════════════════════════
// /api/attribution/customers (상위 고객 N명 여정)
// ═══════════════════════════════════════════════
const FAKE_NAMES = ['김민지', '박서연', '이지우', '최예린', '정하은', '강유진', '조수빈', '윤지아', '장서현', '임가은', '한소희', '신예원', '오채원', '서다인', '노하린']
const FAKE_PHONE_PREFIXES = ['010-2341', '010-5567', '010-8812', '010-3320', '010-6621']

export function demoAttributionCustomers(clinicId: number | null, startDate: string | null, endDate: string | null, limit: number = 20) {
  const rows = filterAdRows(clinicId, toDateOnly(startDate), toDateOnly(endDate))
  if (rows.length === 0) return []

  const seed = hash32(`customers|${clinicId ?? 'all'}|${startDate}|${endDate}`)
  const rng = mulberry32(seed)

  const result = Array.from({ length: Math.min(limit, 20) }, (_, i) => {
    const platformIdx = i % 3
    const platform: DemoPlatform = platformIdx === 0 ? 'meta' : platformIdx === 1 ? 'google' : 'tiktok'
    const channel = PLATFORM_CHANNEL[platform]
    const name = FAKE_NAMES[i % FAKE_NAMES.length]
    const cid = 10001 + i
    const daysAgo = Math.floor(rng() * 60)
    const leadDate = new Date(Date.now() - daysAgo * 86400000).toISOString()
    const paymentAmount = Math.round((400_000 + rng() * 1_500_000) / 10000) * 10000
    const phoneMid = FAKE_PHONE_PREFIXES[i % FAKE_PHONE_PREFIXES.length]
    const phoneTail = String(Math.floor(1000 + rng() * 9000))

    return {
      customerId: cid,
      name,
      phone: `${phoneMid}-${phoneTail}`,
      channel,
      campaign: `${channel}_캠페인_${(i % 5) + 1}`,
      firstLeadDate: leadDate,
      totalRevenue: paymentAmount,
      payments: [{ id: 50000 + i, amount: paymentAmount, payment_date: leadDate.slice(0, 10), treatment_name: '리프팅 레이저' }],
      journey: {
        leads: [{ id: 60000 + i, utm_source: channel.toLowerCase(), utm_campaign: `camp_${i}`, created_at: leadDate }],
        bookings: [{ id: 70000 + i, status: 'visited', booking_datetime: leadDate, created_at: leadDate }],
        consultations: [{ id: 80000 + i, status: '상담중', consultation_date: leadDate, created_at: leadDate }],
        payments: [{ id: 50000 + i, payment_amount: paymentAmount, payment_date: leadDate.slice(0, 10) }],
      },
    }
  })
  return result
}

// ═══════════════════════════════════════════════
// /api/leads (고객 기준 최근 리드)
// ═══════════════════════════════════════════════
export function demoLeads(clinicId: number | null, startDate: string | null, endDate: string | null, limit: number = 100) {
  const start = toDateOnly(startDate) || kstDateDaysAgo(30)
  const end = toDateOnly(endDate) || kstNow()
  const rows = filterAdRows(clinicId, start, end)
  if (rows.length === 0) return []

  const seed = hash32(`leads|${clinicId ?? 'all'}|${start}|${end}`)
  const rng = mulberry32(seed)

  const count = Math.min(limit, 50)
  return Array.from({ length: count }, (_, i) => {
    const platforms: DemoPlatform[] = ['meta', 'google', 'tiktok']
    const platform = platforms[i % 3]
    const channel = PLATFORM_CHANNEL[platform]
    const name = FAKE_NAMES[i % FAKE_NAMES.length]
    const cid = 20001 + i
    const daysAgo = Math.floor(rng() * 30)
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString()
    const targetClinic = clinicId ?? DEMO_CLINICS[i % DEMO_CLINICS.length].id
    const phoneMid = FAKE_PHONE_PREFIXES[i % FAKE_PHONE_PREFIXES.length]
    const phoneTail = String(Math.floor(1000 + rng() * 9000))

    const lead = {
      id: 30000 + i,
      customer_id: cid,
      utm_source: platform,
      utm_medium: 'cpc',
      utm_campaign: `${channel}_${(i % 5) + 1}`,
      utm_content: `creative_${i % 8}`,
      chatbot_sent: i % 3 === 0,
      chatbot_sent_at: i % 3 === 0 ? createdAt : null,
      landing_page_id: 9001 + (i % 5),
      landing_page: { id: 9001 + (i % 5), name: LP_NAMES[i % 5].name },
      created_at: createdAt,
      custom_data: null,
    }

    return {
      id: cid,
      customer_id: cid,
      phone_number: `${phoneMid}-${phoneTail}`,
      name,
      first_source: platform,
      first_campaign_id: lead.utm_campaign,
      clinic_id: targetClinic,
      created_at: createdAt,
      latest_lead: lead,
      utm_source: lead.utm_source,
      utm_medium: lead.utm_medium,
      utm_campaign: lead.utm_campaign,
      utm_content: lead.utm_content,
      chatbot_sent: lead.chatbot_sent,
      chatbot_sent_at: lead.chatbot_sent_at,
      landing_page: lead.landing_page,
      custom_data: null,
      leads: [lead],
      lead_count: 1,
      customer: {
        id: cid,
        phone_number: `${phoneMid}-${phoneTail}`,
        name,
        first_source: platform,
        first_campaign_id: lead.utm_campaign,
        consultations: [],
        payments: [],
        bookings: [],
      },
    }
  })
}

// ═══════════════════════════════════════════════
// /api/bookings
// ═══════════════════════════════════════════════
const BOOKING_STATUSES = ['confirmed', 'visited', 'treatment_confirmed', 'confirmed', 'visited'] as const

export function demoBookings(clinicId: number | null) {
  const seed = hash32(`bookings|${clinicId ?? 'all'}`)
  const rng = mulberry32(seed)
  const count = 30

  return Array.from({ length: count }, (_, i) => {
    const cid = 40001 + i
    const targetClinic = clinicId ?? DEMO_CLINICS[i % DEMO_CLINICS.length].id
    const daysOffset = Math.floor(rng() * 14) - 7 // -7 ~ +7일
    const bookingDate = new Date(Date.now() + daysOffset * 86400000)
    const status = BOOKING_STATUSES[i % BOOKING_STATUSES.length]
    const name = FAKE_NAMES[i % FAKE_NAMES.length]
    const phoneMid = FAKE_PHONE_PREFIXES[i % FAKE_PHONE_PREFIXES.length]
    const phoneTail = String(Math.floor(1000 + rng() * 9000))
    const phone = `${phoneMid}-${phoneTail}`

    return {
      id: 50001 + i,
      clinic_id: targetClinic,
      customer_id: cid,
      booking_datetime: bookingDate.toISOString(),
      status,
      source: 'walk-in',
      notes: '',
      created_at: new Date(Date.now() - Math.floor(rng() * 10) * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      customer: {
        id: cid,
        name,
        phone_number: phone,
        first_source: 'meta',
        leads: [{ utm_source: 'meta', utm_campaign: 'demo_camp' }],
        consultations: [],
        payments: [],
      },
    }
  })
}

// ═══════════════════════════════════════════════
// /api/clinic-treatments
// ═══════════════════════════════════════════════
const CLINIC_TREATMENT_PRESET = [
  { name: '보톡스 이마', price: 120_000 },
  { name: '필러 볼륨', price: 350_000 },
  { name: '리프팅 레이저', price: 480_000 },
  { name: '여드름 치료', price: 180_000 },
  { name: '미백 관리', price: 220_000 },
  { name: '피부 재생 패키지', price: 640_000 },
]

export function demoClinicTreatments(clinicId: number | null) {
  if (!clinicId) return []
  return CLINIC_TREATMENT_PRESET.map((t, i) => ({
    id: 60001 + clinicId * 10 + i,
    clinic_id: clinicId,
    name: t.name,
    price: t.price,
    is_active: true,
    sort_order: i,
    created_at: '2025-06-01T00:00:00+09:00',
    updated_at: '2025-06-01T00:00:00+09:00',
  }))
}

// ═══════════════════════════════════════════════
// /api/campaigns
// ═══════════════════════════════════════════════
export function demoCampaigns(clinicId: number | null) {
  const rows = filterAdRows(clinicId, null, null)
  if (rows.length === 0) return []

  // 병원별 × 플랫폼별 1 캠페인씩
  const seen = new Set<string>()
  const campaigns: Array<Record<string, unknown>> = []

  for (const clinic of DEMO_CLINICS) {
    if (clinicId !== null && clinic.id !== clinicId) continue
    for (const platform of ['meta', 'google', 'tiktok'] as DemoPlatform[]) {
      const key = `${clinic.id}|${platform}`
      if (seen.has(key)) continue
      seen.add(key)
      const seed = hash32(`camp|${key}`)
      const rng = mulberry32(seed)
      const leadCount = Math.floor(30 + rng() * 120)
      campaigns.push({
        utm_campaign: `${PLATFORM_CHANNEL[platform]}_${clinic.slug}_spring`,
        clinic_id: clinic.id,
        channel: PLATFORM_CHANNEL[platform],
        lead_count: leadCount,
        first_lead_at: new Date(Date.now() - Math.floor(rng() * 60) * 86400000).toISOString(),
        latest_lead_at: new Date(Date.now() - Math.floor(rng() * 3) * 86400000).toISOString(),
        landing_pages: [{ id: 9001, name: '봄 이벤트 LP' }],
      })
    }
  }

  return campaigns.sort((a, b) => (b.lead_count as number) - (a.lead_count as number))
}
