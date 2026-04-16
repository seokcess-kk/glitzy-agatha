import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
}
const MAX_SIZE = 50 * 1024 * 1024 // 50MB
const BUCKET = 'creatives'

function sanitizeFileName(raw: string, mimeType: string): string {
  const nameOnly = raw.replace(/\.[^.]+$/, '')
  const safe = nameOnly.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_{2,}/g, '_')
  const ext = ALLOWED_TYPES[mimeType] || '.bin'
  return (safe || 'creative') + ext
}

// signed URL 발급 — 클라이언트가 Supabase Storage에 직접 업로드
export const POST = withSuperAdmin(async (req: Request) => {
  try {
    const { fileName: rawName, fileType, fileSize } = await req.json()

    if (!rawName || !fileType) {
      return apiError('fileName과 fileType이 필요합니다.', 400)
    }

    if (!ALLOWED_TYPES[fileType]) {
      return apiError('이미지(JPG, PNG, GIF, WebP) 또는 동영상(MP4, WebM)만 업로드 가능합니다.', 400)
    }

    if (fileSize && fileSize > MAX_SIZE) {
      return apiError('파일 크기는 50MB 이하여야 합니다.', 400)
    }

    const safeName = sanitizeFileName(sanitizeString(rawName, 200), fileType)
    const path = `${Date.now()}_${safeName}`

    const supabase = serverSupabase()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path)

    if (error) {
      return apiError('업로드 URL 생성 실패: ' + error.message, 500)
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path)

    return apiSuccess({
      signedUrl: data.signedUrl,
      fileName: path,
      publicUrl: urlData.publicUrl,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return apiError('업로드 URL 생성 실패: ' + message, 500)
  }
})
