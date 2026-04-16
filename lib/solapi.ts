import crypto from 'crypto'

/**
 * 솔라피 SMS 발송 헬퍼
 * @see https://docs.solapi.com/api-reference/messages/sendsimplemessage
 */

function getAuthHeader(): string {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('SOLAPI_API_KEY / SOLAPI_API_SECRET 미설정')

  const date = new Date().toISOString()
  const salt = crypto.randomUUID()
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export interface SendSmsOptions {
  to: string
  text: string
  from?: string
}

export interface SendSmsWithLogOptions extends SendSmsOptions {
  clientId?: number | null
  leadId?: number | null
}

export async function sendSms({ to, text, from }: SendSmsOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const senderNumber = from || process.env.SOLAPI_SENDER_NUMBER
  if (!senderNumber) return { success: false, error: 'SOLAPI_SENDER_NUMBER 미설정' }

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({
        message: {
          to: to.replace(/-/g, ''),
          from: senderNumber.replace(/-/g, ''),
          text,
          type: text.length > 45 ? 'LMS' : 'SMS',
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.errorMessage || data.errorCode || 'SMS 발송 실패' }
    }

    return { success: true, messageId: data.messageId }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'SMS 발송 오류' }
  }
}

/**
 * SMS 발송 + DB 로그 기록
 * 성공/실패 모두 sms_send_logs에 기록하고, 실패 시 logId를 반환하여 재시도에 활용
 */
export async function sendSmsWithLog(
  supabase: { from: (table: string) => any },
  { to, text, from, clientId, leadId }: SendSmsWithLogOptions
): Promise<{ success: boolean; logId?: number; error?: string }> {
  const result = await sendSms({ to, text, from })

  // DB 로그 기록
  try {
    const { data: log } = await supabase
      .from('sms_send_logs')
      .insert({
        client_id: clientId ?? null,
        lead_id: leadId ?? null,
        phone: to,
        message: text,
        status: result.success ? 'sent' : (process.env.QSTASH_TOKEN ? 'retrying' : 'failed'),
        error_message: result.error || null,
        attempts: 1,
        sent_at: result.success ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    return {
      success: result.success,
      logId: log?.id ?? undefined,
      error: result.error,
    }
  } catch {
    // 로그 기록 실패는 발송 결과에 영향을 주지 않음
    return { success: result.success, error: result.error }
  }
}
