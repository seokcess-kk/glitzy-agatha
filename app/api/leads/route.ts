import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'

/**
 * 고객 기준 리드 조회 API (하이브리드 방식)
 * - 고객당 1행
 * - 각 고객의 모든 유입(leads) 이력 포함
 * - startDate 파라미터로 기간 필터링 가능
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoLeads } = await import('@/lib/demo/fixtures/extras')
    const url = new URL(req.url)
    return apiSuccess(demoLeads(clinicId, url.searchParams.get('startDate'), url.searchParams.get('endDate')))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  // Timestamp columns: KST midnight [start, end) pattern
  const dateStart = startDate ? getKstDateString(new Date(startDate)) : null
  const dateEnd = endDate ? getKstDateString(new Date(endDate)) : null
  const tsStart = dateStart ? `${dateStart}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (dateEnd) {
    const d = new Date(dateEnd + 'T00:00:00+09:00')
    d.setDate(d.getDate() + 1)
    tsEnd = d.toISOString()
  }

  const landingPageId = url.searchParams.get('landing_page_id')
  const utmCampaign = url.searchParams.get('utm_campaign')
  const limitParam = url.searchParams.get('limit')
  const hasFilter = !!(landingPageId || utmCampaign)
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 500) : (hasFilter ? 500 : 100)

  // 고객 기준으로 조회, leads를 포함 (landing_page 정보 포함)
  let query = supabase
    .from('customers')
    .select(`
      *,
      leads(*, landing_page:landing_pages(id, name)),
      consultations(*),
      payments(*),
      bookings(*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered
  if (tsStart) query = query.gte('created_at', tsStart)
  if (tsEnd) query = query.lt('created_at', tsEnd)

  const { data: customers, error } = await query

  if (error) return apiError(error.message, 500)

  // leads가 있는 고객만 필터링 + 정렬 (최근 리드 기준)
  const lpId = landingPageId ? Number(landingPageId) : null
  const customersWithLeads = (customers || [])
    .filter(c => c.leads && c.leads.length > 0)
    .filter(c => {
      if (lpId) return c.leads.some((l: any) => l.landing_page_id === lpId)
      return true
    })
    .filter(c => {
      if (utmCampaign) return c.leads.some((l: any) => l.utm_campaign === utmCampaign)
      return true
    })
    .map(c => {
      // leads를 최신순 정렬
      const sortedLeads = [...c.leads].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const latestLead = sortedLeads[0]

      return {
        // 고객 정보
        id: c.id,
        customer_id: c.id,
        phone_number: c.phone_number,
        name: c.name,
        first_source: c.first_source,
        first_campaign_id: c.first_campaign_id,
        clinic_id: c.clinic_id,
        created_at: c.created_at,

        // 최신 리드 정보 (목록 표시용)
        latest_lead: latestLead,
        utm_source: latestLead?.utm_source,
        utm_medium: latestLead?.utm_medium,
        utm_campaign: latestLead?.utm_campaign,
        utm_content: latestLead?.utm_content,
        chatbot_sent: latestLead?.chatbot_sent,
        chatbot_sent_at: latestLead?.chatbot_sent_at,
        landing_page: latestLead?.landing_page,
        custom_data: latestLead?.custom_data,

        // 전체 유입 이력
        leads: sortedLeads,
        lead_count: sortedLeads.length,

        // 고객 정보 (기존 구조 호환)
        customer: {
          id: c.id,
          phone_number: c.phone_number,
          name: c.name,
          first_source: c.first_source,
          first_campaign_id: c.first_campaign_id,
          consultations: c.consultations || [],
          payments: c.payments || [],
          bookings: c.bookings || [],
        },
      }
    })
    .sort((a, b) => {
      // 최신 리드 기준 정렬
      const aTime = new Date(a.latest_lead?.created_at || a.created_at).getTime()
      const bTime = new Date(b.latest_lead?.created_at || b.created_at).getTime()
      return bTime - aTime
    })

  return apiSuccess(customersWithLeads)
})
