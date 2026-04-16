import { serverSupabase } from '@/lib/supabase'
import { withAuth, apiError, apiSuccess } from '@/lib/api-middleware'

export const POST = withAuth(async (req, { user }) => {
  const { rankings } = await req.json()

  if (!Array.isArray(rankings) || rankings.length === 0) {
    return apiError('rankings 배열이 필요합니다.', 400)
  }

  if (rankings.length > 200) {
    return apiError('한 번에 최대 200개까지 입력 가능합니다.', 400)
  }

  // rank_date 형식 검증
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  for (const r of rankings) {
    if (!r.keyword_id || !r.rank_date) {
      return apiError('각 항목에 keyword_id와 rank_date가 필요합니다.', 400)
    }
    if (!datePattern.test(r.rank_date)) {
      return apiError(`날짜 형식이 올바르지 않습니다: ${r.rank_date} (YYYY-MM-DD)`, 400)
    }
  }

  const supabase = serverSupabase()
  const userId = parseInt(user.id, 10)

  // 키워드 ID 수집 → 병원 접근 검증
  const keywordIds = [...new Set(rankings.map((r: any) => r.keyword_id))]
  const { data: keywords } = await supabase
    .from('monitoring_keywords')
    .select('id, clinic_id')
    .in('id', keywordIds)

  if (!keywords?.length) return apiError('유효한 키워드가 없습니다.', 400)

  // 역할별 병원 접근 검증
  if (user.role === 'agency_staff') {
    const { data: assignments } = await supabase
      .from('user_clinic_assignments')
      .select('clinic_id')
      .eq('user_id', userId)
    const assignedIds = new Set((assignments || []).map((a: any) => a.clinic_id))

    const clinicIds = new Set(keywords.map(k => k.clinic_id))
    for (const cid of clinicIds) {
      if (!assignedIds.has(cid)) return apiError('배정되지 않은 병원의 키워드가 포함되어 있습니다.', 403)
    }
  } else if (user.role === 'clinic_admin') {
    // clinic_admin: 자기 병원 키워드만 허용
    const clinicIds = new Set(keywords.map(k => k.clinic_id))
    if (clinicIds.size !== 1 || !clinicIds.has(Number(user.clinic_id))) {
      return apiError('자신의 병원 키워드만 수정 가능합니다.', 403)
    }
  } else if (user.role !== 'superadmin') {
    return apiError('순위 입력 권한이 없습니다.', 403)
  }

  const validKeywordIds = new Set(keywords.map(k => k.id))
  const now = new Date().toISOString()

  const rows = rankings
    .filter((r: any) => validKeywordIds.has(r.keyword_id))
    .map((r: any) => ({
      keyword_id: r.keyword_id,
      rank_date: r.rank_date,
      rank_position: r.rank_position ?? null,
      url: r.url || null,
      recorded_by: userId,
      updated_at: now,
    }))

  const { data, error } = await supabase
    .from('monitoring_rankings')
    .upsert(rows, { onConflict: 'keyword_id,rank_date' })
    .select()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ count: data?.length || 0 })
})
