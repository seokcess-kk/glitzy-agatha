/**
 * 날짜 포맷 유틸리티 — 전체 프로젝트에서 일관된 한국 시간(KST) 표기 사용
 * 모든 날짜/시간 표시는 Asia/Seoul 타임존 기준
 */

const TZ = 'Asia/Seoul'

/**
 * 타임존 정보가 없는 문자열을 UTC로 취급하여 Date 생성
 * Supabase의 `timestamp` (without tz) 컬럼은 '2026-03-17T12:50:00' 형태(Z 없음)로 반환되며,
 * 브라우저는 이를 로컬 시간으로 해석하여 KST 변환이 무시됨 → Z를 붙여 UTC로 강제
 */
export function toUtcDate(date: string | Date): Date {
  if (date instanceof Date) return date
  const s = date.trim()
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    return new Date(s)
  }
  return new Date(s + 'Z')
}

/** 날짜만 (예: 2026. 3. 16.) */
export function formatDate(date: string | Date): string {
  return toUtcDate(date).toLocaleDateString('ko', { timeZone: TZ })
}

/** 날짜 + 시간 (예: 3월 16일 14:30) */
export function formatDateTime(date: string | Date): string {
  return toUtcDate(date).toLocaleString('ko', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 시간만 (예: 14:30) */
export function formatTime(date: string | Date): string {
  return toUtcDate(date).toLocaleTimeString('ko', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** KST 기준 오늘 날짜 문자열 (YYYY-MM-DD) */
export function getKstDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** KST 기준 오늘 00:00:00 UTC ISO 문자열 (DB 쿼리용) */
export function getKstDayStartISO(date: Date = new Date()): string {
  const kstDate = getKstDateString(date)
  return new Date(kstDate + 'T00:00:00+09:00').toISOString()
}

/** KST 기준 오늘 23:59:59.999 UTC ISO 문자열 (DB 쿼리용) */
export function getKstDayEndISO(date: Date = new Date()): string {
  const kstDate = getKstDateString(date)
  return new Date(kstDate + 'T23:59:59.999+09:00').toISOString()
}
