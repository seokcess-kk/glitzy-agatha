// SQL to create press_coverage table in Supabase:
// CREATE TABLE press_coverage (
//   id bigserial primary key,
//   clinic_id int references clinics(id),
//   title text not null,
//   source text,
//   url text,
//   published_at timestamptz,
//   collected_at timestamptz default now(),
//   keyword_id int references press_keywords(id) on delete set null,
//   unique(clinic_id, url)
// );

import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req, { clinicId, assignedClinicIds }) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = supabase
    .from('press_coverage')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(500)

  // 날짜 필터
  if (from) query = query.gte('published_at', `${from}T00:00:00+09:00`)
  if (to) query = query.lte('published_at', `${to}T23:59:59+09:00`)

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data || [])
})
