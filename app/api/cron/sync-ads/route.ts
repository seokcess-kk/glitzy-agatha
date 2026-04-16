import { syncAllClients } from '@/lib/services/adSyncManager'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { sendErrorAlert } from '@/lib/error-alert'
import { detectAllClientAnomalies } from '@/lib/ads-anomaly'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CronSyncAds')

export const maxDuration = 300

// Vercel Cron이 매일 새벽 3시에 호출 (vercel.json 참고)
export async function GET(req: Request) {
  // Vercel Cron 인증 확인
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401)
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  let results
  try {
    results = await syncAllClients(yesterday)
  } catch (err) {
    logger.error('syncAllClients 치명적 오류', err)
    sendErrorAlert('ad_sync_fail', `광고 동기화 치명적 오류: ${err instanceof Error ? err.message : String(err)}`).catch(() => {})
    return apiError('동기화 실패', 500)
  }

  // 실패 건 집계
  const failures = results.filter(r => r.error)
  if (failures.length > 0) {
    const failSummary = failures
      .map(f => `${f.clientName}/${f.platform}: ${f.error}`)
      .join(', ')
    sendErrorAlert('ad_sync_fail', `광고 동기화 실패 ${failures.length}건: ${failSummary}`).catch(() => {})
  }

  // 동기화 성공 건이 있을 때만 이상치 감지 실행
  let anomalyCount = 0
  const hasAnySuccess = results.some(r => !r.error && r.count > 0)
  if (hasAnySuccess) {
    try {
      const supabase = serverSupabase()
      const { totalAnomalies, summaryMessage } = await detectAllClientAnomalies(supabase)
      anomalyCount = totalAnomalies
      if (totalAnomalies > 0) {
        sendErrorAlert('ads_anomaly', summaryMessage).catch(() => {})
      }
    } catch (err) {
      logger.error('이상치 감지 실행 실패', err, { action: 'detect_anomalies' })
    }
  }

  logger.info('광고 데이터 자동 수집 완료', {
    totalResults: results.length,
    successCount: results.filter(r => !r.error).length,
    failCount: failures.length,
    anomalyCount,
  })

  return apiSuccess({
    success: true,
    results: results.map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      platform: r.platform,
      count: r.count,
      error: r.error || null,
    })),
    anomalyCount,
  })
}
