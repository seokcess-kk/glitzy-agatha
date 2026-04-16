import {
  parseUtmFromUrl,
  sanitizeUtmParam,
  sanitizeUtmParams,
  mergeUtmParams,
  buildUtmUrl,
  getUtmSourceLabel,
} from '@/lib/utm'

describe('parseUtmFromUrl', () => {
  it('URL에서 UTM 파라미터 추출', () => {
    const result = parseUtmFromUrl('https://example.com?utm_source=meta&utm_medium=cpc&utm_campaign=spring')
    expect(result.utm_source).toBe('meta')
    expect(result.utm_medium).toBe('cpc')
    expect(result.utm_campaign).toBe('spring')
  })

  it('UTM 없는 URL은 빈 값 반환', () => {
    const result = parseUtmFromUrl('https://example.com')
    expect(result.utm_source).toBeNull()
  })

  it('잘못된 URL은 빈 객체 반환', () => {
    const result = parseUtmFromUrl('not-a-url')
    expect(result).toEqual({})
  })
})

describe('sanitizeUtmParam', () => {
  it('XSS 위험 문자 제거', () => {
    expect(sanitizeUtmParam('<script>', 50)).toBe('script')
  })

  it('길이 제한 적용', () => {
    expect(sanitizeUtmParam('abcdefghij', 5)).toBe('abcde')
  })

  it('null/undefined → null', () => {
    expect(sanitizeUtmParam(null, 50)).toBeNull()
    expect(sanitizeUtmParam(undefined, 50)).toBeNull()
  })

  it('공백만 있으면 null', () => {
    expect(sanitizeUtmParam('   ', 50)).toBeNull()
  })
})

describe('sanitizeUtmParams', () => {
  it('모든 필드에 적절한 길이 제한 적용', () => {
    const result = sanitizeUtmParams({
      utm_source: 'a'.repeat(100),
      utm_campaign: 'b'.repeat(200),
    })
    expect(result.utm_source).toHaveLength(50)
    expect(result.utm_campaign).toHaveLength(100)
  })
})

describe('mergeUtmParams', () => {
  it('명시적 값이 URL 추출 값보다 우선', () => {
    const result = mergeUtmParams(
      { utm_source: 'explicit' },
      { utm_source: 'from_url', utm_medium: 'cpc', utm_campaign: null, utm_content: null, utm_term: null }
    )
    expect(result.utm_source).toBe('explicit')
    expect(result.utm_medium).toBe('cpc')
  })

  it('둘 다 없으면 null', () => {
    const result = mergeUtmParams({}, { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null })
    expect(result.utm_source).toBeNull()
  })
})

describe('buildUtmUrl', () => {
  it('UTM 파라미터 포함 URL 생성', () => {
    const url = buildUtmUrl({ baseUrl: 'https://example.com', source: 'meta', medium: 'cpc', campaign: 'spring' })
    expect(url).toContain('utm_source=meta')
    expect(url).toContain('utm_medium=cpc')
    expect(url).toContain('utm_campaign=spring')
  })

  it('http 없으면 자동 추가', () => {
    const url = buildUtmUrl({ baseUrl: 'example.com', source: 'meta' })
    expect(url).toMatch(/^https:\/\//)
  })

  it('빈 baseUrl은 null 반환', () => {
    expect(buildUtmUrl({ baseUrl: '' })).toBeNull()
    expect(buildUtmUrl({ baseUrl: '   ' })).toBeNull()
  })

  it('adGroup + content 결합', () => {
    const url = buildUtmUrl({ baseUrl: 'https://example.com', adGroup: 'group1', content: 'banner' })
    expect(url).toContain('utm_content=group1_banner')
  })
})

describe('getUtmSourceLabel', () => {
  it('표준 라벨 변환', () => {
    expect(getUtmSourceLabel('meta')).toBe('Meta')
    expect(getUtmSourceLabel('google')).toBe('Google')
    expect(getUtmSourceLabel('facebook')).toBe('Meta')
  })

  it('null → Unknown', () => {
    expect(getUtmSourceLabel(null)).toBe('Unknown')
    expect(getUtmSourceLabel(undefined)).toBe('Unknown')
  })
})
