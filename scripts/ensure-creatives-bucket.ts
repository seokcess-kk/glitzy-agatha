/**
 * Supabase Storage 'creatives' 버킷 생성 (idempotent)
 * - public 버킷, 50MB 제한, 이미지/동영상 MIME만 허용
 * - 사용: node --env-file=.env.local --import tsx scripts/ensure-creatives-bucket.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const BUCKET = 'creatives'
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
]
const MAX_SIZE = 50 * 1024 * 1024

async function main() {
  const { data: list, error: listErr } = await supabase.storage.listBuckets()
  if (listErr) throw new Error(`버킷 목록 조회 실패: ${listErr.message}`)

  const existing = list?.find((b) => b.name === BUCKET)
  if (existing) {
    console.log(`버킷 '${BUCKET}' 이미 존재 — 옵션 갱신`)
    const { error } = await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_MIME,
    })
    if (error) throw new Error(`updateBucket 실패: ${error.message}`)
    console.log('완료')
    return
  }

  console.log(`버킷 '${BUCKET}' 생성`)
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ALLOWED_MIME,
  })
  if (error) throw new Error(`createBucket 실패: ${error.message}`)
  console.log('완료')
}

main().catch((e) => { console.error(e); process.exit(1) })
