/**
 * 로그인 Rate Limiting
 * IP:phone_number 키 기반, 15분 내 5회 제한
 */

interface RateLimitEntry {
  count: number
  firstAttempt: number
}

const WINDOW_MS = 15 * 60 * 1000 // 15분
const MAX_ATTEMPTS = 5

// 모듈 레벨 Map (서버 프로세스 수명 동안 유지)
const attempts = new Map<string, RateLimitEntry>()

// 주기적 정리 (5분마다)
let lastCleanup = Date.now()
function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < 5 * 60 * 1000) return
  lastCleanup = now
  for (const [key, entry] of attempts) {
    if (now - entry.firstAttempt > WINDOW_MS) {
      attempts.delete(key)
    }
  }
}

function getKey(ip: string, phoneNumber: string): string {
  return `${ip}:${phoneNumber}`
}

/**
 * Rate limit 체크 — 제한 초과 시 { limited: true, retryAfterSeconds }
 */
export function checkRateLimit(ip: string, phoneNumber: string): { limited: boolean; retryAfterSeconds?: number } {
  cleanup()
  const key = getKey(ip, phoneNumber)
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry) return { limited: false }

  // 윈도우 만료 → 리셋
  if (now - entry.firstAttempt > WINDOW_MS) {
    attempts.delete(key)
    return { limited: false }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - entry.firstAttempt)) / 1000)
    return { limited: true, retryAfterSeconds }
  }

  return { limited: false }
}

/**
 * 실패 시도 기록
 */
export function recordFailedAttempt(ip: string, phoneNumber: string): void {
  cleanup()
  const key = getKey(ip, phoneNumber)
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now })
  } else {
    entry.count++
  }
}

/**
 * 성공 시 리셋
 */
export function resetRateLimit(ip: string, phoneNumber: string): void {
  attempts.delete(getKey(ip, phoneNumber))
}
