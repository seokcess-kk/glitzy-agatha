import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'
import { isDemoViewer, getDemoFunnel } from '@/lib/demo-data'


/**
 * 퍼널 분석 API
 * Agatha 모델: New(유입) → In Progress(진행) → Converted(전환)
 * 하단에 보류 건수(%), 미전환 건수(%) 표시
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoFunnel())

  const url = new URL(req.url)
  const startParam = url.searchParams.get('startDate')
  const endParam = url.searchParams.get('endDate')
  const groupBy = url.searchParams.get('groupBy') || 'total' // total | channel | campaign

  const supabase = serverSupabase()

  // agency_staff 배정 클라이언트 0개 → 빈 결과
  if (assignedClientIds !== null && assignedClientIds.length === 0) {
    return apiSuccess({ type: 'total', funnel: { stages: [], totalConversionRate: 0, holdCount: 0, holdRate: 0, lostCount: 0, lostRate: 0 } })
  }

  const ctx = { clientId, assignedClientIds }

  // KPI와 동일한 날짜 범위 변환: ISO → KST 기준 [start, end) 패턴
  const startKst = startParam ? getKstDateString(new Date(startParam)) : null
  const endKst = endParam ? getKstDateString(new Date(endParam)) : null
  const tsStart = startKst ? `${startKst}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (endKst) {
    const endDate = new Date(endKst + 'T00:00:00+09:00')
    endDate.setDate(endDate.getDate() + 1)
    tsEnd = endDate.toISOString()
  }

  // 리드 데이터 조회 (상태 포함)
  let leadsQuery = supabase
    .from('leads')
    .select('id, contact_id, utm_source, utm_campaign, status, created_at')
    .neq('status', 'invalid') // 무효 제외
    .limit(5000)
  leadsQuery = applyClientFilter(leadsQuery, ctx)!
  if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
  if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

  const leadsRes = await leadsQuery

  const leads = leadsRes.data || []

  // 고객별 채널/캠페인 매핑
  const contactChannel: Map<number, string> = new Map()
  const contactCampaign: Map<number, string> = new Map()

  for (const lead of leads) {
    if (!contactChannel.has(lead.contact_id)) {
      contactChannel.set(lead.contact_id, normalizeChannel(lead.utm_source))
    }
    if (!contactCampaign.has(lead.contact_id) && lead.utm_campaign) {
      contactCampaign.set(lead.contact_id, lead.utm_campaign)
    }
  }

  // 전체 퍼널 또는 그룹별 퍼널
  if (groupBy === 'total') {
    const funnel = buildAgathaFunnel(leads)
    return apiSuccess({ type: 'total', funnel })
  }

  // 채널별 또는 캠페인별 그룹
  const groups: Record<string, typeof leads> = {}

  for (const lead of leads) {
    const key = groupBy === 'channel'
      ? (contactChannel.get(lead.contact_id) || 'Unknown')
      : (contactCampaign.get(lead.contact_id) || 'Unknown')
    if (!groups[key]) groups[key] = []
    groups[key].push(lead)
  }

  const result = Object.entries(groups)
    .filter(([key, groupLeads]) => key !== 'Unknown' || groupLeads.length > 0)
    .map(([key, groupLeads]) => ({
      group: key,
      funnel: buildAgathaFunnel(groupLeads),
    }))
    .sort((a, b) => b.funnel.stages[0].count - a.funnel.stages[0].count)

  return apiSuccess({ type: groupBy, funnels: result })
})

/**
 * Agatha 퍼널 데이터 생성
 * New(유입) → In Progress(진행) → Converted(전환)
 */
function buildAgathaFunnel(
  leads: { id: number; status: string; contact_id: number }[]
) {
  // 유효 리드 (invalid 제외) — 이미 쿼리에서 제외했지만 방어적 필터
  const validLeads = leads.filter(l => l.status !== 'invalid')
  const totalCount = validLeads.length

  // 각 상태별 카운트
  const newCount = totalCount // 전체 유효 리드 = 유입
  const inProgressCount = validLeads.filter(l =>
    ['in_progress', 'converted', 'lost', 'hold'].includes(l.status)
  ).length
  const convertedCount = validLeads.filter(l => l.status === 'converted').length
  const holdCount = validLeads.filter(l => l.status === 'hold').length
  const lostCount = validLeads.filter(l => l.status === 'lost').length

  const stages = [
    {
      stage: 'New',
      label: '유입',
      count: newCount,
      rate: 100,
      dropoff: 0,
    },
    {
      stage: 'InProgress',
      label: '진행',
      count: inProgressCount,
      rate: newCount > 0 ? Number(((inProgressCount / newCount) * 100).toFixed(1)) : 0,
      dropoff: newCount > 0 ? Number((((newCount - inProgressCount) / newCount) * 100).toFixed(1)) : 0,
    },
    {
      stage: 'Converted',
      label: '전환',
      count: convertedCount,
      rate: newCount > 0 ? Number(((convertedCount / newCount) * 100).toFixed(1)) : 0,
      dropoff: inProgressCount > 0 ? Number((((inProgressCount - convertedCount) / inProgressCount) * 100).toFixed(1)) : 0,
    },
  ]

  return {
    stages,
    totalConversionRate: newCount > 0 ? Number(((convertedCount / newCount) * 100).toFixed(1)) : 0,
    holdCount,
    holdRate: totalCount > 0 ? Number(((holdCount / totalCount) * 100).toFixed(1)) : 0,
    lostCount,
    lostRate: totalCount > 0 ? Number(((lostCount / totalCount) * 100).toFixed(1)) : 0,
  }
}
