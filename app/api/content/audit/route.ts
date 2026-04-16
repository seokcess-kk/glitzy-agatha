// SQL to create content_audits table in Supabase:
// CREATE TABLE content_audits (
//   id bigserial primary key,
//   clinic_id int references clinics(id),
//   post_id bigint references content_posts(id) on delete cascade,
//   risk_score int default 0,
//   risk_level text default 'safe',   -- safe | caution | danger
//   findings jsonb default '[]',
//   summary text,
//   analyzed_at timestamptz default now(),
//   unique(post_id)
// );

import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { checkClinicAccess, parseId } from '@/lib/security'

// GET /api/content/audit  — list posts with their latest audit
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()

  // 텍스트 기반 콘텐츠만 분석 대상: 네이버 블로그, 인스타그램 피드 (reels 제외)
  let query = supabase
    .from('content_posts')
    .select('*, audit:content_audits(risk_score, risk_level, findings, summary, analyzed_at)')
    .in('platform', ['Naver', 'Instagram'])
    .not('utm_campaign', 'like', '%reels%')
    .order('published_at', { ascending: false })
    .limit(100)

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  // Flatten latest audit
  const posts = (data || []).map((p: any) => {
    const audits = Array.isArray(p.audit) ? p.audit : []
    const latest = audits[audits.length - 1] || null
    return { ...p, audit: latest }
  })

  return apiSuccess(posts)
})

// POST /api/content/audit  — analyze a single post
export const POST = withClinicFilter(async (req: Request, { user }: ClinicContext) => {
  const { post_id } = await req.json()

  const postId = parseId(post_id)
  if (!postId) return apiError('유효한 post_id가 필요합니다.')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return apiError('ANTHROPIC_API_KEY not set', 500)

  const supabase = serverSupabase()

  // Fetch post details
  const { data: post, error: postError } = await supabase
    .from('content_posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (postError || !post) return apiError('포스트를 찾을 수 없습니다.', 404)

  // 리소스 소유권 검증
  if (!checkClinicAccess(post.clinic_id, user)) {
    return apiError('해당 포스트에 대한 권한이 없습니다.', 403)
  }

  const prompt = `당신은 한국 의료광고법 전문가입니다. 다음 의료 마케팅 콘텐츠를 분석해주세요.

플랫폼: ${post.platform}
콘텐츠 제목: ${post.post_title}
UTM 캠페인: ${post.utm_campaign || '없음'}
URL: ${post.post_url || '없음'}

다음 6가지 항목을 체크하고 JSON으로만 응답하세요 (다른 텍스트 없이):
1. 효과 과장 - 치료 효과나 결과를 과도하게 주장
2. 전후 사진 - before/after 사진 비교 언급
3. 체험담/후기 - 특정인의 경험담이나 후기 인용
4. 비교 광고 - 타 병원 또는 의사와 비교
5. 미인증 기술 - 검증되지 않은 시술이나 기기 언급
6. 가격 과대광고 - 비현실적인 할인가나 최저가 주장

응답 JSON 형식:
{
  "risk_score": 0에서 100사이의 숫자,
  "risk_level": "safe" 또는 "caution" 또는 "danger",
  "findings": [
    { "category": "항목명", "detected": true 또는 false, "detail": "근거 설명" }
  ],
  "summary": "전체 요약 한 줄"
}`

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return apiError(`AI 분석 실패: ${err}`, 500)
    }

    const aiData = await aiRes.json()
    const text = aiData.content?.[0]?.text || '{}'
    let parsed: any = {}
    try { parsed = JSON.parse(text) } catch { parsed = { risk_score: 0, risk_level: 'safe', findings: [], summary: '분석 실패' } }

    // Upsert to content_audits
    const { data: audit, error: auditError } = await supabase
      .from('content_audits')
      .upsert({
        clinic_id:   post.clinic_id,
        post_id: postId,
        risk_score:  parsed.risk_score  ?? 0,
        risk_level:  parsed.risk_level  ?? 'safe',
        findings:    parsed.findings    ?? [],
        summary:     parsed.summary     ?? '',
        analyzed_at: new Date().toISOString(),
      }, { onConflict: 'post_id' })
      .select()
      .single()

    if (auditError) return apiError(auditError.message, 500)
    return apiSuccess(audit)

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return apiError(message, 500)
  }
})
