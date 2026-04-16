import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'InstagramContent'
const logger = createLogger(SERVICE_NAME)

interface InstagramMedia {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'REEL' | 'CAROUSEL_ALBUM'
  media_url?: string
  thumbnail_url?: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

export async function syncInstagramContent(clinicId: number, accessToken: string, userId: string) {
  const supabase = serverSupabase()
  const today = getKstDateString()
  const startTime = Date.now()

  try {
    // Authorization 헤더 사용 (URL에 토큰 노출 방지)
    const url = `https://graph.facebook.com/v19.0/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=50`

    const { response } = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      service: SERVICE_NAME,
      timeout: 30000,
      retries: 3,
    })

    if (!response.ok) throw new Error('Instagram 미디어 조회 실패')

    const mediaData = await response.json()
    if (mediaData.error) throw new Error(mediaData.error.message)

    const mediaList: InstagramMedia[] = mediaData.data || []

    // 배치 처리 - 포스트
    const postRows = mediaList.map(media => {
      const isReel = media.media_type === 'REEL'
      const isVideo = media.media_type === 'VIDEO'
      const platform = isReel ? 'instagram_reels' : 'instagram_feed'
      const thumbnailUrl = media.thumbnail_url || (isVideo ? null : media.media_url)

      return {
        clinic_id: clinicId,
        platform,
        content_id: media.id,
        title: (media.caption || '').slice(0, 100) || `Instagram ${isReel ? '릴스' : '피드'}`,
        url: `https://www.instagram.com/p/${media.id}/`,
        thumbnail_url: thumbnailUrl,
        published_at: media.timestamp,
        is_api_synced: true,
      }
    })

    const { data: insertedPosts } = await supabase
      .from('content_posts')
      .upsert(postRows, { onConflict: 'clinic_id,platform,content_id' })
      .select('id, content_id')

    // 배치 처리 - 통계
    if (insertedPosts?.length) {
      const contentIdToPostId = new Map(insertedPosts.map(p => [p.content_id, p.id]))

      const statsRows = mediaList
        .filter(m => contentIdToPostId.has(m.id))
        .map(media => ({
          post_id: contentIdToPostId.get(media.id)!,
          stat_date: today,
          likes: media.like_count || 0,
          comments: media.comments_count || 0,
        }))

      if (statsRows.length > 0) {
        const { error } = await supabase
          .from('content_stats')
          .upsert(statsRows, { onConflict: 'post_id,stat_date' })

        if (error) {
          logger.error('Stats upsert error', error)
        }
      }
    }

    const count = insertedPosts?.length || 0
    const duration = Date.now() - startTime
    logger.info('Sync completed', { action: 'sync', clinicId, count, duration })

    return { platform: 'Instagram', count }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', clinicId, duration: Date.now() - startTime })
    return { platform: 'Instagram', count: 0, error: message }
  }
}
