import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { archiveBeforeDelete, archiveBulkBeforeDelete } from '@/lib/archive'

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url)
  const parts = url.pathname.split('/')
  // /api/patients/[id] → [id]는 뒤에서 두 번째가 아니라 마지막
  return parseId(parts[parts.length - 1])
}

// 고객 삭제 (superadmin 전용) — 관련 데이터(leads, bookings, consultations, payments) 함께 삭제
export const DELETE = withSuperAdmin(async (req: Request, { user }) => {
  const customerId = getIdFromUrl(req)
  if (!customerId) return apiError('유효한 고객 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const { data: customer } = await supabase
    .from('customers')
    .select('id, clinic_id, name, phone_number')
    .eq('id', customerId)
    .single()
  if (!customer) return apiError('고객을 찾을 수 없습니다.', 404)

  // 삭제 전 스냅샷 보관
  const tables = ['leads', 'bookings', 'consultations', 'payments'] as const
  for (const table of tables) {
    await archiveBulkBeforeDelete(supabase, table, 'customer_id', customerId, user.id, customer.clinic_id)
  }
  await archiveBeforeDelete(supabase, 'customers', customerId, user.id, customer.clinic_id)

  // FK 의존 순서대로 삭제: leads → bookings → consultations → payments → customer
  for (const table of tables) {
    const { error: delErr } = await supabase.from(table).delete().eq('customer_id', customerId)
    if (delErr) return apiError(`${table} 삭제 실패: ${delErr.message}`, 500)
  }

  const { error } = await supabase.from('customers').delete().eq('id', customerId)
  if (error) return apiError(`고객 삭제 실패: ${error.message}`, 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: customer.clinic_id,
    action: 'customer_delete', targetTable: 'customers', targetId: customerId,
    detail: { name: customer.name, phone_number: customer.phone_number },
  })

  return apiSuccess({ deleted: true })
})
