import { resyncPlatformCampaigns } from '@/lib/services/adSyncManager'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { sendErrorAlert } from '@/lib/error-alert'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CronSyncMetaResync')

export const maxDuration = 300

/**
 * Meta 캠페인 레벨 14일 rolling resync
 *
 * Meta 전환은 어트리뷰션 윈도우 내 후행 전환이 소급 집계되므로,
 * 메인 cron(sync-ads)의 어제치 1회 동기화만으로는 과거 날짜 전환수가
 * 갱신되지 않는다. 매일 최근 14일치 캠페인 통계를 재동기화한다.
 *
 * 스케줄: vercel.json — UTC 00:15 (KST 09:15), 메인 cron(KST 08:00) 이후 시차 실행
 */
export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401)
  }

  let results
  try {
    results = await resyncPlatformCampaigns('meta_ads', 14)
  } catch (err) {
    logger.error('resyncPlatformCampaigns(meta_ads) 치명적 오류', err)
    sendErrorAlert(
      'ad_sync_fail',
      `Meta 14일 resync 치명적 오류: ${err instanceof Error ? err.message : String(err)}`,
    ).catch(() => {})
    return apiError('Meta resync 실패', 500)
  }

  const failures = results.filter(r => r.error)
  if (failures.length > 0) {
    const failSummary = failures.map(f => `${f.clientName}: ${f.error}`).join(', ')
    sendErrorAlert(
      'ad_sync_fail',
      `Meta 14일 resync 실패 ${failures.length}건: ${failSummary}`,
    ).catch(() => {})
  }

  logger.info('Meta 14일 resync 완료', {
    totalResults: results.length,
    successCount: results.filter(r => !r.error).length,
    failCount: failures.length,
  })

  return apiSuccess({
    success: true,
    daysBack: 14,
    results: results.map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      platform: r.platform,
      count: r.count,
      error: r.error || null,
    })),
  })
}
