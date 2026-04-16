import { normalizeChannel } from '@/lib/channel'

describe('normalizeChannel', () => {
  it('표준 매체명으로 정규화', () => {
    expect(normalizeChannel('meta')).toBe('Meta')
    expect(normalizeChannel('facebook')).toBe('Meta')
    expect(normalizeChannel('fb')).toBe('Meta')
    expect(normalizeChannel('google')).toBe('Google')
    expect(normalizeChannel('gdn')).toBe('Google')
    expect(normalizeChannel('youtube')).toBe('YouTube')
    expect(normalizeChannel('yt')).toBe('YouTube')
    expect(normalizeChannel('tiktok')).toBe('TikTok')
    expect(normalizeChannel('naver')).toBe('Naver')
    expect(normalizeChannel('kakao')).toBe('Kakao')
    expect(normalizeChannel('instagram')).toBe('Instagram')
    expect(normalizeChannel('ig')).toBe('Instagram')
    expect(normalizeChannel('phone')).toBe('Phone')
    expect(normalizeChannel('direct')).toBe('Direct')
    expect(normalizeChannel('organic')).toBe('Organic')
  })

  it('대소문자 무관하게 정규화', () => {
    expect(normalizeChannel('META')).toBe('Meta')
    expect(normalizeChannel('Google')).toBe('Google')
    expect(normalizeChannel('TIKTOK')).toBe('TikTok')
  })

  it('null/undefined → Unknown', () => {
    expect(normalizeChannel(null)).toBe('Unknown')
    expect(normalizeChannel(undefined)).toBe('Unknown')
    expect(normalizeChannel('')).toBe('Unknown')
  })

  it('매핑에 없는 값은 원본 반환', () => {
    expect(normalizeChannel('custom_source')).toBe('custom_source')
  })
})
