import { fetchJSON } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import type {
  ERPQuote, ERPQuoteDetail, ERPInvoice, ERPPagination, ERPRespondResult,
} from '@/types/erp'

const logger = createLogger('ERPClient')

interface ERPListResponse<T> {
  success: boolean
  data: T[]
  pagination: ERPPagination
}

interface ERPDetailResponse<T> {
  success: boolean
  data: T
}

function getConfig() {
  const url = process.env.ERP_API_URL
  const key = process.env.ERP_SERVICE_KEY
  if (!url || !key) throw new Error('ERP_API_URL 또는 ERP_SERVICE_KEY 미설정')
  return { url, key }
}

async function erpFetch<T>(path: string, options?: {
  method?: string; body?: string
}): Promise<T> {
  const { url, key } = getConfig()
  const result = await fetchJSON<T>(`${url}${path}`, {
    method: options?.method || 'GET',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: options?.body,
    service: 'ERPClient',
    timeout: 15000,
    retries: 2,
  })

  if (!result.success) {
    logger.error('ERP API 호출 실패', { path, error: result.error, statusCode: result.statusCode })
    throw new Error(result.error || 'ERP API 호출 실패')
  }

  // glitzy-web 응답 레벨의 success 체크
  const body = result.data as T & { success?: boolean; error?: string }
  if (body && body.success === false) {
    logger.error('ERP API 응답 실패', { path, error: body.error })
    throw new Error(body.error || 'ERP API 응답 실패')
  }

  return result.data as T
}

export async function fetchQuotes(clinicId: number, params?: {
  status?: string; page?: number; limit?: number
}): Promise<ERPListResponse<ERPQuote>> {
  const sp = new URLSearchParams({ clinic_id: String(clinicId) })
  if (params?.status) sp.set('status', params.status)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.limit) sp.set('limit', String(params.limit))
  return erpFetch<ERPListResponse<ERPQuote>>(`/quotes?${sp}`)
}

export async function fetchQuoteDetail(clinicId: number, id: string): Promise<ERPDetailResponse<ERPQuoteDetail>> {
  return erpFetch<ERPDetailResponse<ERPQuoteDetail>>(`/quotes/${id}?clinic_id=${clinicId}`)
}

export async function fetchInvoices(clinicId: number, params?: {
  status?: string; page?: number; limit?: number
}): Promise<ERPListResponse<ERPInvoice>> {
  const sp = new URLSearchParams({ clinic_id: String(clinicId) })
  if (params?.status) sp.set('status', params.status)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.limit) sp.set('limit', String(params.limit))
  return erpFetch<ERPListResponse<ERPInvoice>>(`/invoices?${sp}`)
}

export async function fetchInvoiceDetail(clinicId: number, id: string): Promise<ERPDetailResponse<ERPInvoice>> {
  return erpFetch<ERPDetailResponse<ERPInvoice>>(`/invoices/${id}?clinic_id=${clinicId}`)
}

export async function respondToQuote(
  clinicId: number,
  quoteId: string,
  action: 'approve' | 'reject',
  reason?: string,
): Promise<ERPRespondResult> {
  return erpFetch<ERPRespondResult>(`/quotes/${quoteId}/respond`, {
    method: 'PATCH',
    body: JSON.stringify({ clinic_id: clinicId, action, reason }),
  })
}
