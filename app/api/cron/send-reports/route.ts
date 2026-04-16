import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const logger = createLogger('CronSendReports')

export const maxDuration = 300

/**
 * 리포트 발송 Cron (매일 08:00 KST 체크)
 * - 오늘 발송 예정인 클라이언트 조회
 * - 해당 클라이언트의 KPI 데이터 수집
 * - SMS/카카오톡 발송 (스텁)
 */
export async function GET(req: Request) {
  // Vercel Cron 인증 확인
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401)
  }

  const supabase = serverSupabase()
  const now = new Date()
  const kstToday = getKstDateString(now)
  const todayDate = new Date(kstToday + 'T00:00:00+09:00')
  const dayOfWeek = todayDate.getDay() // 0(일) ~ 6(토)
  const dayOfMonth = parseInt(kstToday.slice(8, 10))

  try {
    // 활성화된 리포트 설정 조회
    const { data: settings, error } = await supabase
      .from('client_notify_settings')
      .select('id, client_id, config')
      .eq('event_type', 'weekly_report')

    if (error) {
      logger.error('리포트 설정 조회 실패', error)
      return apiError('설정 조회 실패', 500)
    }

    const results: { clientId: number; status: string; message?: string }[] = []

    for (const setting of settings || []) {
      const config = setting.config as {
        frequency: string
        day_of_week: number
        time: string
        is_active: boolean
      } | null

      if (!config || !config.is_active) continue

      // 발송 여부 확인
      let shouldSend = false

      if (config.frequency === 'weekly' && config.day_of_week === dayOfWeek) {
        shouldSend = true
      } else if (config.frequency === 'monthly' && dayOfMonth === 1) {
        shouldSend = true
      }

      if (!shouldSend) continue

      const clientId = setting.client_id

      try {
        // 클라이언트 정보 조회
        const { data: client } = await supabase
          .from('clients')
          .select('id, name, notify_phones')
          .eq('id', clientId)
          .eq('is_active', true)
          .single()

        if (!client) {
          results.push({ clientId, status: 'skipped', message: '비활성 클라이언트' })
          continue
        }

        const phones = client.notify_phones as string[] | null
        if (!phones || phones.length === 0) {
          results.push({ clientId, status: 'skipped', message: '알림 연락처 없음' })
          continue
        }

        // KPI 데이터 수집 (간단 버전: 이번 달 리드/전환 수)
        const monthStart = kstToday.slice(0, 7) + '-01'
        const tsStart = `${monthStart}T00:00:00+09:00`
        const tsEnd = new Date(kstToday + 'T23:59:59+09:00').toISOString()

        const { data: leads } = await supabase
          .from('leads')
          .select('id, status')
          .eq('client_id', clientId)
          .gte('created_at', tsStart)
          .lte('created_at', tsEnd)

        const totalLeads = leads?.length || 0
        const convertedLeads = leads?.filter(l => l.status === 'converted').length || 0

        // 광고비 합계
        const { data: adStats } = await supabase
          .from('ad_campaign_stats')
          .select('spend_amount')
          .eq('client_id', clientId)
          .gte('stat_date', monthStart)
          .lte('stat_date', kstToday)

        const totalSpend = (adStats || []).reduce((sum, r) => sum + Number(r.spend_amount || 0), 0)
        const cpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0

        // 리포트 메시지 생성
        const reportText = [
          `[Agatha] ${client.name} 마케팅 리포트`,
          `기간: ${monthStart} ~ ${kstToday}`,
          `리드: ${totalLeads}건`,
          `전환: ${convertedLeads}건`,
          `광고비: ${totalSpend.toLocaleString()}원`,
          `CPL: ${cpl.toLocaleString()}원`,
        ].join('\n')

        // SMS 발송 (스텁 — 실제 발송은 sendSmsWithLog 사용)
        // TODO: 실제 운영 시 sendSmsWithLog(supabase, { to, text, clientId }) 호출
        logger.info('리포트 발송 예정', {
          clientId,
          clientName: client.name,
          phones,
          reportText,
        })

        results.push({
          clientId,
          status: 'sent',
          message: `${phones.length}명에게 발송 예정`,
        })
      } catch (err) {
        logger.error('클라이언트 리포트 생성 실패', err, { clientId })
        results.push({ clientId, status: 'error', message: String(err) })
      }
    }

    return apiSuccess({
      date: kstToday,
      dayOfWeek,
      processed: results.length,
      results,
    })
  } catch (error) {
    logger.error('리포트 발송 Cron 실패', error)
    return apiError('리포트 발송 실패', 500)
  }
}
