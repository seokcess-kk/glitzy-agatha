/**
 * 데모 뷰어용 fixture 데이터
 * demo_viewer 역할이 API를 호출하면 실제 DB 대신 이 데이터를 반환한다.
 */

import { getKstDateString } from './date'

// ── 시드 기반 의사 난수 (새로고침해도 동일 데이터) ──

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── 데모 클라이언트 목록 ──

export const DEMO_CLIENTS = [
  { id: 901, name: '블루밍 플라워카페', slug: 'blooming-cafe', is_active: true, monthly_budget: 8000000 },
  { id: 902, name: '핏앤고 피트니스', slug: 'fitandgo', is_active: true, monthly_budget: 5000000 },
  { id: 903, name: '리틀폭스 어학원', slug: 'littlefox-academy', is_active: true, monthly_budget: 3000000 },
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
  const rand = seededRandom(42)
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
      spend: baseSpend + Math.round(rand() * 60000),
      leads: baseLead + Math.round(rand() * 8),
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

// ── 광고 성과 — 캠페인 일별 통계 (ads/stats) ──

export function getDemoAdsPerformance() {
  const rand = seededRandom(100)
  const result = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const date = getKstDateString(d)
    result.push(
      { stat_date: date, platform: 'meta_ads', campaign_name: '[Meta] 봄 프로모션', spend_amount: 65000 + Math.round(rand() * 15000), clicks: 140 + Math.round(rand() * 40), impressions: 4200 + Math.round(rand() * 800), conversions: 4 + Math.round(rand() * 3) },
      { stat_date: date, platform: 'meta_ads', campaign_name: '[Meta] 리타겟팅', spend_amount: 35000 + Math.round(rand() * 10000), clicks: 85 + Math.round(rand() * 25), impressions: 2800 + Math.round(rand() * 500), conversions: 2 + Math.round(rand() * 2) },
      { stat_date: date, platform: 'google_ads', campaign_name: '[Google] 브랜드 검색', spend_amount: 45000 + Math.round(rand() * 12000), clicks: 95 + Math.round(rand() * 30), impressions: 2600 + Math.round(rand() * 600), conversions: 3 + Math.round(rand() * 2) },
    )
  }
  return result
}

// ── 광고 성과 — 소재별 성과 (ads/creatives-performance) ──

export function getDemoCreativesPerformance() {
  return {
    creatives: [
      { utm_content: 'cr_spring_01', name: '봄 시즌 할인 배너', platform: 'meta_ads', spend: 820000, clicks: 1640, impressions: 48000, cpc: 500, ctr: 3.42, cpl: 11714, leads: 70, contacts: 65, revenue: 8500000, conversionRate: 30.8, registered: true, file_name: 'spring_banner_01.jpg', file_type: 'image', campaign_ids: ['demo_meta_1'] },
      { utm_content: 'cr_spring_02', name: '리타겟팅 동영상 A', platform: 'meta_ads', spend: 450000, clicks: 920, impressions: 28000, cpc: 489, ctr: 3.29, cpl: 12857, leads: 35, contacts: 32, revenue: 4200000, conversionRate: 28.1, registered: true, file_name: 'retarget_video_a.mp4', file_type: 'video', campaign_ids: ['demo_meta_2'] },
      { utm_content: 'cr_google_01', name: '브랜드 검색 반응형', platform: 'google_ads', spend: 680000, clicks: 1420, impressions: 41000, cpc: 479, ctr: 3.46, cpl: 13600, leads: 50, contacts: 46, revenue: 6100000, conversionRate: 26.0, registered: true, file_name: null, file_type: null, campaign_ids: ['demo_google_1'] },
      { utm_content: 'cr_naver_01', name: '파워링크 텍스트', platform: 'naver_ads', spend: 380000, clicks: 860, impressions: 22000, cpc: 442, ctr: 3.91, cpl: 11875, leads: 32, contacts: 30, revenue: 3800000, conversionRate: 33.3, registered: false, file_name: null, file_type: null, campaign_ids: ['demo_naver_1'] },
      { utm_content: 'cr_kakao_01', name: '카카오 비즈보드', platform: 'kakao_ads', spend: 320000, clicks: 640, impressions: 18000, cpc: 500, ctr: 3.56, cpl: 10667, leads: 30, contacts: 28, revenue: 3200000, conversionRate: 25.0, registered: false, file_name: 'kakao_bizboard.jpg', file_type: 'image', campaign_ids: [] },
    ],
  }
}

