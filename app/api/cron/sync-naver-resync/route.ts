import { resyncPlatformCampaigns } from '@/lib/services/adSyncManager'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { sendErrorAlert } from '@/lib/error-alert'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CronSyncNaverResync')

export const maxDuration = 300

/**
 * 네이버 SA 캠페인 레벨 21일 rolling resync
 *
 * 네이버 전환추적(convCnt)은 전환추적기간 내 후행 전환이 반영되어
 * 과거 날짜 수치가 시간이 지나서 증가할 수 있다. 메인 cron(sync-ads)은
 * 어제 하루만 동기화하므로 별도로 최근 21일치를 매일 재동기화한다.
 *
 * 스케줄: vercel.json — UTC 00:00 (KST 09:00), 메인 cron(KST 08:00) 이후
 */
export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401)
  }

  let results
  try {
    results = await resyncPlatformCampaigns('naver_ads', 21)
  } catch (err) {
    logger.error('resyncPlatformCampaigns(naver_ads) 치명적 오류', err)
    sendErrorAlert(
      'ad_sync_fail',
      `네이버 21일 resync 치명적 오류: ${err instanceof Error ? err.message : String(err)}`,
    ).catch(() => {})
    return apiError('네이버 resync 실패', 500)
  }

  const failures = results.filter(r => r.error)
  if (failures.length > 0) {
    const failSummary = failures
      .map(f => `${f.clientName}: ${f.error}`)
      .join(', ')
    sendErrorAlert(
      'ad_sync_fail',
      `네이버 21일 resync 실패 ${failures.length}건: ${failSummary}`,
    ).catch(() => {})
  }

  logger.info('네이버 21일 resync 완료', {
    totalResults: results.length,
    successCount: results.filter(r => !r.error).length,
    failCount: failures.length,
  })

  return apiSuccess({
    success: true,
    daysBack: 21,
    results: results.map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      platform: r.platform,
      count: r.count,
      error: r.error || null,
    })),
  })
}
