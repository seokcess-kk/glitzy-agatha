import {
  parseId,
  sanitizeString,
  isValidPhoneNumber,
  normalizePhoneNumber,
  isValidUrl,
  isValidDate,
  isValidConversionAmount,
  checkClientAccess,
  type SessionUser,
} from '@/lib/security'

describe('parseId', () => {
  it('숫자 ID를 그대로 반환', () => {
    expect(parseId(1)).toBe(1)
    expect(parseId(999)).toBe(999)
  })

  it('문자열 ID를 숫자로 파싱', () => {
    expect(parseId('42')).toBe(42)
    expect(parseId('1')).toBe(1)
  })

  it('0 이하, NaN, 빈 문자열은 null 반환', () => {
    expect(parseId(0)).toBeNull()
    expect(parseId(-1)).toBeNull()
    expect(parseId('abc')).toBeNull()
    expect(parseId('')).toBeNull()
    expect(parseId(null)).toBeNull()
    expect(parseId(undefined)).toBeNull()
  })

  it('소수점 숫자는 null 반환', () => {
    expect(parseId(1.5)).toBeNull()
  })
})

describe('sanitizeString', () => {
  it('XSS 위험 문자 제거', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script')
  })

  it('길이 제한 적용', () => {
    expect(sanitizeString('abcdefghij', 5)).toBe('abcde')
  })

  it('기본 maxLength는 200', () => {
    const long = 'a'.repeat(300)
    expect(sanitizeString(long)).toHaveLength(200)
  })
})

describe('isValidPhoneNumber', () => {
  it('올바른 전화번호 형식 허용', () => {
    expect(isValidPhoneNumber('010-1234-5678')).toBe(true)
    expect(isValidPhoneNumber('01012345678')).toBe(true)
    expect(isValidPhoneNumber('011-123-4567')).toBe(true)
  })

  it('잘못된 형식 거부', () => {
    expect(isValidPhoneNumber('02-1234-5678')).toBe(false)
    expect(isValidPhoneNumber('12345')).toBe(false)
    expect(isValidPhoneNumber('')).toBe(false)
  })
})

describe('normalizePhoneNumber', () => {
  it('11자리는 숫자만 유지', () => {
    expect(normalizePhoneNumber('01012345678')).toBe('01012345678')
  })

  it('10자리는 숫자만 유지', () => {
    expect(normalizePhoneNumber('0111234567')).toBe('0111234567')
  })

  it('하이픈 포함 입력에서 하이픈 제거', () => {
    expect(normalizePhoneNumber('010-1234-5678')).toBe('01012345678')
  })
})

describe('isValidUrl', () => {
  it('유효한 URL 허용', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
    expect(isValidUrl('http://localhost:3000')).toBe(true)
  })

  it('잘못된 URL 거부', () => {
    expect(isValidUrl('not-a-url')).toBe(false)
    expect(isValidUrl('')).toBe(false)
  })
})

describe('isValidDate', () => {
  it('유효한 날짜 허용', () => {
    expect(isValidDate('2026-03-20')).toBe(true)
    expect(isValidDate('2026-03-20T00:00:00Z')).toBe(true)
  })

  it('잘못된 날짜 거부', () => {
    expect(isValidDate('not-a-date')).toBe(false)
  })
})

describe('isValidConversionAmount', () => {
  it('유효한 금액 허용', () => {
    expect(isValidConversionAmount(10000)).toBe(true)
    expect(isValidConversionAmount(1)).toBe(true)
    expect(isValidConversionAmount(100000000)).toBe(true)
  })

  it('잘못된 금액 거부', () => {
    expect(isValidConversionAmount(0)).toBe(false)
    expect(isValidConversionAmount(-1)).toBe(false)
    expect(isValidConversionAmount(100000001)).toBe(false)
    expect(isValidConversionAmount(NaN)).toBe(false)
    expect(isValidConversionAmount(Infinity)).toBe(false)
  })
})

describe('checkClientAccess', () => {
  const superadmin: SessionUser = { id: '1', phone_number: '010-0000-0000', role: 'superadmin', client_id: null, password_version: 1 }
  const clientAdmin: SessionUser = { id: '2', phone_number: '010-1111-1111', role: 'client_admin', client_id: 10, password_version: 1 }

  it('superadmin은 모든 client 접근 가능', () => {
    expect(checkClientAccess(10, superadmin)).toBe(true)
    expect(checkClientAccess(99, superadmin)).toBe(true)
    expect(checkClientAccess(null, superadmin)).toBe(true)
  })

  it('client_admin은 자기 client만 접근 가능', () => {
    expect(checkClientAccess(10, clientAdmin)).toBe(true)
    expect(checkClientAccess(99, clientAdmin)).toBe(false)
  })

  it('client_admin은 미배정 리소스 접근 불가', () => {
    expect(checkClientAccess(null, clientAdmin)).toBe(false)
  })
})
