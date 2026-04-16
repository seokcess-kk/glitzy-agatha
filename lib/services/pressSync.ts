import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const SERVICE_NAME = 'PressSync'
const logger = createLogger(SERVICE_NAME)

interface PressItem {
  title: string
  source: string
  url: string
  published_at: string
}

interface NaverNewsItem {
  title: string
  originallink: string
  link: string
  description: string
  pubDate: string
}

interface NaverNewsResponse {
  lastBuildDate: string
  total: number
  start: number
  display: number
  items: NaverNewsItem[]
}

/** HTML 태그 및 엔티티 제거 */
function cleanHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim()
}

/** URL에서 도메인명 추출 (언론사명 대용) */
function extractSource(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    // 주요 언론사 매핑
    const sourceMap: Record<string, string> = {
      'chosun.com': '조선일보', 'joongang.co.kr': '중앙일보', 'donga.com': '동아일보',
      'hani.co.kr': '한겨레', 'khan.co.kr': '경향신문', 'mk.co.kr': '매일경제',
      'hankyung.com': '한국경제', 'sedaily.com': '서울경제', 'mt.co.kr': '머니투데이',
      'edaily.co.kr': '이데일리', 'newsis.com': '뉴시스', 'yna.co.kr': '연합뉴스',
      'ytn.co.kr': 'YTN', 'sbs.co.kr': 'SBS', 'kbs.co.kr': 'KBS',
      'mbc.co.kr': 'MBC', 'biz.chosun.com': '조선비즈', 'news1.kr': '뉴스1',
      'medisobizanews.com': '메디소비자뉴스', 'medigatenews.com': '메디게이트뉴스',
      'dailymedi.com': '데일리메디', 'doctorstimes.com': '의사신문',
    }
    return sourceMap[hostname] || hostname
  } catch {
    return 'Unknown'
  }
}

async function fetchNaverNews(query: string): Promise<PressItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.')
  }

  const params = new URLSearchParams({
    query,
    display: '100',
    sort: 'date',
  })

  const res = await fetch(`https://openapi.naver.com/v1/search/news.json?${params}`, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Naver API HTTP ${res.status}: ${body}`)
  }

  const data: NaverNewsResponse = await res.json()

  return data.items.map(item => ({
    title: cleanHtml(item.title),
    url: item.originallink || item.link,
    source: extractSource(item.originallink || item.link),
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
  }))
}

export interface PressSyncResult {
  inserted: number
  errors: string[]
}

export async function syncPressForClinic(clinicId: number | null): Promise<PressSyncResult> {
  const supabase = serverSupabase()
  const startTime = Date.now()

  let clinicsQuery = supabase.from('clinics').select('id, name')
  if (clinicId) clinicsQuery = clinicsQuery.eq('id', clinicId)
  const { data: clinics } = await clinicsQuery
  if (!clinics?.length) return { inserted: 0, errors: ['병원을 찾을 수 없습니다.'] }

  let totalInserted = 0
  const errors: string[] = []

  for (const clinic of clinics) {
    try {
      // 기존 기사 삭제 후 현재 키워드 기준으로 새로 수집
      const { error: deleteError } = await supabase
        .from('press_coverage')
        .delete()
        .eq('clinic_id', clinic.id)

      if (deleteError) {
        errors.push(`Clinic ${clinic.id}: 기존 기사 삭제 실패 - ${deleteError.message}`)
        continue
      }

      // press_keywords에서 활성 키워드 조회
      const { data: keywords } = await supabase
        .from('press_keywords')
        .select('id, keyword')
        .eq('clinic_id', clinic.id)
        .eq('is_active', true)

      // 키워드가 없으면 병원명으로 폴백
      const searchTargets: { keywordId: number | null; query: string }[] =
        keywords && keywords.length > 0
          ? keywords.map(k => ({ keywordId: k.id, query: k.keyword }))
          : [{ keywordId: null, query: clinic.name }]

      // URL 중복 제거를 위한 Set
      const seenUrls = new Set<string>()

      for (const target of searchTargets) {
        try {
          const items = await fetchNaverNews(target.query)
          logger.info('Naver News fetch result', {
            action: 'fetch_news',
            clinicId: clinic.id,
            keyword: target.query,
            itemCount: items.length,
          })
          if (!items.length) continue

          const rows = items
            .filter(item => {
              if (seenUrls.has(item.url)) return false
              seenUrls.add(item.url)
              return true
            })
            .map(item => ({
              clinic_id: clinic.id,
              keyword_id: target.keywordId,
              title: item.title,
              source: item.source,
              url: item.url,
              published_at: item.published_at,
              collected_at: new Date().toISOString(),
            }))

          if (!rows.length) continue

          const { error } = await supabase
            .from('press_coverage')
            .insert(rows)

          if (error) {
            errors.push(`Clinic ${clinic.id} keyword "${target.query}": DB error - ${error.message}`)
          } else {
            totalInserted += rows.length
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push(`Clinic ${clinic.id} keyword "${target.query}": ${message}`)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Clinic ${clinic.id}: ${message}`)
    }
  }

  const duration = Date.now() - startTime

  if (errors.length > 0) {
    logger.warn('Sync completed with errors', {
      action: 'sync',
      clinicsProcessed: clinics.length,
      totalInserted,
      errorCount: errors.length,
      duration
    })
  } else {
    logger.info('Sync completed', {
      action: 'sync',
      clinicsProcessed: clinics.length,
      totalInserted,
      duration
    })
  }

  return { inserted: totalInserted, errors }
}
