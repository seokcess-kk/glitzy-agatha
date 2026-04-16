import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'
import { buildUtmUrl } from '@/lib/utm'
import { createLogger } from '@/lib/logger'
import { creativeToApiPlatform } from '@/lib/platform'

const logger = createLogger('AdCreatives')

export const GET = withSuperAdmin(async (req: Request) => {
  try {
    const url = new URL(req.url)
    const clientId = url.searchParams.get('client_id')
    const landingPageId = url.searchParams.get('landing_page_id')
    const activeOnly = url.searchParams.get('active') === 'true'

    const supabase = serverSupabase()
    let query = supabase
      .from('ad_creatives')
      .select(`
        *,
        client:clients(id, name),
        landing_page:landing_pages(id, name, file_name)
      `)
      .order('created_at', { ascending: false })

    if (clientId) {
      const parsedClientId = parseId(clientId)
      if (parsedClientId) query = query.eq('client_id', parsedClientId)
    }

    if (landingPageId) {
      const parsedLpId = parseId(landingPageId)
      if (parsedLpId) query = query.eq('landing_page_id', parsedLpId)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (err) {
    logger.error('광고 소재 목록 조회 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

export const POST = withSuperAdmin(async (req: Request) => {
  try {
  const body = await req.json()
  const {
    name, description, utm_content, utm_source, utm_medium, utm_campaign, utm_term,
    platform, client_id, landing_page_id, is_active, file_name, file_type
  } = body

  if (!name || !utm_content) {
    return apiError('소재명과 UTM Content 값은 필수입니다.', 400)
  }

  if (!client_id) {
    return apiError('클라이언트을 선택해주세요.', 400)
  }

  const supabase = serverSupabase()

  // client_id 유효성 검증
  const validClientId = parseId(client_id)
  if (validClientId === null) {
    return apiError('유효하지 않은 클라이언트 ID입니다.', 400)
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', validClientId)
    .single()

  if (!client) {
    return apiError('존재하지 않는 클라이언트입니다.', 400)
  }

  // landing_page_id 유효성 검증 (선택적)
  let validLandingPageId: number | null = null
  if (landing_page_id) {
    validLandingPageId = parseId(landing_page_id)
    if (validLandingPageId) {
      const { data: lp } = await supabase
        .from('landing_pages')
        .select('id')
        .eq('id', validLandingPageId)
        .single()

      if (!lp) {
        return apiError('존재하지 않는 랜딩 페이지입니다.', 400)
      }
    }
  }

  // utm_content 중복 검사 (같은 클라이언트 내)
  const { data: existing } = await supabase
    .from('ad_creatives')
    .select('id')
    .eq('client_id', validClientId)
    .eq('utm_content', utm_content)
    .maybeSingle()

  if (existing) {
    return apiError('이미 동일한 UTM Content 값이 존재합니다.', 400)
  }

  const { data, error } = await supabase
    .from('ad_creatives')
    .insert({
      name: sanitizeString(name, 100),
      description: description ? sanitizeString(description, 500) : null,
      utm_content: sanitizeString(utm_content, 100),
      utm_source: utm_source ? sanitizeString(utm_source, 100) : null,
      utm_medium: utm_medium ? sanitizeString(utm_medium, 100) : null,
      utm_campaign: utm_campaign ? sanitizeString(utm_campaign, 100) : null,
      utm_term: utm_term ? sanitizeString(utm_term, 100) : null,
      platform: platform ? (creativeToApiPlatform(platform) || sanitizeString(platform, 50)) : null,
      client_id: validClientId,
      landing_page_id: validLandingPageId,
      is_active: is_active !== false,
      file_name: file_name ? sanitizeString(String(file_name).replace(/[/\\:*?"<>|]/g, ''), 200) : null,
      file_type: file_type ? sanitizeString(file_type, 50) : null,
    })
    .select(`
      *,
      client:clients(id, name),
      landing_page:landing_pages(id, name, file_name)
    `)
    .single()

  if (error) return apiError(error.message, 500)

  // utm_links 자동 생성 (실패해도 메인 응답에 영향 없음)
  try {
    if (validLandingPageId && data) {
      const baseUrl = `${process.env.NEXTAUTH_URL || 'https://localhost:3000'}/lp?id=${validLandingPageId}`
      const generatedUrl = buildUtmUrl({
        baseUrl,
        source: data.utm_source || undefined,
        medium: data.utm_medium || undefined,
        campaign: data.utm_campaign || undefined,
        content: data.utm_content || undefined,
        term: data.utm_term || undefined,
      })

      if (generatedUrl) {
        const { data: existingLink } = await supabase
          .from('utm_links')
          .select('id')
          .eq('client_id', validClientId)
          .eq('utm_content', data.utm_content)
          .maybeSingle()

        if (existingLink) {
          await supabase
            .from('utm_links')
            .update({
              original_url: generatedUrl,
              utm_source: data.utm_source,
              utm_medium: data.utm_medium,
              utm_campaign: data.utm_campaign,
              utm_term: data.utm_term,
              label: data.name,
            })
            .eq('id', existingLink.id)
        } else {
          await supabase
            .from('utm_links')
            .insert({
              client_id: validClientId,
              original_url: generatedUrl,
              utm_source: data.utm_source,
              utm_medium: data.utm_medium,
              utm_campaign: data.utm_campaign,
              utm_content: data.utm_content,
              utm_term: data.utm_term,
              label: data.name,
            })
        }
      }
    }
  } catch (e) {
    logger.warn('utm_links 자동 생성 실패', { creativeId: data?.id, error: e })
  }

  return apiSuccess(data)
  } catch (err) {
    logger.error('광고 소재 생성 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
