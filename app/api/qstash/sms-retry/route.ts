import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { sendSms } from '@/lib/solapi'
import { createLogger } from '@/lib/logger'

const logger = createLogger('SmsRetry')
const MAX_ATTEMPTS = 3

export async function POST(req: Request) {
  // QStash 서명 검증
  let body: { logId: number }

  if (process.env.QSTASH_CURRENT_SIGNING_KEY) {
    const { Receiver } = await import('@upstash/qstash')
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    })
    const signature = req.headers.get('Upstash-Signature') || ''
    const rawBody = await req.text()
    const isValid = await receiver.verify({ signature, body: rawBody }).catch(() => false)
    if (!isValid) return apiError('Invalid signature', 401)
    body = JSON.parse(rawBody)
  } else {
    body = await req.json()
  }

  const { logId } = body
  if (!logId) return apiError('logId 필수', 400)

  const supabase = serverSupabase()

  // 로그 조회
  const { data: log, error } = await supabase
    .from('sms_send_logs')
    .select('*')
    .eq('id', logId)
    .single()

  if (error || !log) return apiError('로그를 찾을 수 없습니다.', 404)
  if (log.status === 'sent') return apiSuccess({ message: '이미 발송 완료' })
  if (log.attempts >= MAX_ATTEMPTS) {
    await supabase
      .from('sms_send_logs')
      .update({ status: 'failed', error_message: `최대 재시도 횟수(${MAX_ATTEMPTS}) 초과` })
      .eq('id', logId)
    return apiSuccess({ message: '최대 재시도 초과, 최종 실패 처리' })
  }

  // SMS 재발송
  const result = await sendSms({ to: log.phone, text: log.message })
  const newAttempts = log.attempts + 1

  if (result.success) {
    await supabase
      .from('sms_send_logs')
      .update({ status: 'sent', attempts: newAttempts, sent_at: new Date().toISOString(), error_message: null })
      .eq('id', logId)
    logger.info('SMS 재발송 성공', { logId, attempts: newAttempts })
    return apiSuccess({ success: true, attempts: newAttempts })
  }

  // 아직 재시도 가능하면 다시 스케줄
  if (newAttempts < MAX_ATTEMPTS) {
    await supabase
      .from('sms_send_logs')
      .update({ attempts: newAttempts, error_message: result.error, status: 'retrying' })
      .eq('id', logId)

    // 다음 재시도 스케줄 (5분 후)
    if (process.env.QSTASH_TOKEN) {
      const { qstash } = await import('@/lib/qstash')
      await qstash.publishJSON({
        url: `${process.env.NEXTAUTH_URL}/api/qstash/sms-retry`,
        body: { logId },
        delay: 300,
      })
    }

    logger.warn('SMS 재발송 실패, 재시도 스케줄', { logId, attempts: newAttempts, error: result.error })
  } else {
    // 최종 실패
    await supabase
      .from('sms_send_logs')
      .update({ status: 'failed', attempts: newAttempts, error_message: result.error })
      .eq('id', logId)
    logger.error('SMS 최종 발송 실패', new Error(result.error || 'Unknown'), { logId, attempts: newAttempts })
  }

  return apiSuccess({ success: false, attempts: newAttempts, error: result.error })
}
