/**
 * 클라이언트/매체별 캠페인 목록 조회.
 *
 * - 수동 인입 보정 다이얼로그의 캠페인 드롭다운 등 캠페인 단위 액션을 위한 룩업용.
 * - ad_campaign_stats 에서 distinct (campaign_id, campaign_name) 추출.
 */

import { withClientFilter, ClientContext, applyClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { isApiPlatform } from '@/lib/platform'

const logger = createLogger('AdsCampaigns')

export const GET = withClientFilter(async (req: Request, { clientId, assignedClientIds }: ClientContext) => {
  const url = new URL(req.url)
  const platform = url.searchParams.get('platform')

  if (!platform || !isApiPlatform(platform)) {
    return apiError('platform 파라미터가 유효해야 합니다.')
  }

  const supabase = serverSupabase()
  let query = supabase
    .from('ad_campaign_stats')
    .select('campaign_id, campaign_name')
    .eq('platform', platform)
    .not('campaign_id', 'is', null)

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (!filtered) return apiSuccess({ campaigns: [] })

  const { data, error } = await filtered
  if (error) {
    logger.error('ad_campaign_stats 캠페인 목록 조회 실패', error, { clientId, platform })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  const seen = new Set<string>()
  const campaigns: { id: string; name: string }[] = []
  for (const r of data || []) {
    const id = String((r as { campaign_id: string }).campaign_id)
    if (seen.has(id)) continue
    seen.add(id)
    campaigns.push({ id, name: (r as { campaign_name: string | null }).campaign_name ?? id })
  }

  campaigns.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return apiSuccess({ campaigns })
})
