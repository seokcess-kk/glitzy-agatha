import { resyncPlatformCampaigns } from '@/lib/services/adSyncManager'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { sendErrorAlert } from '@/lib/error-alert'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CronSyncAdnResync')

export const maxDuration = 300

/**
 * ADN(Across) 캠페인 레벨 14일 rolling resync
 *
 * ADN 매체 전환(conv_cnt)도 후행 집계되어 과거 날짜 수치가 갱신될 수 있다.
 * 메인 cron(sync-ads)의 어제치 1회 동기화만으로는 반영되지 않으므로
 * 매일 최근 14일치 캠페인 통계를 재동기화한다.
 *
 * 스케줄: vercel.json — UTC 00:50 (KST 09:50), 메인 cron(KST 08:00) 이후 시차 실행
 */
export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401)
  }

  let results
  try {
    results = await resyncPlatformCampaigns('adn_ads', 14)
  } catch (err) {
    logger.error('resyncPlatformCampaigns(adn_ads) 치명적 오류', err)
    sendErrorAlert(
      'ad_sync_fail',
      `ADN 14일 resync 치명적 오류: ${err instanceof Error ? err.message : String(err)}`,
    ).catch(() => {})
    return apiError('ADN resync 실패', 500)
  }

  const failures = results.filter(r => r.error)
  if (failures.length > 0) {
    const failSummary = failures.map(f => `${f.clientName}: ${f.error}`).join(', ')
    sendErrorAlert(
      'ad_sync_fail',
      `ADN 14일 resync 실패 ${failures.length}건: ${failSummary}`,
    ).catch(() => {})
  }

  logger.info('ADN 14일 resync 완료', {
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
