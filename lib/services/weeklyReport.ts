/**
 * 주간 리포트 집계 서비스
 * - 병원별 주간 성과 데이터(리드/예약/매출/광고) 집계
 * - SMS 발송용 텍스트 요약 생성
 */

import { createLogger } from '@/lib/logger'
import { getKstDateString, getKstDayStartISO, getKstDayEndISO } from '@/lib/date'
import { normalizeChannel } from '@/lib/channel'

const logger = createLogger('WeeklyReport')

const SUPABASE_MAX_ROWS = 1000

export interface WeeklyReportData {
  clinicId: number
  clinicName: string
  weekStart: string // YYYY-MM-DD
  weekEnd: string   // YYYY-MM-DD
  leads: {
    total: number
    byChannel: Record<string, number>
    prevTotal: number
    changeRate: number // %
  }
  bookings: {
    total: number
    conversionRate: number // leads → bookings %
    prevTotal: number
    changeRate: number
  }
  revenue: {
    total: number
    prevTotal: number
    changeRate: number
  }
  ads: {
    totalSpend: number
    roas: number
    cpl: number
    prevTotalSpend: number
    changeRate: number
  }
  topCampaigns: { name: string; leads: number }[]
  bottomCampaigns: { name: string; leads: number }[]
  smsText: string
}

function calcChangeRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function formatAmount(amount: number): string {
  if (amount >= 10000) return `${Math.round(amount / 10000)}만`
  if (amount >= 1000) return `${Math.round(amount / 1000)}천`
  return `${amount}`
}

function changeSign(rate: number): string {
  if (rate > 0) return `+${rate}%`
  if (rate < 0) return `${rate}%`
  return '0%'
}

function warnIfTruncated(label: string, data: unknown[], clinicId: number) {
  if (data.length >= SUPABASE_MAX_ROWS) {
    logger.warn(`${label} 데이터가 ${SUPABASE_MAX_ROWS}행 이상 — 집계가 부정확할 수 있음`, { clinicId })
  }
}