// ── 광고 성과 — 요일별 분석 (ads/day-analysis) ──

export function getDemoDayAnalysis() {
  const labels = ['일', '월', '화', '수', '목', '금', '토']
  return {
    byDay: labels.map((dayLabel, day) => {
      const isWeekend = day === 0 || day === 6
      const leads = isWeekend ? 32 + day * 2 : 52 + day * 3
      const spend = isWeekend ? 480000 : 720000
      return { day, dayLabel, leads, spend, cpl: leads > 0 ? Math.round(spend / leads) : 0 }
    }),
  }
}

// ── 광고 성과 — 효율 트렌드 (ads/efficiency-trend) ──

export function getDemoEfficiencyTrend() {
  const rand = seededRandom(200)
  const result = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const date = getKstDateString(d)
    const spend = 150000 + Math.round(rand() * 50000)
    const clicks = 280 + Math.round(rand() * 80)
    const impressions = 8200 + Math.round(rand() * 2000)
    const leads = 10 + Math.round(rand() * 8)
    result.push({
      date,
      spend,
      clicks,
      impressions,
      leads,
      cpl: leads > 0 ? Math.round(spend / leads) : 0,
      cpc: clicks > 0 ? Math.round(spend / clicks) : 0,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    })
  }
  return result
}

// ── 광고 성과 — 랜딩페이지 분석 (ads/landing-page-analysis) ──

const DEMO_LP_NAMES = ['봄 프로모션 LP', '리타겟팅 전용 LP', '네이버 검색 LP', '카카오 이벤트 LP', '브랜드 소개 LP']

export function getDemoLandingPageAnalysis() {
  const pages = DEMO_LP_NAMES.map((name, i) => ({
    landingPageId: `lp_demo_${String(i + 1).padStart(3, '0')}`,
    name,
    isActive: i < 4,
    leads: [85, 62, 48, 35, 22][i],
    bookings: [28, 20, 15, 10, 6][i],
    contacts: [80, 58, 44, 32, 20][i],
    revenue: [12500000, 8800000, 6200000, 4500000, 2800000][i],
    leadToBookingRate: [32.9, 32.3, 31.3, 28.6, 27.3][i],
    conversionRate: [35.0, 34.5, 34.1, 31.3, 30.0][i],
  }))

  // 상위 5개 LP의 일별 리드 트렌드 (최근 14일)
  const rand = seededRandom(300)
  const trendLabels = DEMO_LP_NAMES.slice(0, 5)
  const trend = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const date = getKstDateString(d)
    const entry: Record<string, string | number> = { date }
    trendLabels.forEach((label, li) => {
      const base = [6, 4, 3, 2, 1][li]
      entry[label] = base + Math.round(rand() * 3)
    })
    trend.push(entry)
  }

  const channelBreakdown = pages.map(p => ({
    landingPageId: p.landingPageId,
    name: p.name,
    channels: [
      { channel: 'Meta', leads: Math.round(p.leads * 0.45) },
      { channel: 'Google', leads: Math.round(p.leads * 0.25) },
      { channel: 'Naver', leads: Math.round(p.leads * 0.15) },
      { channel: 'Kakao', leads: Math.round(p.leads * 0.10) },
      { channel: 'Direct', leads: Math.round(p.leads * 0.05) },
    ],
  }))

  return { pages, trend, trendLabels, channelBreakdown }
}

// ── 광고 성과 — 랜딩페이지 성과 (ads/landing-page-performance) ──

