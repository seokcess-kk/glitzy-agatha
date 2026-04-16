import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminClientReportSettings')

interface ReportSettings {
  frequency: 'weekly' | 'monthly' | 'disabled'
  day_of_week: number // 0(일) ~ 6(토), weekly일 때 사용
  time: string // HH:mm 형식
  is_active: boolean
}

const DEFAULT_SETTINGS: ReportSettings = {
  frequency: 'weekly',
  day_of_week: 1, // 월요일
  time: '08:00',
  is_active: false,
}

/**
 * GET: 현재 리포트 설정 (주기, 요일, 시간, 활성화 여부)
 */
export const GET = withSuperAdmin(async (req: Request, { user }) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const idIndex = segments.indexOf('clients') + 1
  const id = parseId(segments[idIndex])
  if (!id) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  try {
    // client_notify_settings에서 weekly_report 설정 조회
    const { data: setting, error } = await supabase
      .from('client_notify_settings')
      .select('id, config')
      .eq('client_id', id)
      .eq('event_type', 'weekly_report')
      .single()

    if (error || !setting) {
      // 설정이 없으면 기본값 반환
      return apiSuccess({
        clientId: id,
        settings: DEFAULT_SETTINGS,
      })
    }

    const config = setting.config as ReportSettings | null
    return apiSuccess({
      clientId: id,
      settings: config || DEFAULT_SETTINGS,
    })
  } catch (error) {
    logger.error('리포트 설정 조회 실패', error, { clientId: id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

/**
 * PUT: 리포트 설정 변경
 */
export const PUT = withSuperAdmin(async (req: Request, { user }) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const idIndex = segments.indexOf('clients') + 1
  const id = parseId(segments[idIndex])
  if (!id) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  try {
    const body = await req.json()

    // 입력 검증
    const frequency = body.frequency
    if (!['weekly', 'monthly', 'disabled'].includes(frequency)) {
      return apiError('유효한 발송 주기가 필요합니다. (weekly, monthly, disabled)', 400)
    }

    const dayOfWeek = Number(body.day_of_week)
    if (frequency === 'weekly' && (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
      return apiError('유효한 요일이 필요합니다. (0: 일 ~ 6: 토)', 400)
    }

    const time = String(body.time || '08:00')
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return apiError('유효한 시간 형식이 필요합니다. (HH:mm)', 400)
    }

    const isActive = Boolean(body.is_active)

    const settings: ReportSettings = {
      frequency,
      day_of_week: dayOfWeek || 1,
      time,
      is_active: isActive,
    }

    // 클라이언트 존재 여부 확인
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .single()

    if (clientError || !client) {
      return apiError('클라이언트를 찾을 수 없습니다.', 404)
    }

    // upsert: client_notify_settings에 저장
    const { data: existing } = await supabase
      .from('client_notify_settings')
      .select('id')
      .eq('client_id', id)
      .eq('event_type', 'weekly_report')
      .single()

    if (existing) {
      const { error: updateError } = await supabase
        .from('client_notify_settings')
        .update({ config: settings })
        .eq('id', existing.id)

      if (updateError) {
        logger.error('리포트 설정 업데이트 실패', updateError, { clientId: id })
        return apiError('설정 저장에 실패했습니다.', 500)
      }
    } else {
      const { error: insertError } = await supabase
        .from('client_notify_settings')
        .insert({
          client_id: id,
          event_type: 'weekly_report',
          config: settings,
        })

      if (insertError) {
        logger.error('리포트 설정 생성 실패', insertError, { clientId: id })
        return apiError('설정 저장에 실패했습니다.', 500)
      }
    }

    return apiSuccess({
      clientId: id,
      settings,
    })
  } catch (error) {
    logger.error('리포트 설정 변경 실패', error, { clientId: id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
