import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, withAuth, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req, { clinicId, assignedClinicIds }) => {
  const url = new URL(req.url)
  const month = url.searchParams.get('month') // YYYY-MM
  const category = url.searchParams.get('category')

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return apiError('month 파라미터가 필요합니다. (YYYY-MM)', 400)
  }

  const startDate = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const lastDay = new Date(year, mon, 0).getDate()
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

  const supabase = serverSupabase()

  // 키워드 조회 (비활성 포함 — 순위 현황에서 과거 데이터 확인용)
  let kwQuery = supabase
    .from('monitoring_keywords')
    .select('id, keyword, category, clinic_id, is_active')

  const kwFiltered = applyClinicFilter(kwQuery, { clinicId, assignedClinicIds })
  if (kwFiltered === null) return apiSuccess({ keywords: [], rankings: [] })
  kwQuery = kwFiltered
  if (category) kwQuery = kwQuery.eq('category', category)

  const { data: keywords, error: kwError } = await kwQuery
  if (kwError) return apiError(kwError.message, 500)
  if (!keywords?.length) return apiSuccess({ keywords: [], rankings: [] })

  const keywordIds = keywords.map(k => k.id)

  // 순위 데이터 조회
  const { data: rankings, error: rankError } = await supabase
    .from('monitoring_rankings')
    .select('keyword_id, rank_date, rank_position, url')
    .in('keyword_id', keywordIds)
    .gte('rank_date', startDate)
    .lte('rank_date', endDate)
    .order('rank_date')

  if (rankError) return apiError(rankError.message, 500)

  return apiSuccess({ keywords, rankings })
})

export const POST = withAuth(async (req, { user }) => {
  const { keyword_id, rank_date, rank_position, url: rankUrl } = await req.json()

  if (!keyword_id || !rank_date) {
    return apiError('keyword_id와 rank_date는 필수입니다.', 400)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rank_date)) {
    return apiError('날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)', 400)
  }

  const supabase = serverSupabase()

  // 키워드 존재 확인 + 병원 접근 검증
  const { data: keyword } = await supabase
    .from('monitoring_keywords')
    .select('id, clinic_id')
    .eq('id', keyword_id)
    .single()

  if (!keyword) return apiError('키워드를 찾을 수 없습니다.', 404)

  // 역할별 병원 접근 검증
  if (user.role === 'agency_staff') {
    const { data: assignment } = await supabase
      .from('user_clinic_assignments')
      .select('id')
      .eq('user_id', parseInt(user.id, 10))
      .eq('clinic_id', keyword.clinic_id)
      .single()
    if (!assignment) return apiError('배정되지 않은 병원입니다.', 403)
  } else if (user.role === 'clinic_admin') {
    // clinic_admin: 자기 병원 키워드만 허용
    if (keyword.clinic_id !== Number(user.clinic_id)) {
      return apiError('자신의 병원 키워드만 수정 가능합니다.', 403)
    }
  } else if (user.role !== 'superadmin') {
    return apiError('순위 입력 권한이 없습니다.', 403)
  }

  const { data, error } = await supabase
    .from('monitoring_rankings')
    .upsert({
      keyword_id,
      rank_date,
      rank_position: rank_position ?? null,
      url: rankUrl || null,
      recorded_by: parseInt(user.id, 10),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'keyword_id,rank_date' })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
