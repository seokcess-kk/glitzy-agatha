import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const BUCKET = 'landing-pages'
const logger = createLogger('LandingPageUpload')

// 파일명 안전하게 정제 (ASCII만 허용 — Supabase Storage는 non-ASCII 거부)
// 타임스탬프 suffix로 파일명 충돌 방지
// 예: '신사세레아의원.html' → 'lp_20260406_143522.html'
// 예: 'serea_promo.html' → 'serea_promo_1712534400.html'
function sanitizeFileName(raw: string): string {
  const ext = '.html'
  const ts = Math.floor(Date.now() / 1000)
  const nameOnly = raw
    .replace(/\.html?$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
  // ASCII 부분이 없는 경우 (한글 등) → 날짜+시간 기반 파일명 생성
  if (!nameOnly) {
    const now = new Date()
    const isoTs = now.toISOString().replace(/[-:T]/g, '').slice(0, 15)
    return `lp_${isoTs.slice(0, 8)}_${isoTs.slice(8)}${ext}`
  }
  return `${nameOnly}_${ts}${ext}`
}

export const POST = withSuperAdmin(async (req: Request) => {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const overwrite = formData.get('overwrite') as string | null

    if (!file) {
      return apiError('파일이 첨부되지 않았습니다.', 400)
    }

    if (!file.name.match(/\.html?$/i)) {
      return apiError('HTML 파일만 업로드할 수 있습니다. (.html)', 400)
    }

    if (file.size > 5 * 1024 * 1024) {
      return apiError('파일 크기는 5MB 이하여야 합니다.', 400)
    }

    const supabase = serverSupabase()
    // 기존 LP 수정 시 동일 파일명으로 덮어쓰기, 신규는 타임스탬프 suffix로 충돌 방지
    const fileName = overwrite || sanitizeFileName(file.name)
    const content = await file.arrayBuffer()

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, Buffer.from(content), {
        contentType: 'text/html',
        upsert: true,
      })

    if (error) {
      logger.error('파일 업로드 실패', error, { fileName })
      return apiError(`파일 업로드 실패: ${error.message}`, 500)
    }

    return apiSuccess({ fileName, originalFileName: file.name })
  } catch (error) {
    logger.error('랜딩페이지 업로드 처리 오류', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