export function getDemoLandingPagePerformance() {
  return {
    pages: DEMO_LP_NAMES.map((name, i) => ({
      landingPageId: `lp_demo_${String(i + 1).padStart(3, '0')}`,
      name,
      isActive: i < 4,
      leads: [85, 62, 48, 35, 22][i],
      contacts: [80, 58, 44, 32, 20][i],
      revenue: [12500000, 8800000, 6200000, 4500000, 2800000][i],
      conversionRate: [35.0, 34.5, 34.1, 31.3, 30.0][i],
    })),
  }
}

// ── 캠페인 목록 (dashboard/campaign) ──

export function getDemoCampaigns() {
  return [
    { id: 9001, client_id: 901, platform: 'meta_ads', campaign_id: 'demo_meta_1', campaign_name: '[Meta] 봄 프로모션', campaign_type: 'feed', status: 'ACTIVE', daily_budget: 80000, created_at: '2026-03-01T00:00:00+09:00' },
    { id: 9002, client_id: 901, platform: 'meta_ads', campaign_id: 'demo_meta_2', campaign_name: '[Meta] 리타겟팅', campaign_type: 'retargeting', status: 'ACTIVE', daily_budget: 45000, created_at: '2026-03-01T00:00:00+09:00' },
    { id: 9003, client_id: 901, platform: 'google_ads', campaign_id: 'demo_google_1', campaign_name: '[Google] 브랜드 검색', campaign_type: 'search', status: 'ACTIVE', daily_budget: 55000, created_at: '2026-03-01T00:00:00+09:00' },
    { id: 9004, client_id: 901, platform: 'google_ads', campaign_id: 'demo_google_2', campaign_name: '[Google] 디스플레이 리마케팅', campaign_type: 'display', status: 'PAUSED', daily_budget: 30000, created_at: '2026-02-15T00:00:00+09:00' },
    { id: 9005, client_id: 901, platform: 'naver_ads', campaign_id: 'demo_naver_1', campaign_name: '[Naver] 파워링크', campaign_type: 'search', status: 'ACTIVE', daily_budget: 40000, created_at: '2026-03-10T00:00:00+09:00' },
  ]
}

// ── 고객/리드 목록 (leads API — contacts 하이브리드 구조) ──

const DEMO_CONTACTS = [
  { name: '김서연', phone: '01012341111', status: 'converted', source: 'meta', campaign: '봄프로모션', lpName: '봄 프로모션 LP', payAmount: 580000 },
  { name: '이지호', phone: '01023452222', status: 'in_progress', source: 'google', campaign: '브랜드검색', lpName: '브랜드 소개 LP', payAmount: 0 },
  { name: '박민서', phone: '01034563333', status: 'converted', source: 'naver', campaign: '파워링크', lpName: '네이버 검색 LP', payAmount: 420000 },
  { name: '최하은', phone: '01045674444', status: 'new', source: 'meta', campaign: '봄프로모션', lpName: '봄 프로모션 LP', payAmount: 0 },
  { name: '정도윤', phone: '01056785555', status: 'lost', source: 'kakao', campaign: '카카오이벤트', lpName: '카카오 이벤트 LP', payAmount: 0 },
  { name: '강예린', phone: '01067896666', status: 'converted', source: 'google', campaign: '브랜드검색', lpName: '브랜드 소개 LP', payAmount: 350000 },
  { name: '조시우', phone: '01078907777', status: 'hold', source: 'meta', campaign: '리타겟팅', lpName: '리타겟팅 전용 LP', payAmount: 0 },
  { name: '윤채원', phone: '01089018888', status: 'in_progress', source: 'naver', campaign: '파워링크', lpName: '네이버 검색 LP', payAmount: 0 },
  { name: '장하준', phone: '01090129999', status: 'converted', source: 'direct', campaign: '', lpName: '', payAmount: 680000 },
  { name: '한소율', phone: '01011110000', status: 'new', source: 'meta', campaign: '봄프로모션', lpName: '봄 프로모션 LP', payAmount: 0 },
  { name: '서윤아', phone: '01022221111', status: 'in_progress', source: 'google', campaign: '디스플레이', lpName: '브랜드 소개 LP', payAmount: 0 },
  { name: '임지현', phone: '01033332222', status: 'lost', source: 'meta', campaign: '봄프로모션', lpName: '봄 프로모션 LP', payAmount: 0 },
  { name: '오태양', phone: '01044443333', status: 'converted', source: 'naver', campaign: '파워링크', lpName: '네이버 검색 LP', payAmount: 520000 },
  { name: '배수진', phone: '01055554444', status: 'hold', source: 'meta', campaign: '리타겟팅', lpName: '리타겟팅 전용 LP', payAmount: 0 },
  { name: '류건우', phone: '01066665555', status: 'in_progress', source: 'kakao', campaign: '카카오이벤트', lpName: '카카오 이벤트 LP', payAmount: 0 },
]

