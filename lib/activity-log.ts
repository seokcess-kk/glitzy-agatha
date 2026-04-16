import { createLogger } from '@/lib/logger'

const logger = createLogger('ActivityLog')

interface LogActivityParams {
  userId: number | string
  clinicId?: number | null
  action: string
  targetTable: string
  targetId?: number | null
  detail?: Record<string, unknown>
}

/**
 * 활동 로그 기록 (실패해도 메인 플로우를 막지 않음)
 */
export async function logActivity(
  supabase: { from: (table: string) => any },
  params: LogActivityParams
) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: typeof params.userId === 'string' ? Number(params.userId) : params.userId,
      clinic_id: params.clinicId ?? null,
      action: params.action,
      target_table: params.targetTable,
      target_id: params.targetId ?? null,
      detail: params.detail ?? {},
    })
  } catch (e) {
    logger.warn('활동 로그 기록 실패', { error: e, params })
  }
}
