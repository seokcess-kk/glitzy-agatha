import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { canAccessContentPost, parseId } from '@/lib/security'
import { archiveBeforeDelete } from '@/lib/archive'
import { getKstDateString } from '@/lib/date'

// 콘텐츠 목록 조회 (최신 통계 포함)
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const platform = url.searchParams.get('platform')

  let query = supabase
    .from('content_posts')
    .select('*, stats:content_stats(views, likes, comments, shares, saves, reach, impressions, stat_date)')
    .order('published_at', { ascending: false })

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered
  if (platform && platform !== 'all') query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

// 수기 콘텐츠 추가
export const POST = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()
  const body = await req.json()

  const { title, url, platform, published_at, thumbnail_url,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    views, likes, comments, shares, saves } = body

  if (!title || !platform) return apiError('제목과 플랫폼을 입력해주세요.')

  const { data: post, error: postErr } = await supabase
    .from('content_posts')
    .insert({
      clinic_id: clinicId,
      platform,
      title,
      url,
      thumbnail_url,
      published_at: published_at || null,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      is_api_synced: false,
    })
    .select()
    .single()

  if (postErr) return apiError(postErr.message, 500)

  // 초기 통계 입력
  if (views || likes || comments || shares || saves) {
    const today = getKstDateString()
    await supabase.from('content_stats').insert({
      post_id: post.id,
      stat_date: today,
      views: views || 0,
      likes: likes || 0,
      comments: comments || 0,
      shares: shares || 0,
      saves: saves || 0,
    })
  }

  return apiSuccess(post)
})

// 통계 수기 업데이트
export const PUT = withClinicFilter(async (req: Request, { user }: ClinicContext) => {
  const supabase = serverSupabase()
  const { post_id, stat_date, views, likes, comments, shares, saves } = await req.json()

  const postId = parseId(post_id)
  if (!postId) return apiError('유효한 post_id가 필요합니다.')

  // 리소스 소유권 검증
  const accessCheck = await canAccessContentPost(postId, user)
  if (!accessCheck.allowed) {
    return apiError(accessCheck.error || '권한이 없습니다.', 403)
  }

  const date = stat_date || getKstDateString()

  const { data, error } = await supabase
    .from('content_stats')
    .upsert({ post_id: postId, stat_date: date, views: views || 0, likes: likes || 0, comments: comments || 0, shares: shares || 0, saves: saves || 0 },
      { onConflict: 'post_id,stat_date' })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

// 예산 업데이트 (budget 필드만)
export const PATCH = withClinicFilter(async (req: Request, { user }: ClinicContext) => {
  const supabase = serverSupabase()
  const { id, budget } = await req.json()

  const postId = parseId(id)
  if (!postId) return apiError('유효한 id가 필요합니다.')

  // 리소스 소유권 검증
  const accessCheck = await canAccessContentPost(postId, user)
  if (!accessCheck.allowed) {
    return apiError(accessCheck.error || '권한이 없습니다.', 403)
  }

  const { data, error } = await supabase
    .from('content_posts')
    .update({ budget: budget ?? 0 })
    .eq('id', postId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

// 콘텐츠 삭제
export const DELETE = withClinicFilter(async (req: Request, { user }: ClinicContext) => {
  const supabase = serverSupabase()
  const { id } = await req.json()

  const postId = parseId(id)
  if (!postId) return apiError('유효한 id가 필요합니다.')

  // 리소스 소유권 검증
  const accessCheck = await canAccessContentPost(postId, user)
  if (!accessCheck.allowed) {
    return apiError(accessCheck.error || '권한이 없습니다.', 403)
  }

  await archiveBeforeDelete(supabase, 'content_posts', postId, user.id)
  const { error } = await supabase.from('content_posts').delete().eq('id', postId)
  if (error) return apiError(error.message, 500)
  return apiSuccess({ success: true })
})
