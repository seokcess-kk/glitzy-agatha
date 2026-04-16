import { serverSupabase } from '@/lib/supabase'
import { withExternalAuth, apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'
import { parseId } from '@/lib/security'

const logger = createLogger('ExternalAdSpend')

// Supabase 기본 1000행 제한 우회 — 전체 병원 월간 조회 시 충분한 마진
const AD_QUERY_LIMIT = 10000

/**
 * 외부 API: 병원별 월간 광고 실집행비 + SMS 발송 건수
 *
 * GET /api/external/ad-spend?month=2026-03
 *   → 전체 병원 리스트 (지점별 비교용)
 *
 * GET /api/external/ad-spend?clinic_id=5&month=2026-03
 *   → 특정 병원 상세
 *
 * 인증: Authorization: Bearer {EXTERNAL_SERVICE_KEY}
 */
export const GET = withExternalAuth(async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM
    const clinicIdParam = searchParams.get('clinic_id')

    // month 필수 검증 (YYYY-MM 형식 + 유효 범위)
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return apiError('month 파라미터가 필요합니다 (형식: YYYY-MM)', 400)
    }

    const [year, mon] = month.split('-').map(Number)
    if (mon < 1 || mon > 12) {
      return apiError('유효한 월을 입력해주세요 (01-12)', 400)
    }

    const startDate = `${month}-01`
    const lastDay = new Date(year, mon, 0).getDate()
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

    // Timestamp: next day midnight exclusive
    const tsEndDate = new Date(endDate + 'T00:00:00+09:00')
    tsEndDate.setDate(tsEndDate.getDate() + 1)
    const tsEnd = tsEndDate.toISOString()

    const clinicId = clinicIdParam ? parseId(clinicIdParam) : null
    if (clinicIdParam && !clinicId) {
      return apiError('유효한 clinic_id가 필요합니다', 400)
    }

    const supabase = serverSupabase()

    // 1. 광고비 집계 (매체별) — limit으로 기본 1000행 제한 우회
    let adQuery = supabase
      .from('ad_campaign_stats')
      .select('clinic_id, platform, spend_amount, clicks, impressions')
      .gte('stat_date', startDate)
      .lte('stat_date', endDate)
      .limit(AD_QUERY_LIMIT)

    if (clinicId) adQuery = adQuery.eq('clinic_id', clinicId)

    // 2. SMS 발송 건수 — count 쿼리 (행 데이터 불필요)
    const smsCountPromise = clinicId
      ? supabase
          .from('sms_send_logs')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', clinicId)
          .eq('status', 'sent')
          .gte('created_at', `${startDate}T00:00:00+09:00`)
          .lt('created_at', tsEnd)
      : // 전체 병원: clinic_id별 건수 필요 → 행 조회 후 집계
        supabase
          .from('sms_send_logs')
          .select('clinic_id')
          .eq('status', 'sent')
          .gte('created_at', `${startDate}T00:00:00+09:00`)
          .lt('created_at', tsEnd)
          .limit(AD_QUERY_LIMIT)

    // 3. 병원 정보
    let clinicQuery = supabase.from('clinics').select('id, name')
    if (clinicId) clinicQuery = clinicQuery.eq('id', clinicId)

    const [adResult, smsResult, clinicResult] = await Promise.all([
      adQuery,
      smsCountPromise,
      clinicQuery,
    ])

    if (adResult.error) {
      logger.error('광고 데이터 조회 실패', adResult.error)
      return apiError('광고 데이터 조회 실패', 500)
    }
    if (smsResult.error) {
      logger.error('SMS 데이터 조회 실패', smsResult.error)
      return apiError('SMS 데이터 조회 실패', 500)
    }

    const clinicMap = new Map<number, string>()
    for (const c of clinicResult.data || []) {
      clinicMap.set(c.id, c.name)
    }

    // 병원별 집계
    type PlatformAgg = { spend: number; clicks: number; impressions: number }
    type ClinicAgg = {
      platforms: Record<string, PlatformAgg>
      sms_count: number
    }

    const clinicAgg = new Map<number, ClinicAgg>()

    const getOrCreate = (cid: number): ClinicAgg => {
      if (!clinicAgg.has(cid)) {
        clinicAgg.set(cid, { platforms: {}, sms_count: 0 })
      }
      return clinicAgg.get(cid)!
    }

    // 광고비 집계
    for (const row of adResult.data || []) {
      if (!row.clinic_id) continue
      const agg = getOrCreate(row.clinic_id)
      const platform = (row.platform || 'unknown').toLowerCase()
      if (!agg.platforms[platform]) {
        agg.platforms[platform] = { spend: 0, clicks: 0, impressions: 0 }
      }
      agg.platforms[platform].spend += Number(row.spend_amount) || 0
      agg.platforms[platform].clicks += Number(row.clicks) || 0
      agg.platforms[platform].impressions += Number(row.impressions) || 0
    }

    // SMS 건수 집계
    if (clinicId) {
      // 특정 병원: count 쿼리 결과 사용
      const agg = getOrCreate(clinicId)
      agg.sms_count = smsResult.count ?? 0
    } else {
      // 전체 병원: 행 데이터에서 clinic_id별 집계
      for (const row of (smsResult.data || []) as { clinic_id: number | null }[]) {
        if (!row.clinic_id) continue
        const agg = getOrCreate(row.clinic_id)
        agg.sms_count += 1
      }
    }

    // 응답 구성
    const buildClinicResponse = (cid: number, agg: ClinicAgg) => {
      const platforms = Object.entries(agg.platforms).map(([platform, data]) => ({
        platform,
        spend: Math.round(data.spend),
        clicks: data.clicks,
        impressions: data.impressions,
      }))
      const totalSpend = platforms.reduce((sum, p) => sum + p.spend, 0)

      return {
        clinic_id: cid,
        clinic_name: clinicMap.get(cid) || `Clinic ${cid}`,
        total_spend: totalSpend,
        platforms,
        sms_count: agg.sms_count,
      }
    }

    // 특정 병원 조회
    if (clinicId) {
      const agg = clinicAgg.get(clinicId) || { platforms: {}, sms_count: 0 }
      return apiSuccess({
        month,
        ...buildClinicResponse(clinicId, agg),
      })
    }

    // 전체 병원 리스트
    const clinics = Array.from(clinicAgg.entries())
      .map(([cid, agg]) => buildClinicResponse(cid, agg))
      .sort((a, b) => b.total_spend - a.total_spend)

    const grandTotal = clinics.reduce((sum, c) => sum + c.total_spend, 0)
    const totalSms = clinics.reduce((sum, c) => sum + c.sms_count, 0)

    return apiSuccess({
      month,
      clinics,
      grand_total: grandTotal,
      total_sms: totalSms,
    })
  } catch (err) {
    logger.error('외부 광고비 API 오류', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
