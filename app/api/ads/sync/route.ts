import { withClinicAdmin, ClinicContext, apiSuccess, apiError } from '@/lib/api-middleware'
import { syncClinic, syncAllClinics } from '@/lib/services/adSyncManager'

export const maxDuration = 120

// clinic_admin 이상만 수동 동기화 가능 (clinic_staff 차단)
export const POST = withClinicAdmin(async (req: Request, { user, clinicId }: ClinicContext) => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (clinicId) {
    // 특정 병원 동기화
    const results = await syncClinic(clinicId, yesterday)
    return apiSuccess({
      success: true,
      results: results.map(r => ({
        clinicId: r.clinicId,
        clinicName: r.clinicName,
        platform: r.platform,
        count: r.count,
        error: r.error || null,
      })),
    })
  }

  // clinicId 미지정 시 전체 동기화 — superadmin만 허용
  if (user.role !== 'superadmin') {
    return apiError('전체 동기화는 superadmin만 가능합니다.', 403)
  }

  const results = await syncAllClinics(yesterday)
  return apiSuccess({
    success: true,
    results: results.map(r => ({
      clinicId: r.clinicId,
      clinicName: r.clinicName,
      platform: r.platform,
      count: r.count,
      error: r.error || null,
    })),
  })
})
