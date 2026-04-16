import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'
import { buildUtmUrl } from '@/lib/utm'
import { createLogger } from '@/lib/logger'
import { archiveBeforeDelete } from '@/lib/archive'
import { creativeToApiPlatform } from '@/lib/platform'

const logger = createLogger('AdCreatives')

function getCreativeIdFromUrl(req: Request): number | null {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const idStr = pathParts[pathParts.length - 1]
  return parseId(idStr)
}

export const GET = withSuperAdmin(async (req: Request) => {
  const creativeId = getCreativeIdFromUrl(req)
  if (creativeId === null) {
    return apiError('유효하지 않은 ID입니다.', 400)
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('ad_creatives')
    .select(`
      *,
      client:clients(id, name),
      landing_page:landing_pages(id, name, file_name)
    `)
    .eq('id', creativeId)
    .single()

  if (error || !data) {
    return apiError('광고 소재를 찾을 수 없습니다.', 404)
  }

  return apiSuccess(data)
})

export const PUT = withSuperAdmin(async (req: Request) => {
  const creativeId = getCreativeIdFromUrl(req)
  if (creativeId === null) {
    return apiError('유효하지 않은 ID입니다.', 400)
  }

  const body = await req.json()
  const {
    name, description, utm_content, utm_source, utm_medium, utm_campaign, utm_term,
    platform, client_id, landing_page_id, is_active, file_name, file_type
  } = body

  const supabase = serverSupabase()

  // 기존 데이터 확인
  const { data: existing } = await supabase
    .from('ad_creatives')
    .select('id, client_id')
    .eq('id', creativeId)
    .single()

  if (!existing) {
    return apiError('광고 소재를 찾을 수 없습니다.', 404)
  }

  // client_id 변경 시 유효성 검증
  let validClientId: number | undefined = undefined
  if (client_id !== undefined) {
    validClientId = parseId(client_id) ?? undefined
    if (validClientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('id', validClientId)
        .single()

      if (!client) {
        return apiError('존재하지 않는 클라이언트입니다.', 400)
      }
    }
  }

  // landing_page_id 유효성 검증
  let validLandingPageId: number | null | undefined = undefined
  if (landing_page_id !== undefined) {
    if (landing_page_id === null || landing_page_id === '') {
      validLandingPageId = null
    } else {
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
  }

  // utm_content 중복 검사 (변경 시, 같은 클라이언트 내, 자기 자신 제외)
  if (utm_content) {
    const checkClientId = validClientId ?? existing.client_id
    const { data: duplicate } = await supabase
      .from('ad_creatives')
      .select('id')
      .eq('client_id', checkClientId)
      .eq('utm_content', utm_content)
      .neq('id', creativeId)
      .maybeSingle()

    if (duplicate) {
      return apiError('이미 동일한 UTM Content 값이 존재합니다.', 400)
    }
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (name !== undefined) updateData.name = sanitizeString(name, 100)
  if (description !== undefined) updateData.description = description ? sanitizeString(description, 500) : null
  if (utm_content !== undefined) updateData.utm_content = sanitizeString(utm_content, 100)
  if (utm_source !== undefined) updateData.utm_source = utm_source ? sanitizeString(utm_source, 100) : null
  if (utm_medium !== undefined) updateData.utm_medium = utm_medium ? sanitizeString(utm_medium, 100) : null
  if (utm_campaign !== undefined) updateData.utm_campaign = utm_campaign ? sanitizeString(utm_campaign, 100) : null
  if (utm_term !== undefined) updateData.utm_term = utm_term ? sanitizeString(utm_term, 100) : null
  if (platform !== undefined) updateData.platform = platform ? (creativeToApiPlatform(platform) || sanitizeString(platform, 50)) : null
  if (validClientId !== undefined) updateData.client_id = validClientId
  if (validLandingPageId !== undefined) updateData.landing_page_id = validLandingPageId
  if (is_active !== undefined) updateData.is_active = is_active
  if (file_name !== undefined) updateData.file_name = file_name ? sanitizeString(String(file_name).replace(/[/\\:*?"<>|]/g, ''), 200) : null
  if (file_type !== undefined) updateData.file_type = file_type ? sanitizeString(file_type as string, 50) : null

  const { data, error } = await supabase
    .from('ad_creatives')
    .update(updateData)
    .eq('id', creativeId)
    .select(`
      *,
      client:clients(id, name),
      landing_page:landing_pages(id, name, file_name)
    `)
    .single()

  if (error) return apiError(error.message, 500)

  // utm_links 자동 업데이트 (실패해도 메인 응답에 영향 없음)
  try {
    if (data && data.landing_page_id) {
      const baseUrl = `${process.env.NEXTAUTH_URL || 'https://localhost:3000'}/lp?id=${data.landing_page_id}`
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
          .eq('client_id', data.client_id)
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
              client_id: data.client_id,
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
    logger.warn('utm_links 자동 업데이트 실패', { creativeId: data?.id, error: e })
  }

  return apiSuccess(data)
})

export const DELETE = withSuperAdmin(async (req: Request, { user }) => {
  const creativeId = getCreativeIdFromUrl(req)
  if (creativeId === null) {
    return apiError('유효하지 않은 ID입니다.', 400)
  }

  const supabase = serverSupabase()

  // 존재 여부 확인
  const { data: existing } = await supabase
    .from('ad_creatives')
    .select('id')
    .eq('id', creativeId)
    .single()

  if (!existing) {
    return apiError('광고 소재를 찾을 수 없습니다.', 404)
  }

  await archiveBeforeDelete(supabase, 'ad_creatives', creativeId, user.id)
  const { error } = await supabase
    .from('ad_creatives')
    .delete()
    .eq('id', creativeId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ deleted: true })
})
