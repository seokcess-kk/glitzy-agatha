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

// glitzy-web에 거래처 생성
export async function createErpClient(data: {
  name: string
  business_number?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
}): Promise<{ id: number; name: string }> {
  return erpFetch<{ success: boolean; data: { id: number; name: string } }>('/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(res => res.data)
}

// glitzy-web 거래처 목록 조회
export async function fetchErpClients(params?: {
  search?: string; page?: number; limit?: number
}): Promise<{ data: Array<{ id: number; name: string; business_number?: string }>; pagination: ERPPagination }> {
  const sp = new URLSearchParams()
  if (params?.search) sp.set('search', params.search)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.limit) sp.set('limit', String(params.limit || 50))
  return erpFetch(`/clients?${sp}`)
}

export async function fetchQuotes(erpClientId: number, params?: {
  status?: string; page?: number; limit?: number
}): Promise<ERPListResponse<ERPQuote>> {
  // glitzy-web API는 clinic_id 파라미터를 기대 (외부 API 인터페이스 유지)
  const sp = new URLSearchParams({ clinic_id: String(erpClientId) })
  if (params?.status) sp.set('status', params.status)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.limit) sp.set('limit', String(params.limit))
  return erpFetch<ERPListResponse<ERPQuote>>(`/quotes?${sp}`)
}

export async function fetchQuoteDetail(erpClientId: number, id: string): Promise<ERPDetailResponse<ERPQuoteDetail>> {
  return erpFetch<ERPDetailResponse<ERPQuoteDetail>>(`/quotes/${id}?clinic_id=${erpClientId}`)
}

export async function fetchInvoices(erpClientId: number, params?: {
  status?: string; page?: number; limit?: number
}): Promise<ERPListResponse<ERPInvoice>> {
  const sp = new URLSearchParams({ clinic_id: String(erpClientId) })
  if (params?.status) sp.set('status', params.status)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.limit) sp.set('limit', String(params.limit))
  return erpFetch<ERPListResponse<ERPInvoice>>(`/invoices?${sp}`)
}

export async function fetchInvoiceDetail(erpClientId: number, id: string): Promise<ERPDetailResponse<ERPInvoice>> {
  return erpFetch<ERPDetailResponse<ERPInvoice>>(`/invoices/${id}?clinic_id=${erpClientId}`)
}

export async function respondToQuote(
  erpClientId: number,
  quoteId: string,
  action: 'approve' | 'reject',
  reason?: string,
): Promise<ERPRespondResult> {
  // glitzy-web API는 clinic_id 필드를 기대
  return erpFetch<ERPRespondResult>(`/quotes/${quoteId}/respond`, {
    method: 'PATCH',
    body: JSON.stringify({ clinic_id: erpClientId, action, reason }),
  })
}
