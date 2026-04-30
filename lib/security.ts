import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { serverSupabase } from './supabase'
import { createLogger } from './logger'

const logger = createLogger('Security')

// ============================================
// 상수 정의
// ============================================

export const VALID_BOOKING_STATUSES = [
  'confirmed',
  'visited',
  'noshow',
  'cancelled',
  'treatment_confirmed',
] as const
export type BookingStatus = (typeof VALID_BOOKING_STATUSES)[number]

export const VALID_CONSULTATION_STATUSES = [
  '예약완료',
  '방문완료',
  '노쇼',
  '상담중',
  '취소',
  '시술확정',
] as const
export type ConsultationStatus = (typeof VALID_CONSULTATION_STATUSES)[number]

// ============================================
// 환경변수 검증 (lib/env.ts로 이동됨)
// ============================================

// 하위 호환성을 위해 re-export
export { validateEnv } from './env'

// ============================================
// 입력값 검증 함수
// ============================================

// 전화번호 형식 검증 (한국 휴대폰) - 하이픈 유무 모두 허용
export function isValidPhoneNumber(phone: string): boolean {
  // 010-1234-5678 또는 01012345678 형식 모두 허용
  const pattern = /^01[0-9]-?\d{3,4}-?\d{4}$/
  return pattern.test(phone)
}

// 전화번호 정규화 (하이픈 제거, 숫자만 반환)
// DB 저장/조회 시 일관된 키로 사용. 하이픈 유무에 관계없이 동일한 결과를 보장한다.
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length === 10 || digits.length === 11) {
    return digits
  }
  return phone
}

// URL 검증
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// 날짜 검증
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

// 예약 상태 유효값 검증
export function isValidBookingStatus(status: string): status is BookingStatus {
  return VALID_BOOKING_STATUSES.includes(status as BookingStatus)
}

// 상담 상태 유효값 검증
export function isValidConsultationStatus(status: string): status is ConsultationStatus {
  return VALID_CONSULTATION_STATUSES.includes(status as ConsultationStatus)
}

// 금액 검증
export function isValidPaymentAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 100000000
}

// XSS 방지용 문자열 sanitize
export function sanitizeString(str: string, maxLength: number = 200): string {
  return String(str)
    .slice(0, maxLength)
    .replace(/[<>'"&]/g, '') // XSS 위험 문자 제거
}

// URL 전용 sanitize — &?=# 등 URL 구조 문자를 보존하고 XSS 문자만 제거
export function sanitizeUrl(url: string, maxLength: number = 2000): string {
  const cleaned = String(url)
    .slice(0, maxLength)
    .replace(/[<>'"]/g, '') // & 는 URL 쿼리 구분자이므로 유지
  // javascript: / data: 등 위험 스킴 차단
  if (/^(javascript|data|vbscript):/i.test(cleaned.trim())) {
    return ''
  }
  return cleaned
}

// 숫자 ID 파싱 (문자열/숫자 모두 허용)
export function parseId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return null
}

// ============================================
// 세션 및 권한 관련
// ============================================

export interface SessionUser {
  id: string
  phone_number: string
  role: 'superadmin' | 'client_admin' | 'client_staff' | 'agency_staff' | 'demo_viewer'
  client_id: number | null
  password_version: number
}

// 세션 사용자 정보 가져오기
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as SessionUser
}

// 특정 리소스에 대한 client 접근 권한 확인
export function checkClientAccess(
  resourceClientId: number | null,
  user: SessionUser
): boolean {
  // superadmin은 모든 client 접근 가능
  if (user.role === 'superadmin') return true

  // client_admin의 경우
  // 리소스에 client_id가 없으면 (미배정) 접근 불가
  if (resourceClientId === null) return false

  // 자신의 client만 접근 가능
  return user.client_id === resourceClientId
}

// 예약(booking) 수정 권한 확인
export async function canModifyBooking(
  bookingId: number,
  user: SessionUser
): Promise<{ allowed: boolean; clientId: number | null; error?: string }> {
  // superadmin은 모든 예약에 접근 가능 (DB 조회 생략)
  if (user.role === 'superadmin') {
    return { allowed: true, clientId: null }
  }

  const supabase = serverSupabase()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('client_id')
    .eq('id', bookingId)
    .single()

  if (error) {
    logger.error('DB error in canModifyBooking', error, { action: 'canModifyBooking' })
    return { allowed: false, clientId: null, error: '예약 조회 중 오류가 발생했습니다.' }
  }

  if (!booking) {
    return { allowed: false, clientId: null, error: '예약을 찾을 수 없습니다.' }
  }

  // client_admin의 경우 자신의 클라이언트 예약만 접근 가능
  if (booking.client_id !== user.client_id) {
    return { allowed: false, clientId: booking.client_id, error: '해당 예약에 대한 권한이 없습니다.' }
  }

  return { allowed: true, clientId: booking.client_id }
}

// 고객(contact) 접근 권한 확인
export async function canAccessContact(
  contactId: number,
  user: SessionUser
): Promise<{ allowed: boolean; clientId: number | null; error?: string }> {
  const supabase = serverSupabase()

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('client_id')
    .eq('id', contactId)
    .single()

  if (error) {
    logger.error('DB error in canAccessContact', error, { action: 'canAccessContact' })
    return { allowed: false, clientId: null, error: '고객 조회 중 오류가 발생했습니다.' }
  }

  if (!contact) {
    return { allowed: false, clientId: null, error: '고객을 찾을 수 없습니다.' }
  }

  // client_id가 null인 고객 (미배정)
  if (contact.client_id === null) {
    // superadmin만 미배정 고객 접근 가능
    if (user.role === 'superadmin') {
      return { allowed: true, clientId: null }
    }
    return { allowed: false, clientId: null, error: '미배정 고객에 대한 권한이 없습니다.' }
  }

  const allowed = checkClientAccess(contact.client_id, user)
  if (!allowed) {
    return { allowed: false, clientId: contact.client_id, error: '해당 고객에 대한 권한이 없습니다.' }
  }

  return { allowed: true, clientId: contact.client_id }
}

// 콘텐츠 포스트(content_posts) 접근 권한 확인
export async function canAccessContentPost(
  postId: number,
  user: SessionUser
): Promise<{ allowed: boolean; clientId: number | null; error?: string }> {
  // superadmin은 모든 포스트에 접근 가능 (DB 조회 생략)
  if (user.role === 'superadmin') {
    return { allowed: true, clientId: null }
  }

  const supabase = serverSupabase()

  const { data: post, error } = await supabase
    .from('content_posts')
    .select('client_id')
    .eq('id', postId)
    .single()

  if (error) {
    logger.error('DB error in canAccessContentPost', error, { action: 'canAccessContentPost' })
    return { allowed: false, clientId: null, error: '포스트 조회 중 오류가 발생했습니다.' }
  }

  if (!post) {
    return { allowed: false, clientId: null, error: '포스트를 찾을 수 없습니다.' }
  }

  // client_admin의 경우 자신의 클라이언트 포스트만 접근 가능
  if (post.client_id !== user.client_id) {
    return { allowed: false, clientId: post.client_id, error: '해당 포스트에 대한 권한이 없습니다.' }
  }

  return { allowed: true, clientId: post.client_id }
}
