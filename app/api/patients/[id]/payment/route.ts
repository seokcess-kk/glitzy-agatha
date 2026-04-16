import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import {
  getSessionUser,
  canAccessCustomer,
  isValidPaymentAmount,
  isValidDate,
  sanitizeString,
  parseId,
} from '@/lib/security'
import { logActivity } from '@/lib/activity-log'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return apiError('Unauthorized', 401)
  if (user.role === 'demo_viewer') return apiError('demo mode: read-only', 405)

  const customerId = parseId(params.id)
  if (!customerId) {
    return apiError('유효한 고객 ID가 필요합니다.', 400)
  }

  // 권한 검증: 해당 고객의 clinic_id에 접근 가능한지 확인
  const accessCheck = await canAccessCustomer(customerId, user)
  if (!accessCheck.allowed) {
    return apiError(accessCheck.error || '권한이 없습니다.', 403)
  }

  const { treatmentName, paymentAmount, paymentDate } = await req.json()

  // 필수값 검증
  if (!treatmentName || typeof treatmentName !== 'string' || treatmentName.trim() === '') {
    return apiError('시술명은 필수입니다.', 400)
  }

  const amount = Number(paymentAmount)
  if (!paymentAmount || !isValidPaymentAmount(amount)) {
    return apiError('유효한 결제 금액이 필요합니다. (1원 ~ 1억원)', 400)
  }

  // 날짜 형식 검증
  let parsedDate: string | null = null
  if (paymentDate) {
    if (!isValidDate(paymentDate)) {
      return apiError('유효하지 않은 날짜 형식입니다.', 400)
    }
    parsedDate = new Date(paymentDate).toISOString()
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('payments')
    .insert({
      customer_id: customerId,
      clinic_id: accessCheck.clinicId,
      treatment_name: sanitizeString(treatmentName, 200),
      payment_amount: amount,
      payment_date: parsedDate || new Date().toISOString(),
      created_by: Number(user.id),
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: accessCheck.clinicId,
    action: 'payment_create', targetTable: 'payments', targetId: data.id,
    detail: { customer_id: customerId, amount, treatment: treatmentName },
  })

  return apiSuccess(data)
}
