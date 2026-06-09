import { createLogger } from '@/lib/logger'

type SupabaseClient = ReturnType<typeof import('@/lib/supabase').serverSupabase>

const logger = createLogger('CreativeStorage')

export const CREATIVES_BUCKET = 'creatives'

// 안전한 storage 경로(영숫자/_/-/. 만 허용)인지 — 경로 조작/임의 삭제 방지
const SAFE_PATH = /^[a-zA-Z0-9_.-]+$/

/**
 * creatives 버킷의 파일을 삭제하되, 다른 ad_creatives 레코드가
 * 동일 file_name 을 참조 중이면(복사본 공유 등) 보존한다.
 *
 * - fileName 이 없거나 안전하지 않은 경로면 no-op
 * - excludeId: 참조 카운트에서 제외할 소재 ID(수정/삭제 대상 자신)
 * - best-effort: 실패해도 throw 하지 않고 warn 로깅만
 */
export async function removeCreativeFileIfUnreferenced(
  supabase: SupabaseClient,
  fileName: string | null | undefined,
  excludeId?: number,
): Promise<void> {
  if (!fileName || !SAFE_PATH.test(fileName)) return

  try {
    let query = supabase
      .from('ad_creatives')
      .select('id', { count: 'exact', head: true })
      .eq('file_name', fileName)
    if (excludeId !== undefined) {
      query = query.neq('id', excludeId)
    }
    const { count } = await query

    if (count) return // 다른 소재가 사용 중 → 보존
    await supabase.storage.from(CREATIVES_BUCKET).remove([fileName])
  } catch (e) {
    logger.warn('creatives 파일 정리 실패', { fileName, error: e })
  }
}
