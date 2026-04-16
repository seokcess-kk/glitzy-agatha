import { withClientAdmin, ClientContext, apiSuccess, apiError } from '@/lib/api-middleware'
import { syncClient, syncAllClients } from '@/lib/services/adSyncManager'

export const maxDuration = 120

// client_admin 이상만 수동 동기화 가능 (client_staff 차단)
export const POST = withClientAdmin(async (req: Request, { user, clientId }: ClientContext) => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (clientId) {
    // 특정 클라이언트 동기화
    const results = await syncClient(clientId, yesterday)
    return apiSuccess({
      success: true,
      results: results.map(r => ({
        clientId: r.clientId,
        clientName: r.clientName,
        platform: r.platform,
        count: r.count,
        error: r.error || null,
      })),
    })
  }

  // clientId 미지정 시 전체 동기화 — superadmin만 허용
  if (user.role !== 'superadmin') {
    return apiError('전체 동기화는 superadmin만 가능합니다.', 403)
  }

  const results = await syncAllClients(yesterday)
  return apiSuccess({
    success: true,
    results: results.map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      platform: r.platform,
      count: r.count,
      error: r.error || null,
    })),
  })
})
