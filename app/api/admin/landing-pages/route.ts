import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, sanitizeUrl, parseId } from '@/lib/security'
import { createLogger } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

const logger = createLogger('LandingPages')

// 사용 가능한 HTML 파일 목록 조회 (Storage + 로컬 합산)
async function getAvailableHtmlFiles(supabase: ReturnType<typeof serverSupabase>): Promise<string[]> {
  const files = new Set<string>()

  // Supabase Storage
  const { data: storageFiles } = await supabase.storage.from('landing-pages').list()
  if (storageFiles) {
    for (const f of storageFiles) {
      if (f.name.endsWith('.html')) files.add(f.name)
    }
  }

  // 로컬 fallback (public/landing/)
  try {
    const landingDir = path.join(process.cwd(), 'public', 'landing')
    const localFiles = fs.readdirSync(landingDir)
    for (const f of localFiles) {
      if (f.endsWith('.html')) files.add(f)
    }
  } catch {}

  return [...files].sort()
}

export const GET = withSuperAdmin(async (req: Request) => {
  try {
    const url = new URL(req.url)
    const includeFiles = url.searchParams.get('includeFiles') === 'true'

    const supabase = serverSupabase()
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*, clinic:clinics(id, name)')
      .order('created_at', { ascending: false })

    if (error) return apiError(error.message, 500)

    if (includeFiles) {
      return apiSuccess({
        landingPages: data,
        availableFiles: await getAvailableHtmlFiles(supabase),
      })
    }

    return apiSuccess(data)
  } catch (err) {
    logger.error('랜딩페이지 목록 조회 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

// 8자리 랜덤 숫자 ID 생성 (10000000 ~ 99999999)
async function generateUniqueLpId(supabase: ReturnType<typeof serverSupabase>): Promise<number> {
  const MAX_ATTEMPTS = 10
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const id = Math.floor(10000000 + Math.random() * 90000000)
    const { data } = await supabase
      .from('landing_pages')
      .select('id')
      .eq('id', id)
      .single()
    if (!data) return id
  }
  throw new Error('고유 ID 생성에 실패했습니다. 다시 시도해주세요.')
}

export const POST = withSuperAdmin(async (req: Request) => {
  try {
    const body = await req.json()
    const { name, file_name, original_file_name, clinic_id, description, is_active, gtm_id, redirect_url } = body

    if (!name || !file_name) {
      return apiError('이름과 파일명은 필수입니다.', 400)
    }

    const safeFileName = path.basename(file_name)
    const supabase = serverSupabase()

    // 파일 존재 확인 (Storage 또는 로컬)
    const { data: storageFiles } = await supabase.storage.from('landing-pages').list('', { search: safeFileName })
    const inStorage = storageFiles?.some(f => f.name === safeFileName)
    const localPath = path.join(process.cwd(), 'public', 'landing', safeFileName)
    if (!inStorage && !fs.existsSync(localPath)) {
      return apiError(`파일을 찾을 수 없습니다: ${safeFileName}`, 400)
    }

    // clinic_id 유효성 검증 (제공된 경우)
    let validClinicId: number | null = null
    if (clinic_id) {
      validClinicId = parseId(clinic_id)
      if (validClinicId === null) {
        return apiError('유효하지 않은 병원 ID입니다.', 400)
      }

      const { data: clinic } = await supabase
        .from('clinics')
        .select('id')
        .eq('id', validClinicId)
        .single()

      if (!clinic) {
        return apiError('존재하지 않는 병원입니다.', 400)
      }
    }

    // 8자리 랜덤 ID 생성
    const newId = await generateUniqueLpId(supabase)

    const { data, error } = await supabase
      .from('landing_pages')
      .insert({
        id: newId,
        name: sanitizeString(name, 100),
        file_name: sanitizeString(safeFileName, 100),
        original_file_name: original_file_name ? sanitizeString(original_file_name, 200) : null,
        clinic_id: validClinicId,
        description: description ? sanitizeString(description, 500) : null,
        gtm_id: gtm_id ? sanitizeString(gtm_id, 20) : null,
        redirect_url: redirect_url ? sanitizeUrl(redirect_url, 2000) || null : null,
        is_active: is_active !== false,
      })
      .select('*, clinic:clinics(id, name)')
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (err) {
    logger.error('랜딩페이지 생성 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
