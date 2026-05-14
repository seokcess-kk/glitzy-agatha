import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { getKstDateString, getKstDayStartISO } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { isDemoViewer, getDemoKpi } from '@/lib/demo-data'
import { PLATFORM_INFLOW_DEFAULTS, isApiPlatform } from '@/lib/platform'

const logger = createLogger('DashboardKpi')

// 메트릭 계산 함수 추출
// start: KST 시작일 00:00:00 (ISO 또는 +09:00), end: KST 종료일 다음날 00:00:00 (exclusive)
//
// Agatha 도메인 매핑 (docs/SPEC.md 기준):
// - 매출: leads where status='converted' + conversion_value (status_changed_at 기준)
// - 예약: leads where status IN ('in_progress','converted')  // 진행중 + 전환 = 예약된 리드
// - 상담: leads where status='in_progress'                    // 진행중 = 상담 중
// - 콘텐츠 예산: 0 (Agatha 도메인에 콘텐츠 예산 개념 없음)
//
// 전환 시점은 leads.status_changed_at 사용. 이 컬럼이 NULL인 레거시 데이터는
// 집계에서 누락될 수 있음 (TODO: 백필 마이그레이션 후 제거).
async function fetchMetrics(
  supabase: SupabaseClient,
  clientId: number | null,
  assignedClientIds: number[] | null,
  start: string,
  end: string
) {
  const ctx = { clientId, assignedClientIds }

  // stat_date(YYYY-MM-DD, DATE 컬럼)용 KST 날짜 추출
  const statStart = getKstDateString(new Date(start))
  // end는 다음날 자정이므로 하루 빼서 종료일 추출
  const statEnd = getKstDateString(new Date(new Date(end).getTime() - 86400000))

  // 범위 패턴: [start, end) — fetchTodaySummary와 동일한 gte/lt 패턴
  //   ad_campaign_stats 에 platform/conversions 추가 select — 매체 전환 기반 인입 계산
  const [adStatsRes, leadsRes, conversionsRes, bookedRes, consultRes] = await Promise.all([
    applyClientFilter(supabase.from('ad_campaign_stats').select('platform, spend_amount, clicks, impressions, conversions').gte('stat_date', statStart).lte('stat_date', statEnd), ctx)!,
    applyClientFilter(supabase.from('leads').select('contact_id').gte('created_at', start).lt('created_at', end).limit(5000), ctx)!,
    // 전환 매출: status='converted' + conversion_value 있는 리드, status_changed_at 기준
    applyClientFilter(
      supabase.from('leads')
        .select('contact_id, conversion_value, status_changed_at')
        .eq('status', 'converted')
        .not('conversion_value', 'is', null)
        .gte('status_changed_at', start)
        .lt('status_changed_at', end)
        .limit(5000),
      ctx,
    )!,
    // 예약 카운트: 진행중 + 전환 (created_at 기준)
    applyClientFilter(supabase.from('leads').select('*', { count: 'exact', head: true })
      .in('status', ['in_progress', 'converted']).gte('created_at', start).lt('created_at', end), ctx)!,
    // 상담 카운트: 진행중 (created_at 기준)
    applyClientFilter(supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress').gte('created_at', start).lt('created_at', end), ctx)!,
  ])

  const totalSpend = adStatsRes.data?.reduce((s, r) => s + Number(r.spend_amount), 0) || 0
  const totalClicks = adStatsRes.data?.reduce((s, r) => s + Number(r.clicks || 0), 0) || 0
  const totalImpressions = adStatsRes.data?.reduce((s, r) => s + Number(r.impressions || 0), 0) || 0
  const totalLeads = leadsRes.data?.length || 0

  // 매체 전환 기반 인입 — PLATFORM_INFLOW_DEFAULTS 가 'media_conversion' 인 플랫폼만 합산
  //   (예: 네이버 SA. 검색광고는 자체 랜딩 없이 매체 전환수로 인입 측정)
  //   이중 집계 방지: lead_webhook 모드 플랫폼은 leads 테이블로만 카운트, conversions 무시
  const mediaConversionsTotal = (adStatsRes.data || []).reduce((sum, r) => {
    const platform = r.platform
    if (!isApiPlatform(platform)) return sum
    if (PLATFORM_INFLOW_DEFAULTS[platform] !== 'media_conversion') return sum
    return sum + Number(r.conversions || 0)
  }, 0)

  // 글로벌 인입 = 폼/웹훅 리드 + 매체 전환 채널 conversions 합산
  const inflowCountTotal = totalLeads + mediaConversionsTotal
  const totalRevenue = conversionsRes.data?.reduce((s, r) => s + Number(r.conversion_value), 0) || 0
  const bookedCount = bookedRes.count || 0
  const consultCount = consultRes.count || 0
  // contentBudget: Agatha 도메인에 콘텐츠 예산 개념 없음 (응답 호환성을 위해 0 처리)
  const contentBudget = 0

  // 기간 내 리드 고객의 contact_id 집합
  const leadContactIds = new Set(leadsRes.data?.map(l => l.contact_id) || [])

  // 리드 고객의 매출 (ROAS 계산용) — 해당 기간에 인입된 리드에서 발생한 매출만
  const leadRevenue = conversionsRes.data
    ?.filter(p => leadContactIds.has(p.contact_id))
    .reduce((s, r) => s + Number(r.conversion_value), 0) || 0

  // 전환 완료 고객 수 (distinct contact_id)
  const payingContactCount = new Set(conversionsRes.data?.map(p => p.contact_id) || []).size

  // CAC: (광고비 + 콘텐츠 예산) / 전환 완료 고객 수
  const totalMarketingCost = totalSpend + contentBudget
  const cac = payingContactCount > 0 ? Math.round(totalMarketingCost / payingContactCount) : 0

  // ARPC: 총 전환 금액 / 전환 완료 고객 수
  const arpc = payingContactCount > 0 ? Math.round(totalRevenue / payingContactCount) : 0

  // CPL 분모: 통합 인입 카운트 사용 (매체 전환 채널의 인입까지 반영해 CPL 왜곡 방지)
  const cplDenominator = inflowCountTotal > 0 ? inflowCountTotal : totalLeads

  return {
    cpl: cplDenominator > 0 ? Math.round(totalSpend / cplDenominator) : 0,
    roas: totalSpend > 0 ? Number((leadRevenue / totalSpend).toFixed(2)) : 0,
    bookingRate: totalLeads > 0 ? Number(((bookedCount / totalLeads) * 100).toFixed(1)) : 0,
    totalRevenue,
    // 기존 totalLeads 응답 키는 호환 위해 inflowCountTotal 로 의미 전환.
    // 정밀 분리값은 actualLeads / mediaConversionsTotal / inflowCountTotal 신규 필드 참고.
    totalLeads: inflowCountTotal,
    actualLeads: totalLeads,
    mediaConversionsTotal,
    inflowCountTotal,
    totalSpend,
    totalConsultations: consultCount,
    cac,
    arpc,
    payingContactCount,
    totalClicks,
    totalImpressions,
    cpc: totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0,
    ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
  }
}

// 변화율 계산 함수
function calcChange(prev: number, curr: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Number((((curr - prev) / prev) * 100).toFixed(1))
}

// 오늘 요약 데이터 (리드, 예약, 매출 + 전일 대비)
async function fetchTodaySummary(
  supabase: SupabaseClient,
  clientId: number | null,
  assignedClientIds: number[] | null,
) {
  const ctx = { clientId, assignedClientIds }

  // KST 기준 오늘 00:00 ~ 내일 00:00 (lt 쿼리용)
  const now = new Date()
  const todayStart = getKstDayStartISO(now)
  const tomorrow = new Date(now.getTime() + 86400000)
  const todayEnd = getKstDayStartISO(tomorrow)
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayStart = getKstDayStartISO(yesterday)

  const [todayLeads, todayBooked, todayConversions, yesterdayLeads, yesterdayBooked, yesterdayConversions] = await Promise.all([
    applyClientFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lt('created_at', todayEnd), ctx)!,
    // 예약 = leads in (in_progress, converted)
    applyClientFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', ['in_progress', 'converted']).gte('created_at', todayStart).lt('created_at', todayEnd), ctx)!,
    // 전환 매출 = leads converted + conversion_value (status_changed_at 기준)
    applyClientFilter(supabase.from('leads').select('conversion_value').eq('status', 'converted').not('conversion_value', 'is', null).gte('status_changed_at', todayStart).lt('status_changed_at', todayEnd), ctx)!,
    applyClientFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart), ctx)!,
    applyClientFilter(supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', ['in_progress', 'converted']).gte('created_at', yesterdayStart).lt('created_at', todayStart), ctx)!,
    applyClientFilter(supabase.from('leads').select('conversion_value').eq('status', 'converted').not('conversion_value', 'is', null).gte('status_changed_at', yesterdayStart).lt('status_changed_at', todayStart), ctx)!,
  ])

  const leads = todayLeads.count || 0
  const bookings = todayBooked.count || 0
  const revenue = todayConversions.data?.reduce((s, r) => s + Number(r.conversion_value), 0) || 0
  const yLeads = yesterdayLeads.count || 0
  const yBookings = yesterdayBooked.count || 0
  const yRevenue = yesterdayConversions.data?.reduce((s, r) => s + Number(r.conversion_value), 0) || 0

  return {
    leads,
    bookings,
    revenue,
    leadsDiff: leads - yLeads,
    bookingsDiff: bookings - yBookings,
    revenueDiff: revenue - yRevenue,
  }
}

