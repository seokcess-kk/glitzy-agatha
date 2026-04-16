import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'YouTubeContent'
const logger = createLogger(SERVICE_NAME)

interface YouTubeVideo {
  id: string
  snippet: {
    title: string
    publishedAt: string
    thumbnails?: {
      medium?: { url: string }
    }
  }
  statistics: {
    viewCount?: string
    likeCount?: string
    commentCount?: string
  }
}

export async function syncYoutubeContent(clinicId: number, apiKey: string, channelId: string) {
  const supabase = serverSupabase()
  const today = getKstDateString()
  const startTime = Date.now()

  try {
    // 1. 채널의 업로드 재생목록 ID 조회
    const { response: channelRes } = await fetchWithRetry(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`,
      { service: SERVICE_NAME, timeout: 15000, retries: 2 }
    )
    if (!channelRes.ok) throw new Error('YouTube 채널 조회 실패')

    const channelData = await channelRes.json()
    if (!channelData.items?.length) throw new Error('채널을 찾을 수 없습니다.')
    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads

    // 2. 최근 업로드 영상 목록 (최대 50개)
    const { response: playlistRes } = await fetchWithRetry(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`,
      { service: SERVICE_NAME, timeout: 15000, retries: 2 }
    )
    if (!playlistRes.ok) throw new Error('YouTube 재생목록 조회 실패')

    const playlistData = await playlistRes.json()
    const videoIds = (playlistData.items || [])
      .map((item: { snippet: { resourceId: { videoId: string } } }) => item.snippet.resourceId.videoId)
      .join(',')

    if (!videoIds) {
      logger.info('No videos found', { action: 'sync', clinicId, count: 0, duration: Date.now() - startTime })
      return { platform: 'YouTube', count: 0 }
    }

    // 3. 영상별 통계 조회
    const { response: statsRes } = await fetchWithRetry(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`,
      { service: SERVICE_NAME, timeout: 15000, retries: 2 }
    )
    if (!statsRes.ok) throw new Error('YouTube 영상 통계 조회 실패')

    const statsData = await statsRes.json()
    const videos: YouTubeVideo[] = statsData.items || []

    // 배치 처리 - 포스트
    const postRows = videos.map(video => ({
      clinic_id: clinicId,
      platform: 'youtube',
      content_id: video.id,
      title: video.snippet.title,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnail_url: video.snippet.thumbnails?.medium?.url || null,
      published_at: video.snippet.publishedAt,
      is_api_synced: true,
    }))

    const { data: insertedPosts } = await supabase
      .from('content_posts')
      .upsert(postRows, { onConflict: 'clinic_id,platform,content_id' })
      .select('id, content_id')

    // 배치 처리 - 통계
    if (insertedPosts?.length) {
      const contentIdToPostId = new Map(insertedPosts.map(p => [p.content_id, p.id]))

      const statsRows = videos
        .filter(v => contentIdToPostId.has(v.id))
        .map(video => ({
          post_id: contentIdToPostId.get(video.id)!,
          stat_date: today,
          views: parseInt(video.statistics.viewCount || '0'),
          likes: parseInt(video.statistics.likeCount || '0'),
          comments: parseInt(video.statistics.commentCount || '0'),
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

    return { platform: 'YouTube', count }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', clinicId, duration: Date.now() - startTime })
    return { platform: 'YouTube', count: 0, error: message }
  }
}
