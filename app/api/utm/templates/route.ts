/**
 * UTM 템플릿 API
 * GET: 템플릿 목록 조회
 * POST: 템플릿 생성
 */

import { withClinicFilter, applyClinicFilter, apiError, apiSuccess, ClinicContext } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { sanitizeUtmParam } from '@/lib/utm'
import { parseId, sanitizeString, sanitizeUrl } from '@/lib/security'

export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('utm_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess({ templates: [] })
  query = filtered

  const { data, error } = await query

  if (error) {
    return apiError('템플릿 조회 실패: ' + error.message)
  }

  return apiSuccess({ templates: data || [] })
})

export const POST = withClinicFilter(async (req: Request, { user, clinicId }: ClinicContext) => {
  let body
  try {
    body = await req.json()
  } catch {
    return apiError('잘못된 요청 형식입니다.', 400)
  }

  // 필수 필드 검증
  const name = sanitizeString(body.name, 100)
  if (!name) {
    return apiError('템플릿 이름이 필요합니다.')
  }

  // clinic_id 결정 (superadmin은 body에서 지정 가능)
  let targetClinicId = clinicId
  if (user.role === 'superadmin' && body.clinic_id) {
    targetClinicId = parseId(body.clinic_id)
  }
  if (!targetClinicId) {
    return apiError('clinic_id가 필요합니다.')
  }

  const supabase = serverSupabase()

  // 중복 이름 체크
  const { data: existing } = await supabase
    .from('utm_templates')
    .select('id')
    .eq('clinic_id', targetClinicId)
    .eq('name', name)
    .single()

  if (existing) {
    return apiError('이미 동일한 이름의 템플릿이 존재합니다.')
  }

  // is_default가 true면 기존 기본 템플릿 해제
  if (body.is_default === true) {
    await supabase
      .from('utm_templates')
      .update({ is_default: false })
      .eq('clinic_id', targetClinicId)
      .eq('is_default', true)
  }

  const insertData = {
    clinic_id: targetClinicId,
    name,
    base_url: sanitizeUrl(body.base_url, 500) || null,
    utm_source: sanitizeUtmParam(body.utm_source, 50),
    utm_medium: sanitizeUtmParam(body.utm_medium, 50),
    utm_campaign: sanitizeUtmParam(body.utm_campaign, 100),
    utm_content: sanitizeUtmParam(body.utm_content, 200),
    utm_term: sanitizeUtmParam(body.utm_term, 100),
    platform: sanitizeString(body.platform, 30) || null,
    is_default: body.is_default === true,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('utm_templates')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return apiError('템플릿 생성 실패: ' + error.message)
  }

  return apiSuccess({ template: data }, 201)
})
