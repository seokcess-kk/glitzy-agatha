/**
 * MediChecker 임베딩 생성 스크립트
 *
 * mc_chunks 테이블의 embedding 컬럼을 OpenAI API로 채웁니다.
 * 이미 임베딩이 있는 행은 건너뜁니다.
 *
 * 사용법:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-medichecker-embeddings.ts
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.')
  process.exit(1)
}
if (!openaiKey) {
  console.error('❌ OPENAI_API_KEY가 필요합니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiKey })

const MODEL = 'text-embedding-3-small'
const DIMENSION = 1536
const BATCH_SIZE = 20 // OpenAI 배치 크기

interface ChunkRow {
  id: number
  content: string
}

/**
 * 텍스트 정규화 (임베딩 전처리)
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000) // 토큰 제한 대응
}

/**
 * 배치 임베딩 생성
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const normalized = texts.map(normalizeText)

  const response = await openai.embeddings.create({
    model: MODEL,
    input: normalized,
  })

  return response.data.map((d) => d.embedding)
}

/**
 * 임베딩이 없는 청크 조회
 */
async function getChunksWithoutEmbedding(): Promise<ChunkRow[]> {
  const { data, error } = await supabase
    .from('mc_chunks')
    .select('id, content')
    .is('embedding', null)
    .order('id')

  if (error) throw new Error(`청크 조회 실패: ${error.message}`)
  return (data ?? []) as ChunkRow[]
}

/**
 * 임베딩 업데이트 (단건)
 */
async function updateEmbedding(id: number, embedding: number[]): Promise<void> {
  const { error } = await supabase
    .from('mc_chunks')
    .update({ embedding: `[${embedding.join(',')}]` })
    .eq('id', id)

  if (error) throw new Error(`청크 ${id} 임베딩 업데이트 실패: ${error.message}`)
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('🚀 MediChecker 임베딩 생성 시작...\n')
  console.log(`   모델: ${MODEL} (${DIMENSION}차원)`)
  console.log(`   배치: ${BATCH_SIZE}건씩\n`)

  const chunks = await getChunksWithoutEmbedding()

  if (chunks.length === 0) {
    console.log('✅ 임베딩이 필요한 청크가 없습니다. (모두 완료)')
    return
  }

  console.log(`📦 임베딩 대상: ${chunks.length}건\n`)

  let processed = 0
  let failed = 0

  // 배치 처리
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.content)

    try {
      const embeddings = await generateEmbeddings(texts)

      // 개별 업데이트 (배치 업데이트는 Supabase에서 지원하지 않으므로)
      for (let j = 0; j < batch.length; j++) {
        try {
          await updateEmbedding(batch[j].id, embeddings[j])
          processed++
        } catch (err) {
          console.error(`   ❌ 청크 ${batch[j].id} 업데이트 실패:`, err instanceof Error ? err.message : err)
          failed++
        }
      }

      console.log(`   ✅ ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} 완료`)

      // Rate limit 방지 (100ms 대기)
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } catch (err) {
      console.error(`   ❌ 배치 ${i}~${i + BATCH_SIZE} 임베딩 생성 실패:`, err instanceof Error ? err.message : err)
      failed += batch.length
    }
  }

  console.log(`\n✅ 임베딩 생성 완료!`)
  console.log(`   성공: ${processed}건, 실패: ${failed}건`)

  if (failed === 0) {
    console.log('')
    console.log('다음 단계 — IVFFlat 인덱스 생성 (Supabase SQL Editor):')
    console.log('  CREATE INDEX idx_mc_chunks_embedding ON mc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);')
  }
}

main()
