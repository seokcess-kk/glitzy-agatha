import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString, toUtcDate } from '@/lib/date'

// GET /api/content/analytics?groupBy=campaign|month|post&startDate=...&endDate=...
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const groupBy = url.searchParams.get('groupBy') || 'campaign'
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

  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clinicId, assignedClinicIds }

  // 콘텐츠 포스트
  let postsQuery = supabase.from('content_posts').select('id, title, platform, utm_campaign, budget, published_at')
  postsQuery = applyClinicFilter(postsQuery, ctx)!
  if (tsStart) postsQuery = postsQuery.gte('published_at', tsStart)
  if (tsEnd) postsQuery = postsQuery.lt('published_at', tsEnd)
  const { data: posts } = await postsQuery
  if (!posts?.length) return apiSuccess([])

  // 리드 조회 (기간 필터 적용)
  let leadsQuery = supabase.from('leads').select('id, customer_id, campaign_id, created_at')
  leadsQuery = applyClinicFilter(leadsQuery, ctx)!
  if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
  if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)
  const { data: leads } = await leadsQuery

  // 결제 조회 (리드 고객 기준)
  const customerIds = [...new Set((leads || []).map((l: any) => l.customer_id))]
  const paymentsRes = customerIds.length
    ? await supabase.from('payments').select('customer_id, payment_amount').in('customer_id', customerIds)
    : { data: [] }

  const paymentByCustomer: Record<number, number> = {}
  for (const p of paymentsRes.data || []) {
    paymentByCustomer[p.customer_id] = (paymentByCustomer[p.customer_id] || 0) + Number(p.payment_amount)
  }

  // 리드 revenue 계산 헬퍼
  const calcRevenue = (matchedLeads: any[]) =>
    matchedLeads.reduce((s, l) => s + (paymentByCustomer[l.customer_id] || 0), 0)

  const PLATFORM_LABELS: Record<string, string> = {
    youtube: '유튜브', instagram_feed: '인스타 피드', instagram_reels: '인스타 릴스',
    tiktok: '틱톡', naver_blog: '네이버 블로그',
  }

  let result: any[] = []

  if (groupBy === 'platform') {
    const platformMap: Record<string, { posts: any[]; budget: number }> = {}
    for (const post of posts) {
      const plat = post.platform || 'unknown'
      if (!platformMap[plat]) platformMap[plat] = { posts: [], budget: 0 }
      platformMap[plat].posts.push(post)
      platformMap[plat].budget += (post.budget || 0)
    }

    result = Object.entries(platformMap).map(([platform, data]) => {
      const campaigns = [...new Set(data.posts.map((p: any) => p.utm_campaign).filter(Boolean))]
      const matchedLeads = (leads || []).filter((l: any) => campaigns.includes(l.campaign_id))
      const leadCount = matchedLeads.length
      const revenue = calcRevenue(matchedLeads)
      return {
        key: platform,
        label: PLATFORM_LABELS[platform] || platform,
        postCount: data.posts.length,
        budget: data.budget,
        leads: leadCount,
        revenue,
        cpl: leadCount > 0 && data.budget > 0 ? Math.round(data.budget / leadCount) : 0,
        roas: data.budget > 0 ? Math.round((revenue / data.budget) * 100) : 0,
      }
    })

  } else if (groupBy === 'campaign') {
    const campaigns = [...new Set(posts.map((p: any) => p.utm_campaign).filter(Boolean))] as string[]

    result = campaigns.map(campaign => {
      const campaignPosts = posts.filter((p: any) => p.utm_campaign === campaign)
      const budget = campaignPosts.reduce((s: number, p: any) => s + (p.budget || 0), 0)
      const matchedLeads = (leads || []).filter((l: any) => l.campaign_id === campaign)
      const leadCount = matchedLeads.length
      const revenue = calcRevenue(matchedLeads)

      return {
        key: campaign,
        label: campaign,
        postCount: campaignPosts.length,
        platforms: [...new Set(campaignPosts.map((p: any) => p.platform))],
        budget,
        leads: leadCount,
        revenue,
        cpl: leadCount > 0 && budget > 0 ? Math.round(budget / leadCount) : 0,
        roas: budget > 0 ? Math.round((revenue / budget) * 100) : 0,
      }
    })

    // 예산 있는 미분류 포스트도 포함
    const uncategorized = posts.filter((p: any) => !p.utm_campaign && (p.budget || 0) > 0)
    if (uncategorized.length) {
      const budget = uncategorized.reduce((s: number, p: any) => s + (p.budget || 0), 0)
      result.push({ key: '_none', label: '캠페인 미지정', postCount: uncategorized.length, platforms: [], budget, leads: 0, revenue: 0, cpl: 0, roas: 0 })
    }

  } else if (groupBy === 'month') {
    const monthMap: Record<string, { posts: any[]; budget: number }> = {}
    for (const post of posts) {
      const month = post.published_at
        ? getKstDateString(toUtcDate(post.published_at)).slice(0, 7)
        : '9999-99'
      if (!monthMap[month]) monthMap[month] = { posts: [], budget: 0 }
      monthMap[month].posts.push(post)
      monthMap[month].budget += (post.budget || 0)
    }

    result = Object.entries(monthMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => {
        const campaigns = [...new Set(data.posts.map((p: any) => p.utm_campaign).filter(Boolean))]
        const matchedLeads = (leads || []).filter((l: any) => campaigns.includes(l.campaign_id))
        const leadCount = matchedLeads.length
        const revenue = calcRevenue(matchedLeads)
        return {
          key: month,
          label: month === '9999-99' ? '미분류' : `${month.slice(0, 4)}년 ${month.slice(5, 7)}월`,
          postCount: data.posts.length,
          platforms: [...new Set(data.posts.map((p: any) => p.platform))],
          budget: data.budget,
          leads: leadCount,
          revenue,
          cpl: leadCount > 0 && data.budget > 0 ? Math.round(data.budget / leadCount) : 0,
          roas: data.budget > 0 ? Math.round((revenue / data.budget) * 100) : 0,
        }
      })

  } else {
    // groupBy === 'post'
    result = posts.map((post: any) => {
      const matchedLeads = (leads || []).filter((l: any) => l.campaign_id === post.utm_campaign)
      const leadCount = matchedLeads.length
      const revenue = calcRevenue(matchedLeads)
      return {
        key: String(post.id),
        label: post.title,
        platform: post.platform,
        postCount: 1,
        budget: post.budget || 0,
        leads: leadCount,
        revenue,
        cpl: leadCount > 0 && post.budget > 0 ? Math.round(post.budget / leadCount) : 0,
        roas: post.budget > 0 ? Math.round((revenue / post.budget) * 100) : 0,
      }
    })
  }

  return apiSuccess(result)
})
