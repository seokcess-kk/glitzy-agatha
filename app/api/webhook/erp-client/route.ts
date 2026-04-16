import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('WebhookErpClient')

function verifyServiceKey(req: NextRequest): boolean {
  const key = process.env.ERP_SERVICE_KEY
  if (!key) return false
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  try {
    return timingSafeEqual(Buffer.from(key), Buffer.from(token))
  } catch {
    return false
  }
}

type EventType = 'client.created' | 'client.updated' | 'client.deleted'

interface WebhookBody {
  event: EventType
  data: {
    id: number
    name: string
    business_number?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
  }
}

export async function POST(req: NextRequest) {
  // 인증 검증
  if (!verifyServiceKey(req)) {
    logger.warn('Webhook 인증 실패')
    return apiError('Unauthorized', 401)
  }

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return apiError('잘못된 요청 형식입니다.', 400)
  }

  const { event, data } = body

  if (!event || !data?.id || !data?.name) {
    return apiError('event, data.id, data.name은 필수입니다.', 400)
  }

  const validEvents: EventType[] = ['client.created', 'client.updated', 'client.deleted']
  if (!validEvents.includes(event)) {
    return apiError(`지원하지 않는 이벤트: ${event}`, 400)
  }

  const supabase = serverSupabase()

  try {
    switch (event) {
      case 'client.created': {
        // 이미 같은 erp_client_id가 있는지 확인 (중복 방지)
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('erp_client_id', data.id)
          .maybeSingle()

        if (existing) {
          logger.info('이미 매핑된 거래처, 무시', { erp_client_id: data.id, client_id: existing.id })
          return apiSuccess({ message: '이미 매핑된 거래처입니다.' })
        }

        // 새 클라이언트 자동 생성
        const slug = `erp-${data.id}`
        const { error: insertError } = await supabase
          .from('clients')
          .insert({
            name: sanitizeString(data.name, 100),
            slug,
            erp_client_id: data.id,
          })

        if (insertError) {
          logger.error('클라이언트 자동 생성 실패', insertError as unknown as Error, { erp_client_id: data.id })
          return apiError('클라이언트 생성 실패', 500)
        }

        logger.info('Webhook으로 클라이언트 자동 생성', { erp_client_id: data.id, name: data.name })
        return apiSuccess({ message: '처리 완료' })
      }

      case 'client.updated': {
        const { data: mapped } = await supabase
          .from('clients')
          .select('id')
          .eq('erp_client_id', data.id)
          .maybeSingle()

        if (!mapped) {
          logger.info('매핑된 클라이언트 없음, 무시', { erp_client_id: data.id })
          return apiSuccess({ message: '매핑된 클라이언트가 없습니다.' })
        }

        const { error: updateError } = await supabase
          .from('clients')
          .update({ name: sanitizeString(data.name, 100) })
          .eq('id', mapped.id)

        if (updateError) {
          logger.error('클라이언트 이름 업데이트 실패', updateError as unknown as Error, { client_id: mapped.id })
          return apiError('업데이트 실패', 500)
        }

        logger.info('Webhook으로 클라이언트 이름 업데이트', { erp_client_id: data.id, name: data.name })
        return apiSuccess({ message: '처리 완료' })
      }

      case 'client.deleted': {
        const { data: toDeactivate } = await supabase
          .from('clients')
          .select('id')
          .eq('erp_client_id', data.id)
          .maybeSingle()

        if (!toDeactivate) {
          logger.info('매핑된 클라이언트 없음, 무시', { erp_client_id: data.id })
          return apiSuccess({ message: '매핑된 클라이언트가 없습니다.' })
        }

        const { error: deactivateError } = await supabase
          .from('clients')
          .update({ is_active: false })
          .eq('id', toDeactivate.id)

        if (deactivateError) {
          logger.error('클라이언트 비활성화 실패', deactivateError as unknown as Error, { client_id: toDeactivate.id })
          return apiError('비활성화 실패', 500)
        }

        logger.info('Webhook으로 클라이언트 비활성화', { erp_client_id: data.id })
        return apiSuccess({ message: '처리 완료' })
      }
    }
  } catch (err) {
    logger.error('Webhook 처리 중 오류', err as Error, { event, erp_client_id: data.id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