export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  // 데모 뷰어: fixture 데이터 반환
  if (isDemoViewer(user.role)) return apiSuccess(getDemoKpi())

  try {
    // agency_staff 배정 클라이언트 0개 → 빈 결과
    if (assignedClientIds !== null && assignedClientIds.length === 0) {
      return apiSuccess({
        cpl: 0, roas: 0, bookingRate: 0, totalRevenue: 0,
        totalLeads: 0, actualLeads: 0, mediaConversionsTotal: 0, inflowCountTotal: 0,
        totalSpend: 0, totalConsultations: 0, cac: 0, arpc: 0, payingContactCount: 0,
        totalClicks: 0, totalImpressions: 0, cpc: 0, ctr: 0,
        today: { leads: 0, bookings: 0, revenue: 0, leadsDiff: 0, bookingsDiff: 0, revenueDiff: 0 },
      })
    }

    const supabase = serverSupabase()
    const url = new URL(req.url)
    const startParam = url.searchParams.get('startDate') || getKstDateString(new Date(Date.now() - 30 * 86400000))
    const endParam = url.searchParams.get('endDate') || getKstDateString()
    // ISO/YYYY-MM-DD → KST 기준 [start, end) 범위로 변환
    // end는 종료일 다음날 자정 (exclusive) — fetchTodaySummary와 동일 패턴
    const startKst = getKstDateString(new Date(startParam))
    const endKst = getKstDateString(new Date(endParam))
    const start = `${startKst}T00:00:00+09:00`
    const endDate = new Date(endKst + 'T00:00:00+09:00')
    endDate.setDate(endDate.getDate() + 1)
    const end = endDate.toISOString()
    const compare = url.searchParams.get('compare') === 'true'

    // 기간 KPI + 오늘 요약 병렬 조회
    const [current, today] = await Promise.all([
      fetchMetrics(supabase, clientId, assignedClientIds, start, end),
      fetchTodaySummary(supabase, clientId, assignedClientIds),
    ])

    // 비교 모드: 전기 데이터와 변화율 계산
    if (compare) {
      const duration = new Date(end).getTime() - new Date(start).getTime()
      const prevStart = new Date(new Date(start).getTime() - duration).toISOString()
      const prevEnd = new Date(new Date(end).getTime() - duration).toISOString()

      const previous = await fetchMetrics(supabase, clientId, assignedClientIds, prevStart, prevEnd)

      return apiSuccess({
        ...current,
        today,
        comparison: {
          cpl: calcChange(previous.cpl, current.cpl),
          roas: calcChange(previous.roas, current.roas),
          bookingRate: calcChange(previous.bookingRate, current.bookingRate),
          totalRevenue: calcChange(previous.totalRevenue, current.totalRevenue),
          totalLeads: calcChange(previous.totalLeads, current.totalLeads),
          totalConsultations: calcChange(previous.totalConsultations, current.totalConsultations),
          totalSpend: calcChange(previous.totalSpend, current.totalSpend),
          cac: calcChange(previous.cac, current.cac),
          arpc: calcChange(previous.arpc, current.arpc),
          cpc: calcChange(previous.cpc, current.cpc),
          ctr: calcChange(previous.ctr, current.ctr),
        },
      })
    }

    return apiSuccess({ ...current, today })
  } catch (err) {
    logger.error('KPI 조회 실패', err, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
