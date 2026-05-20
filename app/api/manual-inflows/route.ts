/**
 * 수동 인입 보정 (manual_inflows) CRUD
 *
 * - GET: 클라이언트/매체/기간 조회 (캘린더 그리드 로딩용)
 * - PUT: 단일 일자 upsert (count, reason)
 * - DELETE: 단일 일자 보정 삭제
 *
 * 권한: client_admin 이상 (client_staff 차단). agency_staff 는 배정된
 *       클라이언트만 접근. superadmin 은 ?client_id=X 로 지정.
 */

import { withClientAdmin, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { sanitizeString } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { createLogger } from '@/lib/logger'
import { isApiPlatform } from '@/lib/platform'

const logger = createLogger('ManualInflows')

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/manual-inflows?platform=adn_ads&start=2026-05-01&end=2026-05-31
 *   → [{ stat_date, count, reason, updated_at }]
 */
export const GET = withClientAdmin(async (req, { clientId, assignedClientIds }) => {
  const url = new URL(req.url)
  const platform = url.searchParams.get('platform')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  if (!platform || !isApiPlatform(platform)) {
    return apiError('platform 파라미터가 유효해야 합니다.')
  }
  if (!start || !DATE_RE.test(start) || !end || !DATE_RE.test(end)) {
    return apiError('start/end 는 YYYY-MM-DD 형식이어야 합니다.')
  }

  const supabase = serverSupabase()
  let query = supabase
    .from('manual_inflows')
    .select('id, client_id, platform, stat_date, count, reason, updated_at, updated_by')
    .eq('platform', platform)
    .gte('stat_date', start)
    .lte('stat_date', end)
    .order('stat_date', { ascending: true })

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (!filtered) return apiSuccess([])

  const { data, error } = await filtered
  if (error) {
    logger.error('manual_inflows 조회 실패', error, { clientId, platform })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  return apiSuccess(data || [])
})

/**
 * PUT /api/manual-inflows
 *   body: { platform, stat_date, count, reason? }
 *   → upsert (client_id, platform, stat_date) 단위. count=0 도 허용 (입력 후 0 으로 재설정)
 */
export const PUT = withClientAdmin(async (req, { user, clientId }) => {
  if (!clientId) return apiError('클라이언트 컨텍스트가 필요합니다.')

  let body: { platform?: unknown; stat_date?: unknown; count?: unknown; reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError('유효한 JSON 본문이 필요합니다.')
  }

  const { platform, stat_date, count, reason } = body

  if (!isApiPlatform(platform)) {
    return apiError('platform 이 유효하지 않습니다.')
  }
  if (typeof stat_date !== 'string' || !DATE_RE.test(stat_date)) {
    return apiError('stat_date 는 YYYY-MM-DD 형식이어야 합니다.')
  }
  const countNum = typeof count === 'number' ? count : Number(count)
  if (!Number.isFinite(countNum) || countNum < 0 || countNum > 1_000_000) {
    return apiError('count 는 0 이상의 정수여야 합니다.')
  }
  const intCount = Math.floor(countNum)
  const safeReason = typeof reason === 'string' ? sanitizeString(reason, 500) : null

  const supabase = serverSupabase()
  const nowIso = new Date().toISOString()

  // 기존 행 확인 (created_by 보존용)
  const { data: existing } = await supabase
    .from('manual_inflows')
    .select('id, created_by')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .eq('stat_date', stat_date)
    .maybeSingle()

  const { data, error } = await supabase
    .from('manual_inflows')
    .upsert(
      {
        client_id: clientId,
        platform,
        stat_date,
        count: intCount,
        reason: safeReason,
        created_by: existing?.created_by ?? user.id,
        updated_by: user.id,
        updated_at: nowIso,
      },
      { onConflict: 'client_id,platform,stat_date' }
    )
    .select('id, stat_date, count, reason, updated_at')
    .maybeSingle()

  if (error) {
    logger.error('manual_inflows upsert 실패', error, { clientId, platform, stat_date })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  await logActivity(supabase, {
    userId: user.id,
    clientId,
    action: existing ? 'update' : 'create',
    targetTable: 'manual_inflows',
    targetId: data?.id ?? null,
    detail: { platform, stat_date, count: intCount, reason: safeReason },
  })

  return apiSuccess(data)
})

/**
 * DELETE /api/manual-inflows
 *   body: { platform, stat_date }
 */
export const DELETE = withClientAdmin(async (req, { user, clientId }) => {
  if (!clientId) return apiError('클라이언트 컨텍스트가 필요합니다.')

  let body: { platform?: unknown; stat_date?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError('유효한 JSON 본문이 필요합니다.')
  }

  const { platform, stat_date } = body
  if (!isApiPlatform(platform)) {
    return apiError('platform 이 유효하지 않습니다.')
  }
  if (typeof stat_date !== 'string' || !DATE_RE.test(stat_date)) {
    return apiError('stat_date 는 YYYY-MM-DD 형식이어야 합니다.')
  }

  const supabase = serverSupabase()

  const { data: existing } = await supabase
    .from('manual_inflows')
    .select('id')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .eq('stat_date', stat_date)
    .maybeSingle()

  if (!existing) {
    return apiSuccess({ deleted: false })
  }

  const { error } = await supabase
    .from('manual_inflows')
    .delete()
    .eq('id', existing.id)

  if (error) {
    logger.error('manual_inflows 삭제 실패', error, { clientId, platform, stat_date })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  await logActivity(supabase, {
    userId: user.id,
    clientId,
    action: 'delete',
    targetTable: 'manual_inflows',
    targetId: existing.id,
    detail: { platform, stat_date },
  })

  return apiSuccess({ deleted: true })
})
