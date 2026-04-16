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

// 전화번호 정규화 (하이픈 추가)
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
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
  username: string
  role: 'superadmin' | 'clinic_admin' | 'clinic_staff' | 'agency_staff' | 'demo_viewer'
  clinic_id: number | null
  password_version: number
}

// 세션 사용자 정보 가져오기
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as SessionUser
}

// 특정 리소스에 대한 clinic 접근 권한 확인
export function checkClinicAccess(
  resourceClinicId: number | null,
  user: SessionUser
): boolean {
  // superadmin은 모든 clinic 접근 가능
  if (user.role === 'superadmin') return true

  // clinic_admin의 경우
  // 리소스에 clinic_id가 없으면 (미배정) 접근 불가
  if (resourceClinicId === null) return false

  // 자신의 clinic만 접근 가능
  return user.clinic_id === resourceClinicId
}

// 예약(booking) 수정 권한 확인
export async function canModifyBooking(
  bookingId: number,
  user: SessionUser
): Promise<{ allowed: boolean; clinicId: number | null; error?: string }> {
  // superadmin은 모든 예약에 접근 가능 (DB 조회 생략)
  if (user.role === 'superadmin') {
    return { allowed: true, clinicId: null }
  }

  const supabase = serverSupabase()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('clinic_id')
    .eq('id', bookingId)
    .single()

  if (error) {
    logger.error('DB error in canModifyBooking', error, { action: 'canModifyBooking' })
    return { allowed: false, clinicId: null, error: '예약 조회 중 오류가 발생했습니다.' }
  }

  if (!booking) {
    return { allowed: false, clinicId: null, error: '예약을 찾을 수 없습니다.' }
  }

  // clinic_admin의 경우 자신의 병원 예약만 접근 가능
  if (booking.clinic_id !== user.clinic_id) {
    return { allowed: false, clinicId: booking.clinic_id, error: '해당 예약에 대한 권한이 없습니다.' }
  }

  return { allowed: true, clinicId: booking.clinic_id }
}

// 고객(customer) 접근 권한 확인
export async function canAccessCustomer(
  customerId: number,
  user: SessionUser
): Promise<{ allowed: boolean; clinicId: number | null; error?: string }> {
  const supabase = serverSupabase()

  const { data: customer, error } = await supabase
    .from('customers')
    .select('clinic_id')
    .eq('id', customerId)
    .single()

  if (error) {
    logger.error('DB error in canAccessCustomer', error, { action: 'canAccessCustomer' })
    return { allowed: false, clinicId: null, error: '고객 조회 중 오류가 발생했습니다.' }
  }

  if (!customer) {
    return { allowed: false, clinicId: null, error: '고객을 찾을 수 없습니다.' }
  }

  // clinic_id가 null인 고객 (미배정)
  if (customer.clinic_id === null) {
    // superadmin만 미배정 고객 접근 가능
    if (user.role === 'superadmin') {
      return { allowed: true, clinicId: null }
    }
    return { allowed: false, clinicId: null, error: '미배정 고객에 대한 권한이 없습니다.' }
  }

  const allowed = checkClinicAccess(customer.clinic_id, user)
  if (!allowed) {
    return { allowed: false, clinicId: customer.clinic_id, error: '해당 고객에 대한 권한이 없습니다.' }
  }

  return { allowed: true, clinicId: customer.clinic_id }
}

// 콘텐츠 포스트(content_posts) 접근 권한 확인
export async function canAccessContentPost(
  postId: number,
  user: SessionUser
): Promise<{ allowed: boolean; clinicId: number | null; error?: string }> {
  // superadmin은 모든 포스트에 접근 가능 (DB 조회 생략)
  if (user.role === 'superadmin') {
    return { allowed: true, clinicId: null }
  }

  const supabase = serverSupabase()

  const { data: post, error } = await supabase
    .from('content_posts')
    .select('clinic_id')
    .eq('id', postId)
    .single()

  if (error) {
    logger.error('DB error in canAccessContentPost', error, { action: 'canAccessContentPost' })
    return { allowed: false, clinicId: null, error: '포스트 조회 중 오류가 발생했습니다.' }
  }

  if (!post) {
    return { allowed: false, clinicId: null, error: '포스트를 찾을 수 없습니다.' }
  }

  // clinic_admin의 경우 자신의 병원 포스트만 접근 가능
  if (post.clinic_id !== user.clinic_id) {
    return { allowed: false, clinicId: post.clinic_id, error: '해당 포스트에 대한 권한이 없습니다.' }
  }

  return { allowed: true, clinicId: post.clinic_id }
}