export function getDemoLeads() {
  return DEMO_CONTACTS.map((c, i) => {
    const daysAgo = 2 + i * 2 // 안정적인 순서
    const created = new Date(Date.now() - daysAgo * 86400000)
    const createdAt = created.toISOString()
    const contactId = 7001 + i
    const leadId = 8001 + i
    const lpId = c.lpName ? `lp_demo_${String((i % 5) + 1).padStart(3, '0')}` : null

    const leadObj = {
      id: leadId,
      client_id: 901,
      contact_id: contactId,
      status: c.status,
      utm_source: c.source,
      utm_medium: 'cpc',
      utm_campaign: c.campaign,
      utm_content: `cr_${c.source}_0${(i % 3) + 1}`,
      landing_page_id: lpId,
      landing_page: lpId ? { id: lpId, name: c.lpName } : null,
      chatbot_sent: i % 4 === 0,
      chatbot_sent_at: i % 4 === 0 ? createdAt : null,
      custom_data: null,
      memo: '',
      lost_reason: c.status === 'lost' ? 'no_response' : null,
      created_at: createdAt,
      updated_at: createdAt,
    }

    const payments = c.payAmount > 0 ? [{
      id: 6001 + i,
      client_id: 901,
      contact_id: contactId,
      payment_amount: c.payAmount,
      payment_date: createdAt,
      treatment_name: ['프리미엄 패키지', '정기 구독', '이벤트 상품', '체험 쿠폰', '기본 서비스'][i % 5],
      created_at: createdAt,
    }] : []

    const bookings = c.status !== 'new' && c.status !== 'lost' ? [{
      id: 5001 + i,
      client_id: 901,
      contact_id: contactId,
      status: c.status === 'converted' ? 'completed' : 'confirmed',
      booking_date: new Date(created.getTime() + 3 * 86400000).toISOString(),
      created_at: createdAt,
    }] : []

    return {
      id: contactId,
      contact_id: contactId,
      phone_number: c.phone,
      name: c.name,
      first_source: c.source,
      first_campaign_id: c.campaign || null,
      client_id: 901,
      created_at: createdAt,

      latest_lead: leadObj,
      utm_source: c.source,
      utm_medium: 'cpc',
      utm_campaign: c.campaign,
      utm_content: leadObj.utm_content,
      chatbot_sent: leadObj.chatbot_sent,
      chatbot_sent_at: leadObj.chatbot_sent_at,
      landing_page: leadObj.landing_page,
      custom_data: null,

      leads: [leadObj],
      lead_count: 1,

      contact: {
        id: contactId,
        phone_number: c.phone,
        name: c.name,
        first_source: c.source,
        first_campaign_id: c.campaign || null,
        consultations: [],
        payments,
        bookings,
      },
    }
  })
}

// ── ERP 견적서/계산서 ──

