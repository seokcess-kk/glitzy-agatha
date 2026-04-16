/**
 * Analysis 모듈
 * Repository + Service 통합: 키워드 스캔 + 분류 + 쿼리 변환 (1~3단계)
 */

import { createLogger } from '@/lib/logger'
import { getAllArticlesWithKeywords, findProcedure } from '@/lib/medichecker/ontology'
import { classifyContext, rewriteQuery } from '@/lib/medichecker/claude-client'
import type {
  KeywordPattern,
  KeywordMatch,
  KeywordScanResult,
  ClassificationResult,
} from '@/lib/medichecker/types'

const logger = createLogger('MediChecker:Analysis')

// ============================================================
// Repository Layer (키워드 패턴 캐시)
// ============================================================

let cachedPatterns: KeywordPattern[] | null = null

/**
 * 키워드 패턴 로드 (mc_law_articles.keywords[]에서 동적 로드)
 * keywords는 이미 정규식 패턴이므로 이스케이프하지 않음
 */
async function loadKeywordPatterns(): Promise<KeywordPattern[]> {
  if (cachedPatterns) {
    return cachedPatterns
  }

  const articles = await getAllArticlesWithKeywords()

  cachedPatterns = []

  for (const article of articles) {
    for (const keyword of article.keywords) {
      try {
        // keywords는 이미 정규식 패턴으로 저장됨 (예: "전[·\\-\\s]?후\\s*(비교|사진)")
        const pattern = new RegExp(keyword, 'gi')
        cachedPatterns.push({
          pattern,
          articleId: article.id,
          article: [article.article, article.clause, article.subclause]
            .filter(Boolean)
            .join(' '),
          category: article.title,
        })
      } catch (e) {
        logger.warn(`Invalid regex pattern for article ${article.id}: ${keyword}`, {
          action: 'loadPatterns',
        })
      }
    }
  }

  logger.info(`Loaded ${cachedPatterns.length} keyword patterns`, { action: 'loadPatterns' })
  return cachedPatterns
}

/**
 * 캐시 무효화 (패턴 업데이트 시)
 */
export function invalidatePatternCache(): void {
  cachedPatterns = null
}

// ============================================================
// Service Layer
// ============================================================

/**
 * 1단계: 규칙 기반 키워드 스캔
 * AI 호출 없음, ~50ms 목표
 */
export async function scanKeywords(text: string): Promise<KeywordScanResult> {
  const startTime = Date.now()
  const matches: KeywordMatch[] = []

  // 키워드 패턴 로드 (mc_law_articles에서 동적)
  const patterns = await loadKeywordPatterns()

  // 패턴 매칭
  for (const { pattern, articleId, article, category } of patterns) {
    let match: RegExpExecArray | null
    // 패턴 인덱스 리셋
    pattern.lastIndex = 0

    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        keyword: match[0],
        position: [match.index, match.index + match[0].length],
        articleId,
        article,
        category,
        confidence: 1.0,
      })
    }
  }

  // 중복 제거 (같은 위치에 여러 패턴 매칭 시)
  const uniqueMatches = deduplicateMatches(matches)

  return {
    matches: uniqueMatches,
    scannedLength: text.length,
    scanTimeMs: Date.now() - startTime,
  }
}

/**
 * 2단계: 컨텍스트 분류 (Claude Haiku)
 * 진료과목, 시술명, 핵심 주장 추출 + 온톨로지 연결
 */
export async function classifyContent(
  text: string,
  adType: string
): Promise<ClassificationResult> {
  const startTime = Date.now()

  // Claude Haiku로 분류
  const aiResult = await classifyContext(text, adType)

  // 시술명 → mc_procedures 테이블 매칭
  let procedureId: number | null = null
  if (aiResult.procedure) {
    const procedure = await findProcedure(
      aiResult.procedure,
      aiResult.specialty ?? undefined
    )
    if (procedure) {
      procedureId = procedure.id
    }
  }

  const result: ClassificationResult = {
    specialty: aiResult.specialty,
    procedure: aiResult.procedure,
    adType,
    claims: aiResult.claims,
    procedureId,
    classificationTimeMs: Date.now() - startTime,
  }

  return result
}

/**
 * 3단계: Query Rewriting (Claude Haiku)
 * 광고 표현 → 법률 검색어 변환
 */
export async function generateSearchQueries(
  text: string,
  classification: ClassificationResult
): Promise<{ queries: string[]; queryRewriteTimeMs: number }> {
  const startTime = Date.now()

  const queries = await rewriteQuery(text, {
    specialty: classification.specialty,
    procedure: classification.procedure,
    claims: classification.claims,
  })

  return {
    queries,
    queryRewriteTimeMs: Date.now() - startTime,
  }
}

/**
 * 1~3단계 통합 실행
 */
export async function analyzeText(
  text: string,
  adType: string
): Promise<{
  keywordScan: KeywordScanResult
  classification: ClassificationResult
  searchQueries: string[]
  totalTimeMs: number
}> {
  const startTime = Date.now()

  // 1, 2단계 병렬 실행
  const [keywordScan, classification] = await Promise.all([
    scanKeywords(text),
    classifyContent(text, adType),
  ])

  // 3단계: 쿼리 변환 (2단계 결과 필요)
  const { queries: searchQueries } = await generateSearchQueries(
    text,
    classification
  )

  logger.info('Analysis complete', {
    action: 'analyzeText',
    keywordMatches: keywordScan.matches.length,
    specialty: classification.specialty,
    procedure: classification.procedure,
    queryCount: searchQueries.length,
  })

  return {
    keywordScan,
    classification,
    searchQueries,
    totalTimeMs: Date.now() - startTime,
  }
}

/**
 * 중복 매칭 제거 (위치 기반)
 */
function deduplicateMatches(matches: KeywordMatch[]): KeywordMatch[] {
  const seen = new Set<string>()
  return matches.filter((match) => {
    const key = `${match.position[0]}-${match.position[1]}-${match.articleId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
