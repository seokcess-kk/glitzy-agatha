/**
 * UTM 링크 히스토리 API
 * GET: 링크 목록 조회
 * POST: 링크 저장
 */

import { withClientFilter, applyClientFilter, apiError, apiSuccess, ClientContext } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { sanitizeUtmParam } from '@/lib/utm'
import { parseId, sanitizeString } from '@/lib/security'

export const GET = withClientFilter(async (req: Request, { clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const limitParam = parseInt(url.searchParams.get('limit') || '50')
  const limit = Math.min(Number.isNaN(limitParam) ? 50 : limitParam, 100)

  let query = supabase
    .from('utm_links')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return apiSuccess({ links: [] })
  query = filtered

  const { data, error } = await query

  if (error) {
    return apiError('링크 조회 실패: ' + error.message)
  }

  return apiSuccess({ links: data || [] })
})

export const POST = withClientFilter(async (req: Request, { user, clientId }: ClientContext) => {
  let body
  try {
    body = await req.json()
  } catch {
    return apiError('잘못된 요청 형식입니다.', 400)
  }

  // 필수 필드 검증
  if (!body.original_url?.trim()) {
    return apiError('URL이 필요합니다.')
  }

  // client_id 결정
  let targetClientId = clientId
  if (user.role === 'superadmin' && body.client_id) {
    targetClientId = parseId(body.client_id)
  }
  if (!targetClientId) {
    return apiError('client_id가 필요합니다.')
  }

  const supabase = serverSupabase()

  const insertData = {
    client_id: targetClientId,
    original_url: String(body.original_url).slice(0, 2000).replace(/[<>'"]/g, ''),
    utm_source: sanitizeUtmParam(body.utm_source, 50),
    utm_medium: sanitizeUtmParam(body.utm_medium, 50),
    utm_campaign: sanitizeUtmParam(body.utm_campaign, 100),
    utm_content: sanitizeUtmParam(body.utm_content, 200),
    utm_term: sanitizeUtmParam(body.utm_term, 100),
    label: sanitizeString(body.label, 100) || null,
    template_id: body.template_id ? parseId(body.template_id) : null,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('utm_links')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return apiError('링크 저장 실패: ' + error.message)
  }

  return apiSuccess({ link: data }, 201)
})
