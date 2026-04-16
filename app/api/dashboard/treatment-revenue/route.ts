import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('TreatmentRevenue')

export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  try {
    if (user.role === 'demo_viewer') {
      const { demoTreatmentRevenue } = await import('@/lib/demo/fixtures/aggregates')
      const url = new URL(req.url)
      return apiSuccess(demoTreatmentRevenue(clinicId, url.searchParams.get('startDate'), url.searchParams.get('endDate')))
    }

    if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
      return apiSuccess([])
    }

    const supabase = serverSupabase()
    const url = new URL(req.url)
    const startParam = url.searchParams.get('startDate')
    const endParam = url.searchParams.get('endDate')

    if (!startParam || !endParam) {
      return apiError('startDate, endDate는 필수입니다.', 400)
    }

    // KPI와 동일한 기간 기준: payment_date (DATE 컬럼) gte/lte
    const statStart = getKstDateString(new Date(startParam))
    const statEnd = getKstDateString(new Date(endParam))

    const query = supabase
      .from('payments')
      .select('treatment_name, payment_amount')
      .gte('payment_date', statStart)
      .lte('payment_date', statEnd)

    const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
    if (!filtered) return apiSuccess([])

    const { data, error } = await filtered

    if (error) {
      logger.error('시술별 매출 조회 실패', error, { clinicId })
      return apiError('서버 오류가 발생했습니다.', 500)
    }

    // treatment_name별 합산
    const treatmentMap: Record<string, number> = {}
    for (const p of data || []) {
      if (p.treatment_name && p.payment_amount) {
        treatmentMap[p.treatment_name] = (treatmentMap[p.treatment_name] || 0) + Number(p.payment_amount)
      }
    }

    const result = Object.entries(treatmentMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    return apiSuccess(result)
  } catch (err) {
    logger.error('시술별 매출 조회 실패', err, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
