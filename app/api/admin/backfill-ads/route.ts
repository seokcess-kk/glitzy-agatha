import { syncClinic } from '@/lib/services/adSyncManager'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const logger = createLogger('BackfillAds')

export const maxDuration = 300

/**
 * 광고 데이터 backfill API (관리자 전용)
 *
 * 사용법:
 *   curl -X POST http://localhost:3000/api/admin/backfill-ads \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"clinicId": 1, "startDate": "2026-03-01", "endDate": "2026-03-25"}'
 */
export async function POST(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('유효한 JSON body가 필요합니다.', 400)
  }

  const clinicId = typeof body.clinicId === 'number' ? body.clinicId : Number(body.clinicId)
  const startDate = typeof body.startDate === 'string' ? body.startDate : ''
  const endDate = typeof body.endDate === 'string' ? body.endDate : ''

  if (!clinicId || isNaN(clinicId) || !startDate || !endDate) {
    return apiError('clinicId(숫자), startDate, endDate 필수', 400)
  }

  // YYYY-MM-DD 형식 검증
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return apiError('날짜 형식: YYYY-MM-DD', 400)
  }

  const start = new Date(startDate + 'T00:00:00+09:00')
  const end = new Date(endDate + 'T00:00:00+09:00')

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return apiError('유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)', 400)
  }

  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000)
  if (diffDays < 0) return apiError('시작일이 종료일보다 늦습니다.', 400)
  if (diffDays > 90) return apiError('최대 90일까지 가능합니다.', 400)

  logger.info('Backfill 시작', { clinicId, startDate, endDate, days: diffDays + 1 })

  try {
    const allResults: { date: string; platform: string; count: number; error: string | null }[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d)
      const dateStr = getKstDateString(currentDate)

      const results = await syncClinic(clinicId, currentDate)

      for (const r of results) {
        allResults.push({
          date: dateStr,
          platform: r.platform,
          count: r.count,
          error: r.error || null,
        })
      }

      logger.info(`Backfill ${dateStr} 완료`, {
        clinicId,
        results: results.map(r => `${r.platform}: ${r.count}건${r.error ? ` (${r.error})` : ''}`),
      })
    }

    const totalCount = allResults.reduce((sum, r) => sum + r.count, 0)
    const errorCount = allResults.filter(r => r.error).length

    logger.info('Backfill 완료', { clinicId, totalCount, errorCount, days: diffDays + 1 })

    return apiSuccess({
      clinicId,
      syncedDays: diffDays + 1,
      totalCount,
      errorCount,
      results: allResults,
    })
  } catch (error) {
    logger.error('Backfill 실패', error, { clinicId, startDate, endDate })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
