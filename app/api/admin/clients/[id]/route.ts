import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { isValidPhoneNumber } from '@/lib/security'

/**
 * 클라이언트 개별 수정 API (알림 설정 등)
 */
export const PATCH = withSuperAdmin(async (req: Request) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()

  if (!id || isNaN(Number(id))) return apiError('유효한 ID가 필요합니다.', 400)

  const body = await req.json()
  const updateData: Record<string, unknown> = {}

  // notify_phones 배열 처리 (최대 3개)
  if ('notify_phones' in body) {
    const phones: string[] = Array.isArray(body.notify_phones) ? body.notify_phones : []
    const filtered = phones.filter((p: string) => p && p.trim())

    if (filtered.length > 3) {
      return apiError('알림 연락처는 최대 3개까지 등록할 수 있습니다.', 400)
    }

    for (const phone of filtered) {
      if (!isValidPhoneNumber(phone)) {
        return apiError(`유효하지 않은 전화번호입니다: ${phone}`, 400)
      }
    }

    updateData.notify_phones = filtered
    // 주의: 운영 DB 에는 notify_phone(단수) / notify_enabled 컬럼이 없음 → 미사용
  }

  // 기존 단일 번호 입력 호환 — notify_phones 단일 원소로 변환
  if ('notify_phone' in body && !('notify_phones' in body)) {
    const single = body.notify_phone
    updateData.notify_phones = single ? [String(single)] : []
  }

  // notify_enabled 는 DB 미존재 — 비어있는 notify_phones 자체가 "비활성" 의미로 사용
  if ('is_active' in body) updateData.is_active = Boolean(body.is_active)
  if ('erp_client_id' in body) updateData.erp_client_id = body.erp_client_id != null ? String(body.erp_client_id) : null

  if (Object.keys(updateData).length === 0) return apiError('수정할 항목이 없습니다.', 400)

  const { error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', Number(id))

  if (error) return apiError(error.message, 500)

  return apiSuccess({ success: true })
})
