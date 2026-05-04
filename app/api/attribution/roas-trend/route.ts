import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('RoasTrend')

interface DayChannelEntry {
  date: string
  channels: Record<string, { spend: number; revenue: number; roas: number }>
}

/**
 * 채널별 일별 ROAS 추이 API
 * GET /api/attribution/roas-trend?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * 매출 = leads where status='converted' + conversion_value (status_changed_at 기준)
 * NULL 레거시 데이터는 누락될 수 있음 (TODO: 백필 마이그레이션 후 제거).
 */
export const GET = withClientFilter(async (req: Request, { clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)

  const today = getKstDateString()
  const startDate = url.searchParams.get('startDate') || getKstDateString(new Date(Date.now() - 30 * 86400000))
  const endDate = url.searchParams.get('endDate') || today

  // KST 기준 [start, end) 패턴 (status_changed_at은 timestamp)
  const tsStart = `${startDate}T00:00:00+09:00`
  const tsEndDate = new Date(endDate + 'T00:00:00+09:00')
  tsEndDate.setDate(tsEndDate.getDate() + 1)
  const tsEnd = tsEndDate.toISOString()

  // 빈 날짜 틀 생성
  const dayMap = new Map<string, Record<string, { spend: number; revenue: number }>>()
  const start = new Date(startDate)
  const end = new Date(endDate)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dayMap.set(getKstDateString(new Date(d)), {})
  }

  // 광고비 쿼리 (일별 + 플랫폼별)
  let adQuery = supabase
    .from('ad_campaign_stats')
    .select('stat_date, platform, spend_amount')
    .gte('stat_date', startDate)
    .lte('stat_date', endDate)

  // 전환 리드 쿼리 (일별 + 고객의 첫 유입 채널)
  let convQuery = supabase
    .from('leads')
    .select('conversion_value, status_changed_at, contacts(first_source)')
    .eq('status', 'converted')
    .not('conversion_value', 'is', null)
    .gte('status_changed_at', tsStart)
    .lt('status_changed_at', tsEnd)

  const adFiltered = applyClientFilter(adQuery, { clientId, assignedClientIds })
  const convFiltered = applyClientFilter(convQuery, { clientId, assignedClientIds })

  if (adFiltered === null && convFiltered === null) {
    return apiSuccess([])
  }
  if (adFiltered) adQuery = adFiltered
  if (convFiltered) convQuery = convFiltered

  try {
    const [adRes, convRes] = await Promise.all([
      adFiltered ? adQuery : Promise.resolve({ data: [] as { stat_date: string; platform: string; spend_amount: number }[], error: null }),
      convFiltered ? convQuery : Promise.resolve({ data: [] as { conversion_value: number; status_changed_at: string; contacts: { first_source: string | null } | null }[], error: null }),
    ])

    if (adRes.error) return apiError(adRes.error.message, 500)
    if (convRes.error) return apiError(convRes.error.message, 500)

    const toKstDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

    // 광고비 일별 채널 집계
    for (const row of adRes.data || []) {
      const date = row.stat_date.slice(0, 10)
      const ch = normalizeChannel(row.platform)
      const entry = dayMap.get(date)
      if (!entry) continue
      if (!entry[ch]) entry[ch] = { spend: 0, revenue: 0 }
      entry[ch].spend += Number(row.spend_amount) || 0
    }

    // 매출 일별 채널 집계 (퍼스트터치 기준)
    for (const row of convRes.data || []) {
      const contact = row.contacts as unknown as { first_source: string | null } | null
      const ch = normalizeChannel(contact?.first_source ?? null)
      if (!row.status_changed_at) continue
      const date = toKstDate(row.status_changed_at)
      const entry = dayMap.get(date)
      if (!entry) continue
      if (!entry[ch]) entry[ch] = { spend: 0, revenue: 0 }
      entry[ch].revenue += Number(row.conversion_value) || 0
    }

    // ROAS 계산 + 응답 조립
    const result: DayChannelEntry[] = []
    for (const [date, channels] of dayMap) {
      const computed: Record<string, { spend: number; revenue: number; roas: number }> = {}
      for (const [ch, data] of Object.entries(channels)) {
        computed[ch] = {
          spend: data.spend,
          revenue: Math.round(data.revenue),
          roas: data.spend > 0 ? Number((data.revenue / data.spend).toFixed(2)) : 0,
        }
      }
      result.push({ date, channels: computed })
    }

    return apiSuccess(result)
  } catch (error) {
    logger.error('ROAS 추이 조회 실패', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
