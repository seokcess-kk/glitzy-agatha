/**
 * 데모 뷰어용 fixture 데이터
 * demo_viewer 역할이 API를 호출하면 실제 DB 대신 이 데이터를 반환한다.
 */

import { getKstDateString } from './date'

// ── 데모 클라이언트 목록 ──

export const DEMO_CLIENTS = [
  { id: 901, name: '서울뷰티의원', slug: 'seoul-beauty', is_active: true, monthly_budget: 8000000 },
  { id: 902, name: '강남스킨랩', slug: 'gangnam-skinlab', is_active: true, monthly_budget: 5000000 },
  { id: 903, name: '청담헤어스튜디오', slug: 'cheongdam-hair', is_active: true, monthly_budget: 3000000 },
]

// ── 대시보드 KPI ──

export function getDemoKpi() {
  return {
    cpl: 12400,
    roas: 3.8,
    bookingRate: 32.5,
    totalRevenue: 47200000,
    totalLeads: 384,
    totalSpend: 4768000,
    totalConsultations: 125,
    cac: 158000,
    arpc: 420000,
    payingContactCount: 112,
    totalClicks: 9860,
    totalImpressions: 285400,
    cpc: 483,
    ctr: 3.45,
    today: {
      leads: 14,
      bookings: 5,
      revenue: 2800000,
      leadsDiff: 3,
      bookingsDiff: 1,
      revenueDiff: 450000,
    },
  }
}

// ── 대시보드 트렌드 (최근 28일) ──

export function getDemoTrend() {
  const result = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const date = getKstDateString(d)
    const dayOfWeek = d.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const baseLead = isWeekend ? 8 : 14
    const baseSpend = isWeekend ? 120000 : 180000
    result.push({
      date,
      spend: baseSpend + Math.round(Math.random() * 60000),
      leads: baseLead + Math.round(Math.random() * 8),
    })
  }
  return result
}

// ── 대시보드 퍼널 ──

export function getDemoFunnel() {
  return {
    type: 'total',
    funnel: {
      stages: [
        { stage: 'New', label: '유입', count: 384, rate: 100, dropoff: 0 },
        { stage: 'InProgress', label: '진행', count: 248, rate: 64.6, dropoff: 35.4 },
        { stage: 'Converted', label: '전환', count: 112, rate: 29.2, dropoff: 54.8 },
      ],
      totalConversionRate: 29.2,
      holdCount: 34,
      holdRate: 8.9,
      lostCount: 102,
      lostRate: 26.6,
    },
  }
}

// ── 대시보드 채널별 KPI ──

export function getDemoChannel() {
  return [
    { channel: 'Meta', leads: 168, spend: 2100000, revenue: 0, clicks: 4200, impressions: 125000, cpl: 12500, roas: 0, ctr: 3.36, conversionRate: 31.5, lostRate: 24.2, holdRate: 8.1, noshowRate: 5.2 },
    { channel: 'Google', leads: 96, spend: 1440000, revenue: 0, clicks: 3100, impressions: 89000, cpl: 15000, roas: 0, ctr: 3.48, conversionRate: 28.1, lostRate: 28.5, holdRate: 9.4, noshowRate: 6.1 },
    { channel: 'Naver', leads: 64, spend: 768000, revenue: 0, clicks: 1600, impressions: 42000, cpl: 12000, roas: 0, ctr: 3.81, conversionRate: 32.8, lostRate: 22.0, holdRate: 9.0, noshowRate: 4.5 },
    { channel: 'Kakao', leads: 32, spend: 320000, revenue: 0, clicks: 640, impressions: 18000, cpl: 10000, roas: 0, ctr: 3.56, conversionRate: 25.0, lostRate: 30.0, holdRate: 10.0, noshowRate: 7.0 },
    { channel: 'Direct', leads: 24, spend: 0, revenue: 0, clicks: 0, impressions: 0, cpl: 0, roas: 0, ctr: 0, conversionRate: 37.5, lostRate: 20.0, holdRate: 5.0, noshowRate: 3.0 },
  ]
}

// ── 대시보드 예산 ──

export function getDemoBudget() {
  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const spentAmount = Math.round(8000000 * (dayOfMonth / daysInMonth) * 0.95)
  return {
    monthlyBudget: 8000000,
    spentAmount,
    burnRate: Number(((spentAmount / 8000000) * 100).toFixed(1)),
    projectedSpend: Math.round((spentAmount / dayOfMonth) * daysInMonth),
  }
}

// ── 광고 성과 (ads 페이지) ──

