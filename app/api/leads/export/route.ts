/**
 * 리드 CSV 내보내기 API
 * - 리드 상태별/채널별/기간별 필터링
 * - 전화번호 마스킹 (010-****-5678)
 * - UTF-8 BOM 포함 (한글 인코딩 호환)
 * - 최대 5000건 제한
 * - clinic_admin 이상 권한 필요 (개인정보 내보내기)
 */

import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicAdmin, ClinicContext, applyClinicFilter, apiError } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString, toUtcDate } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-log'

const logger = createLogger('LeadsExport')
const MAX_EXPORT = 5000

/**
 * 전화번호 마스킹: 010-1234-5678 → 010-****-5678
 */
function maskPhone(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`
  }
  // 기타 형식은 중간 마스킹
  if (digits.length > 4) {
    return digits.slice(0, 3) + '*'.repeat(Math.max(digits.length - 7, 1)) + digits.slice(-4)
  }
  return phone
}

/**
 * CSV 셀 이스케이프: 쉼표/줄바꿈/따옴표가 있으면 따옴표로 감싸기
 */
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** 퍼널 단계 영문키 → 한글 라벨 매핑 */
const STAGE_LABELS: Record<string, string> = {
  lead: '리드',
  booked: '예약',
  visited: '방문',
  consulted: '상담',
  paid: '결제',
}

function getFunnelStageKey(customer: {
  bookings?: { status: string }[]
  consultations?: { status: string }[]
  payments?: { payment_amount?: number }[]
}): string {
  if (customer.payments && customer.payments.length > 0) return 'paid'
  const hasConsultDone = customer.consultations?.some(c =>
    ['방문완료', '상담중', '시술확정'].includes(c.status)
  )
  if (hasConsultDone) return 'consulted'
  const hasVisited = customer.bookings?.some(b =>
    ['visited', 'treatment_confirmed'].includes(b.status)
  )
  if (hasVisited) return 'visited'
  const hasBooked = customer.bookings?.some(b => b.status !== 'cancelled')
  if (hasBooked) return 'booked'
  return 'lead'
}

export const GET = withClinicAdmin(async (req: Request, { clinicId, assignedClinicIds, user }: ClinicContext) => {
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

  const channelParam = url.searchParams.get('channel')
  const stageParam = url.searchParams.get('stage')
  const landingPageId = url.searchParams.get('landing_page_id')
  const utmCampaign = url.searchParams.get('utm_campaign')

  // 입력 검증
  const channel = channelParam ? sanitizeString(channelParam, 50) : null
  const stage = stageParam ? sanitizeString(stageParam, 20) : null

  // 필요한 컬럼만 select
  let query = supabase
    .from('customers')
    .select(`
      id, name, phone_number, first_source, created_at, clinic_id,
      leads(id, utm_source, utm_campaign, landing_page_id, created_at, landing_page:landing_pages(id, name)),
      consultations(status),
      payments(payment_amount, treatment_name),
      bookings(status)
    `)
    .order('created_at', { ascending: false })
    .limit(MAX_EXPORT)

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) {
    return buildCsvResponse([])
  }
  query = filtered

  if (tsStart) query = query.gte('created_at', tsStart)
  if (tsEnd) query = query.lt('created_at', tsEnd)

  const { data: customers, error } = await query

  if (error) {
    logger.error('CSV 내보내기 데이터 조회 실패', error, { clinicId })
    return apiError('데이터 조회에 실패했습니다.', 500)
  }

  // 리드가 있는 고객만 필터링 + 변환
  const rows: CsvRow[] = []

  const lpId = landingPageId ? Number(landingPageId) : null

  for (const c of customers || []) {
    if (!c.leads || c.leads.length === 0) continue

    // 랜딩페이지 필터: 해당 랜딩페이지로 유입된 리드가 있는 고객만
    if (lpId && !c.leads.some((l: any) => l.landing_page_id === lpId)) continue

    // 캠페인 필터: 해당 캠페인으로 유입된 리드가 있는 고객만
    if (utmCampaign && !c.leads.some((l: any) => l.utm_campaign === utmCampaign)) continue

    const stageKey = getFunnelStageKey({
      bookings: c.bookings || [],
      consultations: c.consultations || [],
      payments: c.payments || [],
    })
    const stageLabel = STAGE_LABELS[stageKey] || stageKey

    // 퍼널 단계 필터 — 영문 키 또는 한글 라벨 모두 허용
    if (stage && stage !== 'all') {
      if (stageKey !== stage && stageLabel !== stage) continue
    }

    // 최신 리드 기준
    const sortedLeads = [...c.leads].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const latestLead = sortedLeads[0]
    const utmSource = latestLead?.utm_source || c.first_source || ''

    // 채널 필터
    if (channel && channel !== 'all') {
      const normalized = normalizeChannel(utmSource)
      if (normalized.toLowerCase() !== channel.toLowerCase() && utmSource.toLowerCase() !== channel.toLowerCase()) {
        continue
      }
    }

    const treatment = (c.payments || [])
      .map((p: any) => p.treatment_name)
      .filter(Boolean)
      .join(', ')

    rows.push({
      name: c.name || '',
      phone: maskPhone(c.phone_number),
      channel: normalizeChannel(utmSource),
      campaign: latestLead?.utm_campaign || '',
      stage: stageLabel,
      createdAt: getKstDateString(toUtcDate(c.created_at)),
      treatment: treatment || '',
      landingPage: (() => {
        const lp = latestLead?.landing_page as { id: number; name: string }[] | { id: number; name: string } | null
        if (!lp) return ''
        if (Array.isArray(lp)) return lp[0]?.name || ''
        return lp.name || ''
      })(),
    })
  }

  // 감사 로그 기록 (개인정보 내보내기)
  logActivity(supabase, {
    userId: parseInt(user.id, 10),
    clinicId: clinicId || 0,
    action: 'leads_csv_export',
    targetTable: 'customers',
    targetId: 0,
    detail: { rowCount: rows.length, filters: { channel, stage, startDate, endDate, landingPageId, utmCampaign } },
  }).catch(() => {})

  logger.info('CSV 내보내기 완료', { clinicId, userId: user.id, rowCount: rows.length })

  return buildCsvResponse(rows)
})

interface CsvRow {
  name: string
  phone: string
  channel: string
  campaign: string
  stage: string
  createdAt: string
  treatment: string
  landingPage: string
}

function buildCsvResponse(rows: CsvRow[]): NextResponse {
  const headers = ['이름', '전화번호', '유입채널', '캠페인', '퍼널단계', '유입일', '시술', '랜딩페이지']
  const lines = [
    headers.join(','),
    ...rows.map(r =>
      [r.name, r.phone, r.channel, r.campaign, r.stage, r.createdAt, r.treatment, r.landingPage]
        .map(escapeCsv)
        .join(',')
    ),
  ]

  // UTF-8 BOM + CSV 본문
  const bom = '\uFEFF'
  const csvContent = bom + lines.join('\r\n')

  const today = getKstDateString()
  const filename = `leads_export_${today}.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