export async function generateWeeklyReport(
  supabase: { from: (table: string) => any },
  clinicId: number,
  weekStart: Date,
  weekEnd: Date,
): Promise<WeeklyReportData> {
  const startStr = getKstDateString(weekStart)
  const endStr = getKstDateString(weekEnd)

  // 전주 기간 계산
  const prevStart = new Date(weekStart)
  prevStart.setDate(prevStart.getDate() - 7)
  const prevEnd = new Date(weekEnd)
  prevEnd.setDate(prevEnd.getDate() - 7)
  const prevStartStr = getKstDateString(prevStart)
  const prevEndStr = getKstDateString(prevEnd)

  // ISO 범위 (lib/date.ts 유틸리티 사용)
  const startISO = getKstDayStartISO(weekStart)
  const endISO = getKstDayEndISO(weekEnd)
  const prevStartISO = getKstDayStartISO(prevStart)
  const prevEndISO = getKstDayEndISO(prevEnd)

  // 병원명 조회
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .single()

  // count:'exact' + head:true → 1000행 제한 우회 (건수만 필요한 쿼리)
  // 행 데이터가 필요한 쿼리만 select 사용
  const [
    leadsResult,
    leadsExactCount,
    prevLeadsCount,
    bookingsCount,
    prevBookingsCount,
    paymentsResult,
    prevPaymentsResult,
    adsResult,
    prevAdsResult,
    campaignResult,
  ] = await Promise.all([
    // 이번 주 리드 (utm_source 집계용 → 행 데이터 필요)
    supabase
      .from('leads')
      .select('id, utm_source')
      .eq('clinic_id', clinicId)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
    // 이번 주 리드 정확한 건수 (행 제한 우회)
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
    // 전주 리드 (건수만 필요)
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', prevStartISO)
      .lte('created_at', prevEndISO),
    // 이번 주 예약 (건수만 필요)
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
    // 전주 예약 (건수만 필요)
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', prevStartISO)
      .lte('created_at', prevEndISO),
    // 이번 주 매출 (합산용 → 행 데이터 필요)
    supabase
      .from('payments')
      .select('amount')
      .eq('clinic_id', clinicId)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
    // 전주 매출
    supabase
      .from('payments')
      .select('amount')
      .eq('clinic_id', clinicId)
      .gte('created_at', prevStartISO)
      .lte('created_at', prevEndISO),
    // 이번 주 광고비
    supabase
      .from('ad_campaign_stats')
      .select('spend_amount')
      .eq('clinic_id', clinicId)
      .gte('stat_date', startStr)
      .lte('stat_date', endStr),
    // 전주 광고비
    supabase
      .from('ad_campaign_stats')
      .select('spend_amount')
      .eq('clinic_id', clinicId)
      .gte('stat_date', prevStartStr)
      .lte('stat_date', prevEndStr),
    // 캠페인별 리드 (이번 주)
    supabase
      .from('leads')
      .select('utm_campaign')
      .eq('clinic_id', clinicId)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .not('utm_campaign', 'is', null),
  ])

  // 쿼리 에러 체크 — 하나라도 실패하면 부정확한 리포트이므로 에러 로그 기록
  const queryErrors = [
    leadsResult.error && '이번주 리드',
    leadsExactCount.error && '이번주 리드 건수',
    prevLeadsCount.error && '전주 리드 건수',
    bookingsCount.error && '이번주 예약 건수',
    prevBookingsCount.error && '전주 예약 건수',
    paymentsResult.error && '이번주 매출',
    prevPaymentsResult.error && '전주 매출',
    adsResult.error && '이번주 광고비',
    prevAdsResult.error && '전주 광고비',
    campaignResult.error && '캠페인별 리드',
  ].filter(Boolean)

  if (queryErrors.length > 0) {
    logger.error(`주간 리포트 쿼리 ${queryErrors.length}건 실패: ${queryErrors.join(', ')}`, undefined, { clinicId })
  }

  // 리드 집계 (normalizeChannel 사용)
  const leads = leadsResult.data || []
  warnIfTruncated('이번주 리드', leads, clinicId)
  const leadTotal = leadsExactCount.count ?? leads.length
  const prevLeadTotal = prevLeadsCount.count ?? 0
  // byChannel은 행 데이터(최대 1000행) 기반 집계 — 1000건 초과 시 분포가 부정확할 수 있음
  // leadTotal(정확한 count)과 byChannel 합계가 다를 수 있으나, SMS에는 leadTotal만 표시
  const byChannel: Record<string, number> = {}
  for (const lead of leads) {
    const ch = normalizeChannel(lead.utm_source)
    byChannel[ch] = (byChannel[ch] || 0) + 1
  }

  // 예약 집계 (count 쿼리 사용)
  const bookingTotal = bookingsCount.count ?? 0
  const prevBookingTotal = prevBookingsCount.count ?? 0

  // 매출 집계
  const payments = paymentsResult.data || []
  const prevPayments = prevPaymentsResult.data || []
  warnIfTruncated('이번주 결제', payments, clinicId)
  warnIfTruncated('전주 결제', prevPayments, clinicId)
  const totalRevenue = payments.reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0)
  const prevTotalRevenue = prevPayments.reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0)

  // 광고비 집계
  const adsData = adsResult.data || []
  const prevAdsData = prevAdsResult.data || []
  const totalSpend = adsData.reduce((s: number, a: { spend_amount: number }) => s + (a.spend_amount || 0), 0)
  const prevTotalSpend = prevAdsData.reduce((s: number, a: { spend_amount: number }) => s + (a.spend_amount || 0), 0)
  const roas = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0
  const cpl = leadTotal > 0 ? Math.round(totalSpend / leadTotal) : 0

  // 캠페인 순위
  const campaignLeads = campaignResult.data || []
  warnIfTruncated('캠페인별 리드', campaignLeads, clinicId)
  const campaignCount: Record<string, number> = {}
  for (const l of campaignLeads) {
    if (l.utm_campaign) {
      campaignCount[l.utm_campaign] = (campaignCount[l.utm_campaign] || 0) + 1
    }
  }
  const sorted = Object.entries(campaignCount)
    .map(([name, count]) => ({ name, leads: count }))
    .sort((a, b) => b.leads - a.leads)

  const topCampaigns = sorted.slice(0, 3)
  const bottomCampaigns = sorted.length > 3
    ? sorted.slice(-3).reverse()
    : []

  const leadsChangeRate = calcChangeRate(leadTotal, prevLeadTotal)
  const bookingsChangeRate = calcChangeRate(bookingTotal, prevBookingTotal)
  const revenueChangeRate = calcChangeRate(totalRevenue, prevTotalRevenue)
  const adsChangeRate = calcChangeRate(totalSpend, prevTotalSpend)
  const conversionRate = leadTotal > 0
    ? Math.round((bookingTotal / leadTotal) * 1000) / 10
    : 0

  // SMS 텍스트 생성 (병원명 truncate로 길이 제어)
  const clinicName = clinic?.name || '병원'
  const shortName = clinicName.length > 10 ? clinicName.slice(0, 10) : clinicName
  const smsText = `[${shortName}] 주간리포트(${startStr.slice(5)}~${endStr.slice(5)})\n` +
    `리드 ${leadTotal}건(${changeSign(leadsChangeRate)})\n` +
    `예약 ${bookingTotal}건(${changeSign(bookingsChangeRate)})\n` +
    `매출 ${formatAmount(totalRevenue)}(${changeSign(revenueChangeRate)})\n` +
    `광고비 ${formatAmount(totalSpend)} ROAS ${roas}`

  logger.info('주간 리포트 생성 완료', {
    clinicId,
    leads: leadTotal,
    bookings: bookingTotal,
    revenue: totalRevenue,
    adSpend: totalSpend,
  })

  return {
    clinicId,
    clinicName,
    weekStart: startStr,
    weekEnd: endStr,
    leads: {
      total: leadTotal,
      byChannel,
      prevTotal: prevLeadTotal,
      changeRate: leadsChangeRate,
    },
    bookings: {
      total: bookingTotal,
      conversionRate,
      prevTotal: prevBookingTotal,
      changeRate: bookingsChangeRate,
    },
    revenue: {
      total: totalRevenue,
      prevTotal: prevTotalRevenue,
      changeRate: revenueChangeRate,
    },
    ads: {
      totalSpend,
      roas,
      cpl,
      prevTotalSpend,
      changeRate: adsChangeRate,
    },
    topCampaigns,
    bottomCampaigns,
    smsText,
  }
}
