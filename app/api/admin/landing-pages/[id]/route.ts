import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess, AuthContext } from '@/lib/api-middleware'
import { sanitizeString, sanitizeUrl, parseId } from '@/lib/security'
import { archiveBeforeDelete } from '@/lib/archive'
import { createLogger } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

const logger = createLogger('LandingPageDetail')

function getLpIdFromUrl(req: Request): number | null {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const idStr = pathParts[pathParts.length - 1]
  return parseId(idStr)
}

export const GET = withSuperAdmin(async (req: Request, { user }: AuthContext) => {
  const lpId = getLpIdFromUrl(req)
  if (lpId === null) {
    return apiError('유효하지 않은 ID입니다.', 400)
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('landing_pages')
    .select('*, clinic:clinics(id, name)')
    .eq('id', lpId)
    .single()

  if (error || !data) {
    return apiError('랜딩 페이지를 찾을 수 없습니다.', 404)
  }

  return apiSuccess(data)
})

export const PUT = withSuperAdmin(async (req: Request, { user }: AuthContext) => {
  try {
    const lpId = getLpIdFromUrl(req)
    if (lpId === null) {
      return apiError('유효하지 않은 ID입니다.', 400)
    }

    const body = await req.json()
    const { name, file_name, original_file_name, clinic_id, description, is_active, gtm_id, redirect_url } = body

    const supabase = serverSupabase()

    // 기존 데이터 확인 (file_name 포함 — 변경 여부 비교용)
    const { data: existing } = await supabase
      .from('landing_pages')
      .select('id, file_name')
      .eq('id', lpId)
      .single()

    if (!existing) {
      return apiError('랜딩 페이지를 찾을 수 없습니다.', 404)
    }

    // 파일명이 실제로 변경된 경우에만 존재 여부 확인
    if (file_name && file_name !== existing.file_name) {
      const { data: storageFiles } = await supabase.storage
        .from('landing-pages')
        .list()
      const inStorage = storageFiles?.some(f => f.name === file_name)
      const localPath = path.join(process.cwd(), 'public', 'landing', file_name)
      if (!inStorage && !fs.existsSync(localPath)) {
        return apiError(`파일을 찾을 수 없습니다: ${file_name}`, 400)
      }
    }

    // clinic_id 유효성 검증
    let validClinicId: number | null | undefined = undefined
    if (clinic_id !== undefined) {
      if (clinic_id === null || clinic_id === '') {
        validClinicId = null
      } else {
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
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = sanitizeString(name, 100)
    if (file_name !== undefined) updateData.file_name = sanitizeString(file_name, 100)
    if (original_file_name !== undefined) updateData.original_file_name = original_file_name ? sanitizeString(original_file_name, 200) : null
    if (validClinicId !== undefined) updateData.clinic_id = validClinicId
    if (description !== undefined) updateData.description = description ? sanitizeString(description, 500) : null
    if (gtm_id !== undefined) updateData.gtm_id = gtm_id ? sanitizeString(gtm_id, 20) : null
    if (redirect_url !== undefined) updateData.redirect_url = redirect_url ? sanitizeUrl(redirect_url, 2000) || null : null
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabase
      .from('landing_pages')
      .update(updateData)
      .eq('id', lpId)
      .select('*, clinic:clinics(id, name)')
      .single()

    if (error) return apiError(error.message, 500)

    // DB 업데이트 성공 후 기존 Storage 파일 정리 (file_name이 변경된 경우, 다른 LP가 참조하지 않을 때만)
    if (file_name && file_name !== existing.file_name && /^[a-zA-Z0-9_.-]+$/.test(existing.file_name)) {
      const { count } = await supabase
        .from('landing_pages')
        .select('id', { count: 'exact', head: true })
        .eq('file_name', existing.file_name)

      if (!count) {
        await supabase.storage.from('landing-pages').remove([existing.file_name]).catch(() => {})
      }
    }

    return apiSuccess(data)
  } catch (err) {
    logger.error('랜딩페이지 수정 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

export const DELETE = withSuperAdmin(async (req: Request, { user }: AuthContext) => {
  try {
    const lpId = getLpIdFromUrl(req)
    if (lpId === null) {
      return apiError('유효하지 않은 ID입니다.', 400)
    }

    const supabase = serverSupabase()

    // 삭제 전 file_name 조회 (Storage 파일 삭제용)
    const { data: existing } = await supabase
      .from('landing_pages')
      .select('file_name')
      .eq('id', lpId)
      .single()

    await archiveBeforeDelete(supabase, 'landing_pages', lpId, user.id)
    const { error } = await supabase
      .from('landing_pages')
      .delete()
      .eq('id', lpId)

    if (error) return apiError(error.message, 500)

    // DB 삭제 성공 후 Storage 파일 삭제 (같은 파일을 쓰는 다른 랜딩페이지가 없을 때만)
    if (existing?.file_name) {
      const { count } = await supabase
        .from('landing_pages')
        .select('id', { count: 'exact', head: true })
        .eq('file_name', existing.file_name)

      if (!count) {
        await supabase.storage.from('landing-pages').remove([existing.file_name]).catch(() => {})
      }
    }

    return apiSuccess({ deleted: true })
  } catch (err) {
    logger.error('랜딩페이지 삭제 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
