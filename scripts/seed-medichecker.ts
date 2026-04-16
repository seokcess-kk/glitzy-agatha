/**
 * MediChecker 시드 데이터 적재 스크립트
 *
 * 사용법:
 *   npx tsx scripts/seed-medichecker.ts
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 순서: law_articles → procedures → chunks → relations
 * (relations는 law_articles/procedures/chunks ID에 의존하므로 마지막)
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.')
  console.error('   .env.local 파일을 로드하려면: npx dotenv -e .env.local -- npx tsx scripts/seed-medichecker.ts')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const SEED_DIR = path.join(process.cwd(), 'data', 'medichecker-seed')

function loadJson<T>(filename: string): T {
  const filePath = path.join(SEED_DIR, filename)
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

// ============================================================
// Seed Functions
// ============================================================

async function seedLawArticles() {
  const articles = loadJson<Array<{
    id: number
    article: string
    clause: string
    subclause: string
    title: string
    summary: string
    fullText: string | null
    penalty: string | null
    keywords: string[]
    detectionDifficulty: string
  }>>('law-articles.json')

  const rows = articles.map((a) => ({
    id: a.id,
    article: a.article,
    clause: a.clause,
    subclause: a.subclause,
    title: a.title,
    summary: a.summary,
    full_text: a.fullText,
    penalty: a.penalty,
    keywords: a.keywords,
    detection_difficulty: a.detectionDifficulty,
  }))

  const { error } = await supabase
    .from('mc_law_articles')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`mc_law_articles 시딩 실패: ${error.message}`)
  console.log(`✅ mc_law_articles: ${rows.length}건 적재`)
}

async function seedProcedures() {
  const procedures = loadJson<Array<{
    id: number
    name: string
    specialty: string
    aliases: string[]
    requiredDisclosures: string[]
    commonViolations: string[]
    specialRegulations: string[]
  }>>('procedures.json')

  const rows = procedures.map((p) => ({
    id: p.id,
    name: p.name,
    specialty: p.specialty,
    aliases: p.aliases,
    required_disclosures: p.requiredDisclosures,
    common_violations: p.commonViolations,
    special_regulations: p.specialRegulations,
  }))

  const { error } = await supabase
    .from('mc_procedures')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`mc_procedures 시딩 실패: ${error.message}`)
  console.log(`✅ mc_procedures: ${rows.length}건 적재`)
}

async function seedChunks() {
  const lawChunks = loadJson<Array<{
    id: number
    content: string
    metadata: Record<string, unknown>
    articleId: number | null
    procedureId: number | null
  }>>('law-chunks.json')

  const guidelineChunks = loadJson<typeof lawChunks>('guidelines-chunks.json')
  const caseChunks = loadJson<typeof lawChunks>('cases-chunks.json')

  const allChunks = [...lawChunks, ...guidelineChunks, ...caseChunks]

  const rows = allChunks.map((c) => ({
    id: c.id,
    content: c.content,
    metadata: c.metadata,
    article_id: c.articleId,
    procedure_id: c.procedureId,
    // embedding은 별도 스크립트에서 생성
  }))

  const { error } = await supabase
    .from('mc_chunks')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`mc_chunks 시딩 실패: ${error.message}`)
  console.log(`✅ mc_chunks: ${rows.length}건 적재 (임베딩 미포함)`)
}

async function seedRelations() {
  const relations = loadJson<Array<{
    id: number
    sourceType: string
    sourceId: number
    relationType: string
    targetType: string
    targetId: number
    weight: number
    metadata: Record<string, unknown>
  }>>('relations.json')

  const rows = relations.map((r) => ({
    id: r.id,
    source_type: r.sourceType,
    source_id: r.sourceId,
    relation_type: r.relationType,
    target_type: r.targetType,
    target_id: r.targetId,
    weight: r.weight,
    metadata: r.metadata,
  }))

  const { error } = await supabase
    .from('mc_relations')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`mc_relations 시딩 실패: ${error.message}`)
  console.log(`✅ mc_relations: ${rows.length}건 적재`)
}

// ============================================================
// Sequence Reset (upsert 후 시퀀스 동기화)
// ============================================================

async function resetSequences() {
  const tables = [
    { table: 'mc_law_articles', seq: 'mc_law_articles_id_seq' },
    { table: 'mc_procedures', seq: 'mc_procedures_id_seq' },
    { table: 'mc_chunks', seq: 'mc_chunks_id_seq' },
    { table: 'mc_relations', seq: 'mc_relations_id_seq' },
  ]

  for (const { table, seq } of tables) {
    const { error } = await supabase.rpc('exec_sql' as never, {
      sql: `SELECT setval('${seq}', (SELECT COALESCE(MAX(id), 0) FROM ${table}) + 1, false)`,
    })
    // exec_sql이 없을 수 있음 — 무시
    if (error && !error.message.includes('function') && !error.message.includes('does not exist')) {
      console.warn(`⚠️ ${seq} 시퀀스 리셋 실패 (수동 실행 필요): ${error.message}`)
    }
  }
  console.log('✅ 시퀀스 리셋 시도 완료 (실패 시 수동으로 실행하세요)')
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('🚀 MediChecker 시드 데이터 적재 시작...\n')

  try {
    // 순서 중요: FK 의존성
    await seedLawArticles()
    await seedProcedures()
    await seedChunks()
    await seedRelations()
    await resetSequences()

    console.log('\n✅ 시드 데이터 적재 완료!')
    console.log('')
    console.log('다음 단계:')
    console.log('  1. 임베딩 생성: npx dotenv -e .env.local -- npx tsx scripts/seed-medichecker-embeddings.ts')
    console.log('  2. IVFFlat 인덱스 생성 (Supabase SQL Editor):')
    console.log('     CREATE INDEX idx_mc_chunks_embedding ON mc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);')
  } catch (error) {
    console.error('\n❌ 시딩 실패:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
