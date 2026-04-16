import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'

export async function POST(req: Request) {
  // QStash 서명 검증
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

    const { leadId, phoneNumber, name } = JSON.parse(rawBody)
    return handleJob(leadId, phoneNumber, name)
  }

  const { leadId, phoneNumber, name } = await req.json()
  return handleJob(leadId, phoneNumber, name)
}

async function handleJob(leadId: number, phoneNumber: string, name: string) {
  const supabase = serverSupabase()
  try {
    // Kakao 알림톡 발송 (알리고 서비스)
    if (process.env.KAKAO_API_KEY && process.env.KAKAO_SENDER_KEY) {
      const params = new URLSearchParams({
        apikey: process.env.KAKAO_API_KEY,
        userid: process.env.KAKAO_USER_ID || '',
        senderkey: process.env.KAKAO_SENDER_KEY,
        tpl_code: process.env.KAKAO_TEMPLATE_CODE || '',
        sender: process.env.KAKAO_SENDER_NUMBER || '',
        receiver_1: phoneNumber,
        recvname_1: name || '고객',
        subject_1: '상담 안내',
        message_1: `${name || '고객'}님, 안녕하세요. 상담 문의 감사합니다. 빠르게 연락드리겠습니다.`,
      })
      await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })
    }

    // 챗봇 발송 완료 처리
    await supabase
      .from('leads')
      .update({ chatbot_sent: true, chatbot_sent_at: new Date().toISOString() })
      .eq('id', leadId)

    return apiSuccess({ success: true })
  } catch (err) {
    console.error('[QStash Chatbot Error]', err)
    return apiError('챗봇 발송 실패', 500)
  }
}
