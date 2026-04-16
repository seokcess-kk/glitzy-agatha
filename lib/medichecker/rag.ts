/**
 * RAG (Retrieval-Augmented Generation) 모듈
 * Repository + Service 통합: 청크 검색 DB 접근 + Hybrid Search + RRF
 */

import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { embeddingProvider } from '@/lib/medichecker/embedding'
import type {
  Chunk,
  SearchResult,
  SearchQuery,
  HybridSearchConfig,
} from '@/lib/medichecker/types'

const logger = createLogger('MediChecker:RAG')

// DB Row 타입 정의
interface SearchResultRow {
  id: number
  content: string
  metadata: Chunk['metadata']
  article_id: number | null
  procedure_id: number | null
  similarity: number
}

interface ChunkRow {
  id: number
  content: string
  metadata: Chunk['metadata']
  article_id: number | null
  procedure_id: number | null
}

const DEFAULT_CONFIG: HybridSearchConfig = {
  semanticWeight: 0.6,
  keywordWeight: 0.4,
  topK: 10,
}

// ============================================================
// Repository Layer
// ============================================================

/**
 * 시맨틱 검색 (pgvector)
 */
async function searchSemantic(
  embedding: number[],
  limit: number = 10,
  filters?: { specialty?: string; adType?: string }
): Promise<SearchResult[]> {
  const supabase = serverSupabase()

  const { data, error } = await supabase.rpc('mc_search_similar_chunks', {
    query_embedding: embedding,
    match_count: limit,
    filter_specialty: filters?.specialty ?? null,
    filter_ad_type: filters?.adType ?? null,
  } as unknown as undefined)

  if (error) {
    logger.error('Semantic search failed', error)
    throw error
  }

  return ((data ?? []) as SearchResultRow[]).map((row) => ({
    chunk: {
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      articleId: row.article_id,
      procedureId: row.procedure_id,
    },
    similarity: row.similarity,
    searchType: 'semantic' as const,
  }))
}

/**
 * 키워드 검색 (pg_trgm)
 */
async function searchKeyword(
  queryText: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const supabase = serverSupabase()

  const { data, error } = await supabase.rpc('mc_search_keyword_chunks', {
    query_text: queryText,
    match_count: limit,
  } as unknown as undefined)

  if (error) {
    logger.error('Keyword search failed', error)
    throw error
  }

  return ((data ?? []) as (SearchResultRow & { sim_score?: number })[]).map((row) => ({
    chunk: {
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      articleId: row.article_id,
      procedureId: row.procedure_id,
    },
    similarity: row.similarity ?? row.sim_score ?? 0,
    searchType: 'keyword' as const,
  }))
}

/**
 * 청크 ID로 조회
 */
export async function findChunkById(id: number): Promise<Chunk | null> {
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('mc_chunks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null

  const row = data as ChunkRow
  return {
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    articleId: row.article_id,
    procedureId: row.procedure_id,
  }
}

// ============================================================
// Service Layer
// ============================================================

/**
 * Hybrid Search (시맨틱 + 키워드)
 * RRF(Reciprocal Rank Fusion)로 순위 결합
 */
export async function hybridSearch(
  query: SearchQuery,
  config: Partial<HybridSearchConfig> = {}
): Promise<SearchResult[]> {
  const { semanticWeight, keywordWeight, topK } = {
    ...DEFAULT_CONFIG,
    ...config,
  }

  // 임베딩 생성
  const embedding = query.embedding ?? await embeddingProvider.embed(query.text)

  // 병렬 검색
  const [semanticResults, keywordResults] = await Promise.all([
    searchSemantic(embedding, topK * 2, query.filters),
    searchKeyword(query.text, topK * 2),
  ])

  logger.debug('Hybrid search completed', {
    action: 'hybridSearch',
    semanticCount: semanticResults.length,
    keywordCount: keywordResults.length,
  })

  // RRF 순위 결합
  const combined = reciprocalRankFusion(
    semanticResults,
    keywordResults,
    semanticWeight,
    keywordWeight
  )

  return combined.slice(0, topK)
}

/**
 * RRF(Reciprocal Rank Fusion) 알고리즘
 * score = sum(weight / (k + rank)) for each result list
 */
function reciprocalRankFusion(
  semanticResults: SearchResult[],
  keywordResults: SearchResult[],
  semanticWeight: number,
  keywordWeight: number,
  k: number = 60
): SearchResult[] {
  const scores = new Map<number, { score: number; result: SearchResult }>()

  // 시맨틱 결과 점수
  semanticResults.forEach((result, index) => {
    const id = result.chunk.id
    const score = semanticWeight / (k + index + 1)
    const existing = scores.get(id)
    if (existing) {
      existing.score += score
    } else {
      scores.set(id, { score, result: { ...result, searchType: 'hybrid' } })
    }
  })

  // 키워드 결과 점수
  keywordResults.forEach((result, index) => {
    const id = result.chunk.id
    const score = keywordWeight / (k + index + 1)
    const existing = scores.get(id)
    if (existing) {
      existing.score += score
    } else {
      scores.set(id, { score, result: { ...result, searchType: 'hybrid' } })
    }
  })

  // 점수순 정렬
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result, score }) => ({
      ...result,
      similarity: score,
    }))
}
