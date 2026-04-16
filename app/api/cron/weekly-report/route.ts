import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { sendErrorAlert } from '@/lib/error-alert'
import { sendSmsWithLog } from '@/lib/solapi'
import { generateWeeklyReport } from '@/lib/services/weeklyReport'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

export const maxDuration = 60

const logger = createLogger('WeeklyReportCron')

// Vercel Cron: 매주 월요일 00:00 UTC = KST 09:00 (vercel.json 참고)
export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401)
  }

  const supabase = serverSupabase()
  const startTime = Date.now()

  // 지난주 월~일 계산 (KST 기준, lib/date.ts 유틸리티 사용)
  const now = new Date()
  const kstTodayStr = getKstDateString(now) // YYYY-MM-DD (KST)
  const kstToday = new Date(kstTodayStr + 'T00:00:00+09:00')
  const weekEnd = new Date(kstToday)
  weekEnd.setDate(kstToday.getDate() - 1) // 어제 (일요일)
  const weekStart = new Date(weekEnd)
  weekStart.setDate(weekEnd.getDate() - 6) // 지난주 월요일

  // 활성 병원 목록 조회
  const { data: clinics, error: clinicsError } = await supabase
    .from('clinics')
    .select('id, name, notify_phones, notify_enabled')
    .eq('is_active', true)

  if (clinicsError) {
    logger.error('활성 병원 조회 실패', clinicsError)
    sendErrorAlert('weekly_report_fail', '활성 병원 목록 조회 실패').catch(() => {})
    return apiError('병원 목록 조회 실패', 500)
  }

  if (!clinics || clinics.length === 0) {
    logger.info('활성 병원 없음, 리포트 생성 스킵')
    return apiSuccess({ success: true, message: '활성 병원 없음', results: [] })
  }

  // 배치 처리 (5개 병원씩 병렬 → Supabase 동시 요청 ~50개 이하로 제한)
  const BATCH_SIZE = 5
  const results: { clinicId: number; clinicName: string; status: string; smsSent: number }[] = []

  for (let batchStart = 0; batchStart < clinics.length; batchStart += BATCH_SIZE) {
    const batch = clinics.slice(batchStart, batchStart + BATCH_SIZE)

    const reportResults = await Promise.allSettled(
      batch.map(clinic => generateWeeklyReport(supabase, clinic.id, weekStart, weekEnd))
    )

    // SMS 발송 (순차 — 솔라피 rate limit 방지)
    for (let i = 0; i < batch.length; i++) {
      const clinic = batch[i]
      const reportResult = reportResults[i]

      if (reportResult.status === 'rejected') {
        logger.error(`주간 리포트 실패: ${clinic.name}`, reportResult.reason, { clinicId: clinic.id })
        results.push({ clinicId: clinic.id, clinicName: clinic.name, status: 'failed', smsSent: 0 })
        continue
      }

      const report = reportResult.value
      let smsSent = 0

      if (clinic.notify_enabled && clinic.notify_phones && clinic.notify_phones.length > 0) {
        for (const phone of clinic.notify_phones) {
          if (!phone) continue
          const smsResult = await sendSmsWithLog(supabase, {
            to: phone,
            text: report.smsText,
            clinicId: clinic.id,
          })
          if (smsResult.success) smsSent++
        }
      }

      results.push({ clinicId: clinic.id, clinicName: clinic.name, status: 'success', smsSent })
      logger.info(`주간 리포트 완료: ${clinic.name}`, { clinicId: clinic.id, smsSent })
    }
  }

  const failCount = results.filter(r => r.status === 'failed').length
  if (failCount > 0) {
    sendErrorAlert(
      'weekly_report_fail',
      `주간 리포트 ${failCount}/${clinics.length}건 실패`,
    ).catch(() => {})
  }

  const duration = Date.now() - startTime
  logger.info('주간 리포트 크론 완료', {
    total: clinics.length,
    success: results.filter(r => r.status === 'success').length,
    failed: failCount,
    duration: `${duration}ms`,
  })

  return apiSuccess({ success: true, results })
}
