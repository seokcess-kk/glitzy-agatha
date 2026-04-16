/**
 * UTM 템플릿 단일 API
 * PUT: 템플릿 수정
 * DELETE: 템플릿 삭제
 */

import { withClientFilter, apiError, apiSuccess, ClientContext } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { sanitizeUtmParam } from '@/lib/utm'
import { parseId, sanitizeString, sanitizeUrl } from '@/lib/security'
import { archiveBeforeDelete } from '@/lib/archive'

export const PUT = withClientFilter(async (req: Request, { user, clientId }: ClientContext) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const idStr = pathParts[pathParts.length - 1]
  const templateId = parseId(idStr)

  if (!templateId) {
    return apiError('유효한 템플릿 ID가 필요합니다.')
  }

  let body
  try {
    body = await req.json()
  } catch {
    return apiError('잘못된 요청 형식입니다.', 400)
  }

  const supabase = serverSupabase()

  // 템플릿 존재 및 권한 확인
  const { data: template, error: fetchError } = await supabase
    .from('utm_templates')
    .select('id, client_id')
    .eq('id', templateId)
    .single()

  if (fetchError || !template) {
    return apiError('템플릿을 찾을 수 없습니다.', 404)
  }

  // 권한 검증 (superadmin이 아니면 자신의 client만 수정 가능)
  if (user.role !== 'superadmin' && template.client_id !== clientId) {
    return apiError('이 템플릿을 수정할 권한이 없습니다.', 403)
  }

  // 업데이트 데이터 구성
  const updateData: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = sanitizeString(body.name, 100)
    if (!name) {
      return apiError('템플릿 이름이 필요합니다.')
    }
    // 중복 이름 체크 (자기 자신 제외)
    const { data: existing } = await supabase
      .from('utm_templates')
      .select('id')
      .eq('client_id', template.client_id)
      .eq('name', name)
      .neq('id', templateId)
      .single()

    if (existing) {
      return apiError('이미 동일한 이름의 템플릿이 존재합니다.')
    }
    updateData.name = name
  }

  if (body.base_url !== undefined) updateData.base_url = sanitizeUrl(body.base_url, 500) || null
  if (body.utm_source !== undefined) updateData.utm_source = sanitizeUtmParam(body.utm_source, 50)
  if (body.utm_medium !== undefined) updateData.utm_medium = sanitizeUtmParam(body.utm_medium, 50)
  if (body.utm_campaign !== undefined) updateData.utm_campaign = sanitizeUtmParam(body.utm_campaign, 100)
  if (body.utm_content !== undefined) updateData.utm_content = sanitizeUtmParam(body.utm_content, 200)
  if (body.utm_term !== undefined) updateData.utm_term = sanitizeUtmParam(body.utm_term, 100)
  if (body.platform !== undefined) updateData.platform = sanitizeString(body.platform, 30) || null
  if (body.is_default !== undefined) {
    updateData.is_default = body.is_default === true
    // is_default가 true면 기존 기본 템플릿 해제
    if (body.is_default === true) {
      await supabase
        .from('utm_templates')
        .update({ is_default: false })
        .eq('client_id', template.client_id)
        .eq('is_default', true)
        .neq('id', templateId)
    }
  }

  if (Object.keys(updateData).length === 0) {
    return apiError('수정할 내용이 없습니다.')
  }

  const { data, error } = await supabase
    .from('utm_templates')
    .update(updateData)
    .eq('id', templateId)
    .select()
    .single()

  if (error) {
    return apiError('템플릿 수정 실패: ' + error.message)
  }

  return apiSuccess({ template: data })
})

export const DELETE = withClientFilter(async (req: Request, { user, clientId }: ClientContext) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const idStr = pathParts[pathParts.length - 1]
  const templateId = parseId(idStr)

  if (!templateId) {
    return apiError('유효한 템플릿 ID가 필요합니다.')
  }

  const supabase = serverSupabase()

  // 템플릿 존재 및 권한 확인
  const { data: template, error: fetchError } = await supabase
    .from('utm_templates')
    .select('id, client_id')
    .eq('id', templateId)
    .single()

  if (fetchError || !template) {
    return apiError('템플릿을 찾을 수 없습니다.', 404)
  }

  // 권한 검증
  if (user.role !== 'superadmin' && template.client_id !== clientId) {
    return apiError('이 템플릿을 삭제할 권한이 없습니다.', 403)
  }

  await archiveBeforeDelete(supabase, 'utm_templates', templateId, user.id, template.client_id)
  const { error } = await supabase
    .from('utm_templates')
    .delete()
    .eq('id', templateId)

  if (error) {
    return apiError('템플릿 삭제 실패: ' + error.message)
  }

  return apiSuccess({ deleted: true })
})