export function getDemoQuotes() {
  return {
    success: true,
    data: [
      { id: 'q-demo-001', quote_number: 'QT-2026-0042', title: '4월 광고 대행 견적서', status: 'sent' as const, supply_amount: 5000000, tax_amount: 500000, total_amount: 5500000, valid_until: '2026-04-30', created_at: '2026-04-01T09:00:00+09:00', sent_at: '2026-04-01T10:00:00+09:00' },
      { id: 'q-demo-002', quote_number: 'QT-2026-0041', title: '3월 광고 대행 견적서', status: 'approved' as const, supply_amount: 4800000, tax_amount: 480000, total_amount: 5280000, valid_until: '2026-03-31', created_at: '2026-03-01T09:00:00+09:00', sent_at: '2026-03-01T10:00:00+09:00' },
      { id: 'q-demo-003', quote_number: 'QT-2026-0040', title: '콘텐츠 제작 견적서 (추가)', status: 'converted' as const, supply_amount: 2000000, tax_amount: 200000, total_amount: 2200000, valid_until: '2026-03-15', created_at: '2026-02-20T09:00:00+09:00', sent_at: '2026-02-20T11:00:00+09:00' },
      { id: 'q-demo-004', quote_number: 'QT-2026-0039', title: '2월 광고 대행 견적서', status: 'converted' as const, supply_amount: 4500000, tax_amount: 450000, total_amount: 4950000, valid_until: '2026-02-28', created_at: '2026-02-01T09:00:00+09:00', sent_at: '2026-02-01T10:30:00+09:00' },
      { id: 'q-demo-005', quote_number: 'QT-2026-0038', title: '랜딩페이지 제작 견적서', status: 'rejected' as const, supply_amount: 3000000, tax_amount: 300000, total_amount: 3300000, valid_until: '2026-01-31', created_at: '2026-01-15T09:00:00+09:00', sent_at: '2026-01-15T14:00:00+09:00' },
    ],
    pagination: { page: 1, totalPages: 1, totalCount: 5 },
  }
}

export function getDemoInvoices() {
  return {
    success: true,
    data: [
      { id: 'inv-demo-001', invoice_number: 'INV-2026-0021', type: 'tax_invoice' as const, status: 'issued' as const, supply_amount: 5280000, tax_amount: 528000, total_amount: 5808000, issue_date: '2026-03-31', created_at: '2026-03-31T09:00:00+09:00' },
      { id: 'inv-demo-002', invoice_number: 'INV-2026-0020', type: 'transaction_statement' as const, status: 'issued' as const, supply_amount: 2200000, tax_amount: 220000, total_amount: 2420000, issue_date: '2026-03-15', created_at: '2026-03-15T09:00:00+09:00' },
      { id: 'inv-demo-003', invoice_number: 'INV-2026-0019', type: 'tax_invoice' as const, status: 'issued' as const, supply_amount: 4950000, tax_amount: 495000, total_amount: 5445000, issue_date: '2026-02-28', created_at: '2026-02-28T09:00:00+09:00' },
      { id: 'inv-demo-004', invoice_number: 'INV-2026-0018', type: 'tax_invoice' as const, status: 'cancelled' as const, supply_amount: 4500000, tax_amount: 450000, total_amount: 4950000, issue_date: '2026-01-31', created_at: '2026-01-31T09:00:00+09:00' },
    ],
    pagination: { page: 1, totalPages: 1, totalCount: 4 },
  }
}

export function getDemoQuoteDetail(id: string) {
  const quotes = getDemoQuotes().data
  const base = quotes.find(q => q.id === id) || quotes[0]
  return {
    success: true,
    data: {
      ...base,
      clients: { id: 'client-demo-901', name: '블루밍 플라워카페', client_id: 901 },
      quote_items: [
        { description: 'Meta 광고 운영 대행', specification: 'Feed + Reels + Story', quantity: 1, unit: '월', unit_price: 2000000, supply_amount: 2000000, tax_amount: 200000, amount: 2200000, sort_order: 1 },
        { description: 'Google Ads 운영 대행', specification: '검색 + 디스플레이', quantity: 1, unit: '월', unit_price: 1500000, supply_amount: 1500000, tax_amount: 150000, amount: 1650000, sort_order: 2 },
        { description: 'Naver 파워링크 운영', specification: '키워드 10개', quantity: 1, unit: '월', unit_price: 1000000, supply_amount: 1000000, tax_amount: 100000, amount: 1100000, sort_order: 3 },
        { description: '월간 성과 리포트', specification: 'PDF + 미팅', quantity: 1, unit: '월', unit_price: 500000, supply_amount: 500000, tax_amount: 50000, amount: 550000, sort_order: 4 },
      ],
    },
  }
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
