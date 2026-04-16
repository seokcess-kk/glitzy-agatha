/**
 * 프로덕션 에러 SMS 알림
 * - critical 에러 발생 시 관리자에게 SMS 발송
 * - 쿨다운: 동일 에러타입 5분간 중복 차단
 * - 일일 상한: 50건/일
 */

import { sendSms } from '@/lib/solapi'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ErrorAlert')

type ErrorType =
  | 'lead_webhook_fail'
  | 'ad_sync_fail'
  | 'press_sync_fail'
  | 'db_connection_fail'
  | 'meta_capi_fail'
  | 'weekly_report_fail'
  | 'ads_anomaly'

// 쿨다운 (메모리 Map — 동일 인스턴스 내 연쇄 에러 중복 방지)
const cooldownMap = new Map<ErrorType, number>()
const COOLDOWN_MS = 5 * 60 * 1000

// 일일 상한 (메모리 카운터 — 자정 리셋)
let dailyCount = 0
let dailyResetDate = new Date().toDateString()
const DAILY_LIMIT = 50

function checkCooldown(errorType: ErrorType): boolean {
  const lastSent = cooldownMap.get(errorType)
  if (lastSent && Date.now() - lastSent < COOLDOWN_MS) return false
  cooldownMap.set(errorType, Date.now())
  return true
}

function checkAndIncrementDaily(): boolean {
  const today = new Date().toDateString()
  if (today !== dailyResetDate) {
    dailyCount = 0
    dailyResetDate = today
  }
  if (dailyCount >= DAILY_LIMIT) return false
  dailyCount++
  return true
}

export async function sendErrorAlert(
  errorType: ErrorType,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(`[DEV] 에러 알림 스킵: ${errorType}`, { message, ...context })
    return
  }

  const phones = (process.env.ADMIN_ALERT_PHONES || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)

  if (phones.length === 0) return

  if (!checkCooldown(errorType)) return
  if (!checkAndIncrementDaily()) {
    logger.warn('에러 알림 일일 상한 도달 (50건)')
    return
  }

  const text = `[Samantha 시스템 알림]\n${message}\n타입: ${errorType}\n시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`

  await Promise.all(
    phones.map(phone =>
      sendSms({ to: phone, text }).catch(err => {
        logger.error('에러 알림 SMS 발송 실패', err, { phone, errorType })
      })
    )
  )
}
