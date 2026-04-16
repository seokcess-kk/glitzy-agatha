/**
 * MediChecker 통합 타입 정의
 * 의료 광고 검증 파이프라인 전체에서 사용하는 모델/상수
 */

// ============================================================
// Verification Model
// ============================================================

export interface VerifyRequest {
  text: string
  adType: 'blog' | 'instagram' | 'youtube' | 'other'
}

export interface Violation {
  type: 'expression' | 'omission'
  text: string
  article: string
  description: string
  confidence: number
  evidence: string
  relationPath?: string
  suggestion: string
  reviewNote?: string
  originalText?: string
  exampleFix?: string
  highlightRanges?: [number, number][]
}

export interface VerifyResult {
  violations: Violation[]
  riskScore: number
  summary: string
  metadata: {
    keywordMatches: number
    ragChunksUsed: number
    ontologyChunksUsed: number
    totalTimeMs: number
    stageTimings: Record<string, number>
  }
}

export type VerifyStage =
  | 'keyword_scan' | 'classification' | 'query_rewrite'
  | 'search' | 'relation_enrichment' | 'judgment' | 'verification' | 'complete'

export interface VerifyProgress {
  stage: VerifyStage
  status: 'running' | 'done'
  partialResult?: Partial<VerifyResult>
}

export type AdType = 'blog' | 'instagram' | 'youtube' | 'other'

export const AD_TYPE_LABELS: Record<AdType, string> = {
  blog: '블로그',
  instagram: '인스타그램',
  youtube: '유튜브',
  other: '기타',
}

export const STAGE_LABELS: Record<VerifyStage, string> = {
  keyword_scan: '키워드 스캔',
  classification: '분류 완료',
  query_rewrite: '쿼리 변환',
  search: '법령 검색',
  relation_enrichment: '관계 분석',
  judgment: 'AI 판단',
  verification: '검증 완료',
  complete: '완료',
}

// ============================================================
// RAG Model
// ============================================================

export interface Chunk {
  id: number
  content: string
  embedding?: number[]
  metadata: ChunkMetadata
  articleId: number | null
  procedureId: number | null
}

export interface ChunkMetadata {
  source: 'law' | 'guideline' | 'case'
  article?: string
  specialty?: string
  adType?: string
  year?: number
}

export interface SearchResult {
  chunk: Chunk
  similarity: number
  searchType: 'semantic' | 'keyword' | 'hybrid'
}

export interface SearchQuery {
  text: string
  embedding?: number[]
  filters?: { specialty?: string; adType?: string }
  limit?: number
}

export interface HybridSearchConfig {
  semanticWeight: number
  keywordWeight: number
  topK: number
}

// ============================================================
// Ontology Model
// ============================================================

export interface LawArticle {
  id: number
  article: string
  clause: string | null
  subclause: string | null
  title: string
  summary: string
  fullText: string | null
  penalty: string | null
  keywords: string[]
  detectionDifficulty: 'keyword' | 'context' | 'complex'
}

export interface Procedure {
  id: number
  name: string
  specialty: string
  aliases: string[]
  requiredDisclosures: string[]
  commonViolations: string[]
  specialRegulations: string[]
}

export type RelationType =
  | 'prohibits' | 'relatedCase' | 'appliesTo' | 'requiredDisclosure'
  | 'commonViolation' | 'hasSpecialRegulation' | 'similarTo' | 'parentOf'

export interface Relation {
  id: number
  sourceType: 'article' | 'procedure' | 'chunk' | 'keyword'
  sourceId: number
  relationType: RelationType
  targetType: 'article' | 'procedure' | 'chunk' | 'keyword'
  targetId: number
  weight: number
  metadata: Record<string, unknown>
}

export interface RelationPath {
  path: string
  relationType: RelationType
}

export interface RelatedChunk {
  chunkId: number
  content: string
  metadata: Record<string, unknown>
  relationType: RelationType
  relationSource: string
}

export interface EnrichedContext {
  originalResultIds: number[]
  relatedChunks: RelatedChunk[]
  procedureInfo: Procedure | null
  relationPaths: RelationPath[]
}

// ============================================================
// Analysis Model
// ============================================================

export interface KeywordPattern {
  pattern: RegExp
  articleId: number
  article: string
  category: string
}

export interface KeywordMatch {
  keyword: string
  position: [number, number]
  articleId: number
  article: string
  category: string
  confidence: number
}

export interface KeywordScanResult {
  matches: KeywordMatch[]
  scannedLength: number
  scanTimeMs: number
}

export interface ClassificationResult {
  specialty: string | null
  procedure: string | null
  adType: string
  claims: string[]
  procedureId: number | null
  classificationTimeMs?: number
}

export interface QueryRewriteResult {
  queries: string[]
  queryRewriteTimeMs: number
}

// ============================================================
// Claude Response Types
// ============================================================

export interface JudgmentResponse {
  violations: Violation[]
  riskScore: number
  summary: string
}

export interface VerificationResponse {
  verified: boolean
  modifications: Array<{
    action: 'remove' | 'add' | 'adjust'
    violationIndex?: number
    reason: string
  }>
  finalViolations: Violation[]
  finalRiskScore: number
  finalSummary: string
}

export interface ClassificationResponse {
  specialty: string | null
  procedure: string | null
  claims: string[]
}
