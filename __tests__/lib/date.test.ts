import { toUtcDate, getKstDateString, getKstDayStartISO, getKstDayEndISO } from '@/lib/date'

describe('toUtcDate', () => {
  it('Date 객체는 그대로 반환', () => {
    const d = new Date('2026-03-20T00:00:00Z')
    expect(toUtcDate(d)).toBe(d)
  })

  it('타임존 없는 문자열에 Z를 붙여 UTC로 해석', () => {
    const result = toUtcDate('2026-03-20T12:00:00')
    expect(result.toISOString()).toBe('2026-03-20T12:00:00.000Z')
  })

  it('Z가 이미 있는 문자열은 그대로 파싱', () => {
    const result = toUtcDate('2026-03-20T12:00:00Z')
    expect(result.toISOString()).toBe('2026-03-20T12:00:00.000Z')
  })

  it('+09:00 타임존 문자열도 정상 파싱', () => {
    const result = toUtcDate('2026-03-20T12:00:00+09:00')
    expect(result.toISOString()).toBe('2026-03-20T03:00:00.000Z')
  })
})

describe('getKstDateString', () => {
  it('YYYY-MM-DD 형식 반환', () => {
    const result = getKstDateString(new Date('2026-03-20T00:00:00Z'))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('UTC 자정은 KST 09시이므로 같은 날짜', () => {
    const result = getKstDateString(new Date('2026-03-20T00:00:00Z'))
    expect(result).toBe('2026-03-20')
  })
})

describe('getKstDayStartISO', () => {
  it('KST 00:00:00 = UTC 전날 15:00:00', () => {
    const result = getKstDayStartISO(new Date('2026-03-20T00:00:00Z'))
    // KST 2026-03-20 기준이므로 UTC 2026-03-19T15:00:00Z
    expect(result).toBe('2026-03-19T15:00:00.000Z')
  })
})

describe('getKstDayEndISO', () => {
  it('KST 23:59:59.999 = UTC 당일 14:59:59.999', () => {
    const result = getKstDayEndISO(new Date('2026-03-20T00:00:00Z'))
    expect(result).toBe('2026-03-20T14:59:59.999Z')
  })
})