export function getDemoAdsPerformance() {
  const result = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const date = getKstDateString(d)
    result.push(
      { stat_date: date, platform: 'meta_ads', campaign_name: '[Meta] 봄 프로모션', spend_amount: 65000 + Math.round(Math.random() * 15000), clicks: 140 + Math.round(Math.random() * 40), impressions: 4200 + Math.round(Math.random() * 800), conversions: 4 + Math.round(Math.random() * 3) },
      { stat_date: date, platform: 'meta_ads', campaign_name: '[Meta] 리타겟팅', spend_amount: 35000 + Math.round(Math.random() * 10000), clicks: 85 + Math.round(Math.random() * 25), impressions: 2800 + Math.round(Math.random() * 500), conversions: 2 + Math.round(Math.random() * 2) },
      { stat_date: date, platform: 'google_ads', campaign_name: '[Google] 브랜드 검색', spend_amount: 45000 + Math.round(Math.random() * 12000), clicks: 95 + Math.round(Math.random() * 30), impressions: 2600 + Math.round(Math.random() * 600), conversions: 3 + Math.round(Math.random() * 2) },
    )
  }
  return result
}

// ── 캠페인 목록 ──

export function getDemoCampaigns() {
  return [
    { id: 9001, client_id: 901, platform: 'meta_ads', campaign_id: 'demo_meta_1', campaign_name: '[Meta] 봄 프로모션', campaign_type: 'feed', status: 'ACTIVE', daily_budget: 80000, created_at: '2026-03-01T00:00:00+09:00' },
    { id: 9002, client_id: 901, platform: 'meta_ads', campaign_id: 'demo_meta_2', campaign_name: '[Meta] 리타겟팅', campaign_type: 'retargeting', status: 'ACTIVE', daily_budget: 45000, created_at: '2026-03-01T00:00:00+09:00' },
    { id: 9003, client_id: 901, platform: 'google_ads', campaign_id: 'demo_google_1', campaign_name: '[Google] 브랜드 검색', campaign_type: 'search', status: 'ACTIVE', daily_budget: 55000, created_at: '2026-03-01T00:00:00+09:00' },
    { id: 9004, client_id: 901, platform: 'google_ads', campaign_id: 'demo_google_2', campaign_name: '[Google] 디스플레이 리마케팅', campaign_type: 'display', status: 'PAUSED', daily_budget: 30000, created_at: '2026-02-15T00:00:00+09:00' },
    { id: 9005, client_id: 901, platform: 'naver_ads', campaign_id: 'demo_naver_1', campaign_name: '[Naver] 파워링크', campaign_type: 'search', status: 'ACTIVE', daily_budget: 40000, created_at: '2026-03-10T00:00:00+09:00' },
  ]
}

// ── 고객/리드 목록 ──

const DEMO_NAMES = ['김서연', '이지호', '박민서', '최하은', '정도윤', '강예린', '조시우', '윤채원', '장하준', '한소율', '서윤아', '임지현', '오태양', '배수진', '류건우']
const DEMO_STATUSES = ['new', 'in_progress', 'converted', 'lost', 'hold', 'converted', 'in_progress', 'new', 'converted', 'in_progress', 'lost', 'new', 'hold', 'converted', 'in_progress']
const DEMO_SOURCES = ['meta', 'google', 'naver', 'meta', 'kakao', 'google', 'meta', 'naver', 'direct', 'meta', 'google', 'meta', 'naver', 'meta', 'kakao']

export function getDemoLeads() {
  return DEMO_NAMES.map((name, i) => {
    const daysAgo = Math.floor(Math.random() * 28)
    const created = new Date(Date.now() - daysAgo * 86400000)
    return {
      id: 8001 + i,
      client_id: 901,
      contact_id: 7001 + i,
      contact_name: name,
      contact_phone: `010${String(1000 + i * 111).padStart(4, '0')}${String(2000 + i * 77).padStart(4, '0')}`,
      status: DEMO_STATUSES[i],
      utm_source: DEMO_SOURCES[i],
      utm_campaign: i % 3 === 0 ? '봄프로모션' : i % 3 === 1 ? '브랜드검색' : '리타겟팅',
      memo: '',
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    }
  })
}

// ── 데모 사용자 정보 (NextAuth용) ──

export const DEMO_USER = {
  id: '9999',
  name: '데모 사용자',
  phone_number: '00000000000',
  role: 'demo_viewer' as const,
  client_id: null,
  password_version: 1,
}

export const DEMO_PHONE = '00000000000'
export const DEMO_PASSWORD = 'demo1234!'

/**
 * demo_viewer 역할 여부 확인
 */
export function isDemoViewer(role: string | undefined): boolean {
  return role === 'demo_viewer'
}
