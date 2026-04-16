import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, withClinicAdmin, ClinicContext, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'

/**
 * 병원별 시술 메뉴 카탈로그 API
 * GET: 시술 목록 조회 (clinic_id 필터)
 * POST: 시술 추가 (clinic_admin 이상)
 * PATCH: 시술 수정 (clinic_admin 이상)
 * DELETE: 시술 삭제 (clinic_admin 이상)
 */

export const GET = withClinicFilter(async (req: Request, { user, clinicId }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoClinicTreatments } = await import('@/lib/demo/fixtures/extras')
    return apiSuccess(demoClinicTreatments(clinicId))
  }

  if (!clinicId) return apiSuccess([])

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const activeOnly = url.searchParams.get('active_only') !== 'false'

  let query = supabase
    .from('clinic_treatments')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  return apiSuccess(data || [])
})

export const POST = withClinicAdmin(async (req: Request, { clinicId }: ClinicContext) => {
  if (!clinicId) return apiError('병원을 선택해주세요.', 400)

  const { name, category, default_price, sort_order } = await req.json()

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return apiError('시술명은 필수입니다.', 400)
  }

  const price = Number(default_price)
  if (isNaN(price) || price < 0 || price > 100_000_000) {
    return apiError('유효한 금액을 입력하세요. (0원 ~ 1억원)', 400)
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clinic_treatments')
    .insert({
      clinic_id: clinicId,
      name: sanitizeString(name, 200),
      category: category ? sanitizeString(category, 100) : null,
      default_price: price,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return apiError('이미 등록된 시술명입니다.', 409)
    return apiError(error.message, 500)
  }

  return apiSuccess(data)
})

export const PATCH = withClinicAdmin(async (req: Request, { clinicId }: ClinicContext) => {
  if (!clinicId) return apiError('병원을 선택해주세요.', 400)

  const { id, name, category, default_price, is_active, sort_order } = await req.json()

  const treatmentId = parseId(id)
  if (!treatmentId) return apiError('유효한 ID가 필요합니다.', 400)

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') return apiError('시술명은 필수입니다.', 400)
    updates.name = sanitizeString(name, 200)
  }
  if (category !== undefined) updates.category = category ? sanitizeString(category, 100) : null
  if (default_price !== undefined) {
    const price = Number(default_price)
    if (isNaN(price) || price < 0 || price > 100_000_000) return apiError('유효한 금액을 입력하세요.', 400)
    updates.default_price = price
  }
  if (is_active !== undefined) updates.is_active = Boolean(is_active)
  if (sort_order !== undefined) updates.sort_order = Number(sort_order) || 0

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clinic_treatments')
    .update(updates)
    .eq('id', treatmentId)
    .eq('clinic_id', clinicId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return apiError('이미 등록된 시술명입니다.', 409)
    return apiError(error.message, 500)
  }
  if (!data) return apiError('시술 항목을 찾을 수 없습니다.', 404)

  return apiSuccess(data)
})

export const DELETE = withClinicAdmin(async (req: Request, { clinicId }: ClinicContext) => {
  if (!clinicId) return apiError('병원을 선택해주세요.', 400)

  const url = new URL(req.url)
  const treatmentId = parseId(url.searchParams.get('id'))
  if (!treatmentId) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()
  const { error } = await supabase
    .from('clinic_treatments')
    .delete()
    .eq('id', treatmentId)
    .eq('clinic_id', clinicId)

  if (error) return apiError(error.message, 500)

  return apiSuccess({ deleted: true })
})
