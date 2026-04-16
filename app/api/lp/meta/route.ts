import { NextRequest } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { parseId } from '@/lib/security'
import { apiSuccess, apiError } from '@/lib/api-middleware'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lpId = parseId(searchParams.get('id') ?? undefined)

  if (!lpId) {
    return apiError('유효한 ID가 필요합니다.')
  }

  const supabase = serverSupabase()
  const { data } = await supabase
    .from('landing_pages')
    .select('name')
    .eq('id', lpId)
    .eq('is_active', true)
    .single()

  return apiSuccess({ name: data?.name || '랜딩 페이지' })
}
