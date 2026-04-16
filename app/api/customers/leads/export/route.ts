/**
 * 리드 CSV 내보내기 API
 * - 현재 필터 기준으로 리드 다운로드
 * - 전화번호 마스킹
 * - UTF-8 BOM 포함
 * - 최대 5000건
 * - client_admin 이상 권한 필요
 */

import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClientAdmin, ClientContext, applyClientFilter, apiError } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString, toUtcDate } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-log'

const logger = createLogger('CustomersLeadsExport')
const MAX_EXPORT = 5000

function maskPhone(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-****-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-***-${digits.slice(6)}`
  if (digits.length > 4) return digits.slice(0, 3) + '*'.repeat(Math.max(digits.length - 7, 1)) + digits.slice(-4)
  return phone
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const STATUS_LABELS: Record<string, string> = {
  new: '신규',
  in_progress: '진행중',
  converted: '전환',
  hold: '보류',
  lost: '미전환',
  invalid: '무효',
}

export const GET = withClientAdmin(async (req: Request, { clientId, assignedClientIds, user }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)

  const status = url.searchParams.get('status')
  const utmSource = url.searchParams.get('utm_source')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const campaign = url.searchParams.get('campaign')

  const tsStart = dateFrom ? `${getKstDateString(new Date(dateFrom))}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (dateTo) {
    const d = new Date(dateTo + 'T00:00:00+09:00')
    d.setDate(d.getDate() + 1)
    tsEnd = d.toISOString()
  }

  let query = supabase
    .from('leads')
    .select(`
      id, lead_status, utm_source, utm_campaign, conversion_value, lost_reason, conversion_memo, created_at,
      contact:contacts(id, name, phone_number, first_source),
      landing_page:landing_pages(id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(MAX_EXPORT)

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return buildCsvResponse([])
  query = filtered

  if (status && status !== 'all') query = query.eq('lead_status', status)
  if (utmSource && utmSource !== 'all') query = query.eq('utm_source', utmSource)
  if (campaign && campaign !== 'all') query = query.eq('utm_campaign', campaign)
  if (tsStart) query = query.gte('created_at', tsStart)
  if (tsEnd) query = query.lt('created_at', tsEnd)

  const { data: leads, error } = await query

  if (error) {
    logger.error('CSV 내보내기 데이터 조회 실패', error, { clientId })
    return apiError('데이터 조회에 실패했습니다.', 500)
  }

  const rows = (leads || []).map((l: any) => ({
    name: l.contact?.name || '',
    phone: maskPhone(l.contact?.phone_number),
    channel: normalizeChannel(l.utm_source || l.contact?.first_source),
    campaign: l.utm_campaign || '',
    status: STATUS_LABELS[l.lead_status] || l.lead_status || '',
    conversionValue: l.conversion_value ? String(l.conversion_value) : '',
    lostReason: l.lost_reason || '',
    memo: l.conversion_memo || '',
    createdAt: getKstDateString(toUtcDate(l.created_at)),
  }))

  logActivity(supabase, {
    userId: parseInt(user.id, 10),
    clientId: clientId || 0,
    action: 'leads_csv_export',
    targetTable: 'leads',
    targetId: 0,
    detail: { rowCount: rows.length, filters: { status, utmSource, dateFrom, dateTo, campaign } },
  }).catch(() => {})

  logger.info('CSV 내보내기 완료', { clientId, userId: user.id, rowCount: rows.length })

  return buildCsvResponse(rows)
})

interface CsvRow {
  name: string
  phone: string
  channel: string
  campaign: string
  status: string
  conversionValue: string
  lostReason: string
  memo: string
  createdAt: string
}

function buildCsvResponse(rows: CsvRow[]): NextResponse {
  const headers = ['이름', '전화번호', '유입채널', '캠페인', '상태', '전환금액', '미전환사유', '메모', '유입일']
  const lines = [
    headers.join(','),
    ...rows.map(r =>
      [r.name, r.phone, r.channel, r.campaign, r.status, r.conversionValue, r.lostReason, r.memo, r.createdAt]
        .map(escapeCsv)
        .join(',')
    ),
  ]

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
