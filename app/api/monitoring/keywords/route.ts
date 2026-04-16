import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, withAuth, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, sanitizeUrl, parseId } from '@/lib/security'
import { archiveBeforeDelete } from '@/lib/archive'

export const GET = withClientFilter(async (req, { clientId, assignedClientIds }) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('monitoring_keywords')
    .select('*')
    .order('category')
    .order('keyword')

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const url = new URL(req.url)
  const activeOnly = url.searchParams.get('active_only')
  if (activeOnly === 'true') query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const POST = withAuth(async (req, { user }) => {
  if (user.role !== 'superadmin' && user.role !== 'agency_staff' && user.role !== 'client_admin') {
    return apiError('키워드 관리 권한이 없습니다.', 403)
  }

  const { client_id, keyword, category, url } = await req.json()

  const cid = parseId(client_id)
  if (!cid) return apiError('클라이언트을 선택해주세요.', 400)
  if (!keyword?.trim()) return apiError('키워드를 입력해주세요.', 400)

  const validCategories = ['place', 'website', 'smartblock', 'related']
  if (!validCategories.includes(category)) return apiError('유효하지 않은 카테고리입니다.', 400)

  const supabase = serverSupabase()

  // 역할별 클라이언트 접근 검증
  if (user.role === 'agency_staff') {
    const { data: assignment } = await supabase
      .from('user_client_assignments')
      .select('id')
      .eq('user_id', parseInt(user.id, 10))
      .eq('client_id', cid)
      .single()
    if (!assignment) return apiError('배정되지 않은 클라이언트입니다.', 403)
  } else if (user.role === 'client_admin') {
    if (cid !== Number(user.client_id)) return apiError('자신의 클라이언트 키워드만 관리 가능합니다.', 403)
  }

  const insertData: Record<string, any> = {
    client_id: cid,
    keyword: sanitizeString(keyword.trim(), 100),
    category,
    created_by: parseInt(user.id, 10),
  }
  if (url?.trim()) insertData.url = sanitizeUrl(url.trim(), 500)

  const { data, error } = await supabase
    .from('monitoring_keywords')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return apiError('이미 등록된 키워드입니다.', 400)
    }
    return apiError(error.message, 500)
  }
  return apiSuccess(data, 201)
})

export const PATCH = withAuth(async (req, { user }) => {
  if (user.role !== 'superadmin' && user.role !== 'agency_staff' && user.role !== 'client_admin') {
    return apiError('키워드 관리 권한이 없습니다.', 403)
  }

  const { id, is_active, keyword, url } = await req.json()

  const keywordId = parseId(id)
  if (!keywordId) return apiError('유효한 키워드 ID가 필요합니다.', 400)

  const updates: Record<string, any> = {}
  if (typeof is_active === 'boolean') updates.is_active = is_active
  if (keyword?.trim()) updates.keyword = sanitizeString(keyword.trim(), 100)
  if (typeof url === 'string') updates.url = url.trim() ? sanitizeUrl(url.trim(), 500) : null

  if (Object.keys(updates).length === 0) return apiError('변경할 항목이 없습니다.', 400)

  const supabase = serverSupabase()

  // 역할별 클라이언트 접근 검증
  if (user.role === 'agency_staff' || user.role === 'client_admin') {
    const { data: kw } = await supabase
      .from('monitoring_keywords')
      .select('client_id')
      .eq('id', keywordId)
      .single()
    if (!kw) return apiError('키워드를 찾을 수 없습니다.', 404)

    if (user.role === 'agency_staff') {
      const { data: assignment } = await supabase
        .from('user_client_assignments')
        .select('id')
        .eq('user_id', parseInt(user.id, 10))
        .eq('client_id', kw.client_id)
        .single()
      if (!assignment) return apiError('배정되지 않은 클라이언트의 키워드입니다.', 403)
    } else if (kw.client_id !== Number(user.client_id)) {
      return apiError('자신의 클라이언트 키워드만 관리 가능합니다.', 403)
    }
  }

  const { data, error } = await supabase
    .from('monitoring_keywords')
    .update(updates)
    .eq('id', keywordId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const DELETE = withAuth(async (req, { user }) => {
  if (user.role !== 'superadmin' && user.role !== 'agency_staff' && user.role !== 'client_admin') {
    return apiError('키워드 관리 권한이 없습니다.', 403)
  }

  const { id } = await req.json()
  const keywordId = parseId(id)
  if (!keywordId) return apiError('유효한 키워드 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const { data: kw } = await supabase
    .from('monitoring_keywords')
    .select('id, client_id')
    .eq('id', keywordId)
    .single()
  if (!kw) return apiError('키워드를 찾을 수 없습니다.', 404)

  if (user.role === 'agency_staff') {
    const { data: assignment } = await supabase
      .from('user_client_assignments')
      .select('id')
      .eq('user_id', parseInt(user.id, 10))
      .eq('client_id', kw.client_id)
      .single()
    if (!assignment) return apiError('배정되지 않은 클라이언트의 키워드입니다.', 403)
  } else if (user.role === 'client_admin') {
    if (kw.client_id !== Number(user.client_id)) return apiError('자신의 클라이언트 키워드만 관리 가능합니다.', 403)
  }

  await archiveBeforeDelete(supabase, 'monitoring_keywords', keywordId, user.id, kw.client_id)

  const { error } = await supabase
    .from('monitoring_keywords')
    .delete()
    .eq('id', keywordId)
  if (error) return apiError(error.message, 500)

  return apiSuccess({ deleted: true })
})
