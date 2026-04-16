import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, withAuth, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'
import { archiveBeforeDelete } from '@/lib/archive'

const MAX_KEYWORDS_PER_CLINIC = 5

export const GET = withClinicFilter(async (req, { clinicId, assignedClinicIds }) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('press_keywords')
    .select('*')
    .order('created_at', { ascending: true })

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const POST = withAuth(async (req, { user }) => {
  const { clinic_id, keyword } = await req.json()

  const cid = parseId(clinic_id)
  if (!cid) return apiError('병원을 선택해주세요.', 400)
  if (!keyword?.trim()) return apiError('키워드를 입력해주세요.', 400)

  const supabase = serverSupabase()

  // clinic_admin/clinic_staff: 자기 병원만
  if (user.role === 'clinic_admin' || user.role === 'clinic_staff') {
    if (Number(user.clinic_id) !== cid) {
      return apiError('자신의 병원 키워드만 관리할 수 있습니다.', 403)
    }
  }

  // agency_staff: 배정된 병원만
  if (user.role === 'agency_staff') {
    const { data: assignment } = await supabase
      .from('user_clinic_assignments')
      .select('id')
      .eq('user_id', parseInt(user.id, 10))
      .eq('clinic_id', cid)
      .single()
    if (!assignment) return apiError('배정되지 않은 병원입니다.', 403)
  }

  // 키워드 개수 제한
  const { count } = await supabase
    .from('press_keywords')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', cid)

  if ((count ?? 0) >= MAX_KEYWORDS_PER_CLINIC) {
    return apiError(`키워드는 최대 ${MAX_KEYWORDS_PER_CLINIC}개까지 등록 가능합니다.`, 400)
  }

  const { data, error } = await supabase
    .from('press_keywords')
    .insert({
      clinic_id: cid,
      keyword: sanitizeString(keyword.trim(), 100),
      created_by: parseInt(user.id, 10),
    })
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

export const DELETE = withAuth(async (req, { user }) => {
  const { id } = await req.json()
  const keywordId = parseId(id)
  if (!keywordId) return apiError('유효한 키워드 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const { data: kw } = await supabase
    .from('press_keywords')
    .select('id, clinic_id')
    .eq('id', keywordId)
    .single()
  if (!kw) return apiError('키워드를 찾을 수 없습니다.', 404)

  // clinic_admin/clinic_staff: 자기 병원만
  if (user.role === 'clinic_admin' || user.role === 'clinic_staff') {
    if (Number(user.clinic_id) !== kw.clinic_id) {
      return apiError('자신의 병원 키워드만 관리할 수 있습니다.', 403)
    }
  }

  // agency_staff: 배정된 병원만
  if (user.role === 'agency_staff') {
    const { data: assignment } = await supabase
      .from('user_clinic_assignments')
      .select('id')
      .eq('user_id', parseInt(user.id, 10))
      .eq('clinic_id', kw.clinic_id)
      .single()
    if (!assignment) return apiError('배정되지 않은 병원의 키워드입니다.', 403)
  }

  await archiveBeforeDelete(supabase, 'press_keywords', keywordId, user.id, kw.clinic_id)

  const { error } = await supabase
    .from('press_keywords')
    .delete()
    .eq('id', keywordId)
  if (error) return apiError(error.message, 500)

  return apiSuccess({ deleted: true })
})
