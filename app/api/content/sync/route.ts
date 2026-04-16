import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiSuccess } from '@/lib/api-middleware'
import { syncYoutubeContent } from '@/lib/services/youtubeContent'
import { syncInstagramContent } from '@/lib/services/instagramContent'

export const POST = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const { platform } = await req.json().catch(() => ({ platform: 'all' }))

  const supabase = serverSupabase()
  const results: Record<string, any> = {}

  // 클리닉별 API 설정 조회
  let youtubeConfig: any = null
  let instagramConfig: any = null

  if (clinicId) {
    const { data: configs } = await supabase
      .from('clinic_api_configs')
      .select('platform, config')
      .eq('clinic_id', clinicId)
      .in('platform', ['youtube_content', 'instagram_content'])

    for (const c of configs || []) {
      if (c.platform === 'youtube_content') youtubeConfig = c.config
      if (c.platform === 'instagram_content') instagramConfig = c.config
    }
  }

  // 환경변수 폴백
  if (!youtubeConfig && process.env.YOUTUBE_DATA_API_KEY && process.env.YOUTUBE_CHANNEL_ID) {
    youtubeConfig = { api_key: process.env.YOUTUBE_DATA_API_KEY, channel_id: process.env.YOUTUBE_CHANNEL_ID }
  }
  if (!instagramConfig && process.env.INSTAGRAM_CONTENT_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    instagramConfig = { access_token: process.env.INSTAGRAM_CONTENT_TOKEN, user_id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID }
  }

  // YouTube 동기화
  if ((platform === 'all' || platform === 'youtube') && youtubeConfig) {
    try {
      results.youtube = await syncYoutubeContent(
        clinicId || 0,
        youtubeConfig.api_key,
        youtubeConfig.channel_id
      )
    } catch (e: any) {
      results.youtube = { error: e.message }
    }
  }

  // Instagram 동기화
  if ((platform === 'all' || platform === 'instagram') && instagramConfig) {
    try {
      results.instagram = await syncInstagramContent(
        clinicId || 0,
        instagramConfig.access_token,
        instagramConfig.user_id
      )
    } catch (e: any) {
      results.instagram = { error: e.message }
    }
  }

  if (Object.keys(results).length === 0) {
    return apiSuccess({ message: 'API 키가 설정되지 않은 매체는 수기 입력을 이용해주세요.', results })
  }

  return apiSuccess({ success: true, results })
})
