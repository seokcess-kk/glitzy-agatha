/**
 * Ontology 모듈
 * Repository + Service 통합: 온톨로지 DB 접근 + 관계 기반 컨텍스트 확장
 */

import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import type {
  LawArticle,
  Procedure,
  Relation,
  RelatedChunk,
  SearchResult,
  EnrichedContext,
  RelationPath,
} from '@/lib/medichecker/types'

const logger = createLogger('MediChecker:Ontology')

// DB Row 타입 정의
interface LawArticleRow {
  id: number
  article: string
  clause: string | null
  subclause: string | null
  title: string
  summary: string
  full_text: string | null
  penalty: string | null
  keywords: string[]
  detection_difficulty: 'keyword' | 'context' | 'complex'
}

interface ProcedureRow {
  id: number
  name: string
  specialty: string
  aliases: string[]
  required_disclosures: string[] | null
  common_violations: string[] | null
  special_regulations: string[] | null
}

interface RelatedContextRow {
  chunk_id: number
  chunk_content: string
  chunk_metadata: Record<string, unknown>
  relation_type: string
  relation_source: string
}

interface RelationRow {
  id: number
  source_type: 'article' | 'procedure' | 'chunk' | 'keyword'
  source_id: number
  relation_type: string
  target_type: 'article' | 'procedure' | 'chunk' | 'keyword'
  target_id: number
  weight: number | null
  metadata: Record<string, unknown> | null
}

// ============================================================
// Repository Layer
// ============================================================

/**
 * 모든 법조항 + 키워드 조회 (1단계 스캔용)
 */
export async function getAllArticlesWithKeywords(): Promise<LawArticle[]> {
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('mc_law_articles')
    .select('*')
    .order('id')

  if (error) {
    logger.error('Failed to load law articles', error)
    throw error
  }

  return ((data ?? []) as LawArticleRow[]).map((row) => ({
    id: row.id,
    article: row.article,
    clause: row.clause,
    subclause: row.subclause,
    title: row.title,
    summary: row.summary,
    fullText: row.full_text,
    penalty: row.penalty,
    keywords: row.keywords ?? [],
    detectionDifficulty: row.detection_difficulty,
  }))
}

/**
 * 시술명으로 시술 찾기 (별칭 포함)
 */
export async function findProcedure(
  name: string,
  specialty?: string
): Promise<Procedure | null> {
  const supabase = serverSupabase()

  let query = supabase
    .from('mc_procedures')
    .select('*')
    .or(`name.ilike.%${name}%,aliases.cs.{${name}}`)

  if (specialty) {
    query = query.eq('specialty', specialty)
  }

  const { data, error } = await query.limit(1).single()

  if (error) return null

  const row = data as ProcedureRow
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    aliases: row.aliases ?? [],
    requiredDisclosures: row.required_disclosures ?? [],
    commonViolations: row.common_violations ?? [],
    specialRegulations: row.special_regulations ?? [],
  }
}

/**
 * 시술 ID로 조회
 */
export async function findProcedureById(id: number): Promise<Procedure | null> {
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('mc_procedures')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null

  const row = data as ProcedureRow
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    aliases: row.aliases ?? [],
    requiredDisclosures: row.required_disclosures ?? [],
    commonViolations: row.common_violations ?? [],
    specialRegulations: row.special_regulations ?? [],
  }
}

/**
 * 관계 기반 컨텍스트 확장 (1홉 탐색)
 */
async function getRelatedContext(
  articleIds: number[],
  procedureIds: number[]
): Promise<RelatedChunk[]> {
  const supabase = serverSupabase()

  const { data, error } = await supabase.rpc('mc_get_related_context', {
    input_article_ids: articleIds,
    input_procedure_ids: procedureIds,
  } as unknown as undefined)

  if (error) {
    logger.error('Failed to get related context', error)
    throw error
  }

  return ((data ?? []) as RelatedContextRow[]).map((row) => ({
    chunkId: row.chunk_id,
    content: row.chunk_content,
    metadata: row.chunk_metadata,
    relationType: row.relation_type as RelatedChunk['relationType'],
    relationSource: row.relation_source,
  }))
}

/**
 * 모든 시술 조회
 */
export async function getAllProcedures(): Promise<Procedure[]> {
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('mc_procedures')
    .select('*')
    .order('id')

  if (error) {
    logger.error('Failed to load procedures', error)
    throw error
  }

  return ((data ?? []) as ProcedureRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    aliases: row.aliases ?? [],
    requiredDisclosures: row.required_disclosures ?? [],
    commonViolations: row.common_violations ?? [],
    specialRegulations: row.special_regulations ?? [],
  }))
}

/**
 * 모든 관계 조회
 */
export async function getAllRelations(): Promise<Relation[]> {
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('mc_relations')
    .select('*')
    .order('id')

  if (error) {
    logger.error('Failed to load relations', error)
    throw error
  }

  return ((data ?? []) as RelationRow[]).map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    relationType: row.relation_type as Relation['relationType'],
    targetType: row.target_type,
    targetId: row.target_id,
    weight: row.weight ?? 1,
    metadata: row.metadata ?? {},
  }))
}

// ============================================================
// Service Layer
// ============================================================

/**
 * 4.5단계: 관계 기반 컨텍스트 확장
 * 검색 결과의 article_id, procedure_id를 기반으로 관련 컨텍스트 수집
 */
export async function enrichContext(
  searchResults: SearchResult[],
  procedureId: number | null
): Promise<EnrichedContext> {
  // 검색 결과에서 article_id, procedure_id 수집
  const articleIds = [
    ...new Set(
      searchResults
        .map((r) => r.chunk.articleId)
        .filter((id): id is number => id !== null)
    ),
  ]

  const procedureIds = procedureId
    ? [procedureId]
    : [
        ...new Set(
          searchResults
            .map((r) => r.chunk.procedureId)
            .filter((id): id is number => id !== null)
        ),
      ]

  // 관계 기반 확장 (1홉 탐색)
  const relatedChunks = await getRelatedContext(articleIds, procedureIds)

  // 시술 특화 정보
  let procedureInfo: Procedure | null = null
  if (procedureIds.length > 0) {
    procedureInfo = await findProcedureById(procedureIds[0])
  }

  // 중복 제거 (이미 검색된 청크 제외)
  const existingIds = new Set(searchResults.map((r) => r.chunk.id))
  const newChunks = relatedChunks.filter((c) => !existingIds.has(c.chunkId))

  // 판단 근거 경로 생성
  const relationPaths = buildRelationPaths(relatedChunks)

  logger.debug('Context enriched', {
    action: 'enrichContext',
    articleIds: articleIds.length,
    procedureIds: procedureIds.length,
    relatedChunks: newChunks.length,
  })

  return {
    originalResultIds: searchResults.map((r) => r.chunk.id),
    relatedChunks: newChunks,
    procedureInfo,
    relationPaths,
  }
}

/**
 * 판단 근거 경로 생성 (5단계에 전달)
 * "제56조 제2항 제2호 -> relatedCase -> [사례 요약]"
 */
function buildRelationPaths(
  relatedChunks: RelatedChunk[]
): RelationPath[] {
  return relatedChunks.map((chunk) => ({
    path: `${chunk.relationSource} → ${chunk.relationType} → ${chunk.content.slice(0, 50)}...`,
    relationType: chunk.relationType,
  }))
}
