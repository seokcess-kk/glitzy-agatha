import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { archiveBeforeDelete } from '@/lib/archive'

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url)
  return parseId(url.pathname.split('/').pop())
}

// 결제 삭제 (superadmin 전용)
export const DELETE = withSuperAdmin(async (req: Request, { user }) => {
  const paymentId = getIdFromUrl(req)
  if (!paymentId) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const { data: payment } = await supabase
    .from('payments')
    .select('id, clinic_id, customer_id')
    .eq('id', paymentId)
    .single()
  if (!payment) return apiError('결제를 찾을 수 없습니다.', 404)

  await archiveBeforeDelete(supabase, 'payments', paymentId, user.id, payment.clinic_id)
  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) return apiError(error.message, 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: payment.clinic_id,
    action: 'payment_delete', targetTable: 'payments', targetId: paymentId,
    detail: { customer_id: payment.customer_id },
  })

  return apiSuccess({ deleted: true })
})
