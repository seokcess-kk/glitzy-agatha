/**
 * UTM 링크 단일 API
 * DELETE: 링크 삭제
 */

import { withClientFilter, apiError, apiSuccess, ClientContext } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { parseId } from '@/lib/security'
import { archiveBeforeDelete } from '@/lib/archive'

export const DELETE = withClientFilter(async (req: Request, { user, clientId }: ClientContext) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const idStr = pathParts[pathParts.length - 1]
  const linkId = parseId(idStr)

  if (!linkId) {
    return apiError('유효한 링크 ID가 필요합니다.')
  }

  const supabase = serverSupabase()

  // 링크 존재 및 권한 확인
  const { data: link, error: fetchError } = await supabase
    .from('utm_links')
    .select('id, client_id')
    .eq('id', linkId)
    .single()

  if (fetchError || !link) {
    return apiError('링크를 찾을 수 없습니다.', 404)
  }

  // 권한 검증
  if (user.role !== 'superadmin' && link.client_id !== clientId) {
    return apiError('이 링크를 삭제할 권한이 없습니다.', 403)
  }

  await archiveBeforeDelete(supabase, 'utm_links', linkId, user.id, link.client_id)
  const { error } = await supabase
    .from('utm_links')
    .delete()
    .eq('id', linkId)

  if (error) {
    return apiError('링크 삭제 실패: ' + error.message)
  }

  return apiSuccess({ deleted: true })
})
