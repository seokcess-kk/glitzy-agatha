'use client'

import { useState, useEffect, useCallback } from 'react'
import { normalizeChannel } from '@/lib/channel'

interface FetchState<T> {
  data: T | null
  loading: boolean
}

function buildQs(params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') qs.set(k, String(v))
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

// ─── KPI + 오늘 요약 ───
export function useKpiData(clientId: number | null, startDate: string, endDate: string) {
  const [state, setState] = useState<FetchState<any>>({ data: null, loading: true })

  const fetch_ = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const qs = buildQs({ startDate, endDate, compare: 'true', client_id: clientId })
      const res = await fetch(`/api/dashboard/kpi${qs}`)
      const json = await res.json()
      setState({ data: json, loading: false })
    } catch {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [clientId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { ...state, refetch: fetch_ }
}

// ─── 추이 ───
export function useTrendData(clientId: number | null, startDate: string, endDate: string) {
  const [trend, setTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      // 선택 기간과 최소 4주(28일) 중 긴 쪽 사용 (YYYY-MM-DD 형식 통일)
      const MIN_TREND_DAYS = 28
      const selectedStartDate = new Date(startDate)
      const minStartDate = new Date(Date.now() - MIN_TREND_DAYS * 86400000)
      const effectiveStart = selectedStartDate < minStartDate ? selectedStartDate : minStartDate
      const trendStart = effectiveStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
      const trendQs = buildQs({ startDate: trendStart, client_id: clientId })

      const res = await fetch(`/api/dashboard/trend${trendQs}`)
      const json = await res.json()
      const raw = Array.isArray(json) ? json : []
      setTrend(raw.map((r: any) => ({
        date: r.date || '',
        spend: r.spend || 0,
        leads: r.leads || 0,
      })))
    } catch {
      setTrend([])
    } finally {
      setLoading(false)
    }
  }, [clientId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { trend, loading, refetch: fetch_ }
}

// ─── 최근 리드 (DatePicker 무관, 항상 최신 8건) ───
export interface RecentLead {
  name: string
  utmSource: string
  createdAt: string
  phoneNumber: string
}

export function useRecentLeads(clientId: number | null) {
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const qs = buildQs({ client_id: clientId, limit: '8' })
      const res = await fetch(`/api/leads${qs}`)
      const json = await res.json()
      const contacts = Array.isArray(json) ? json : []

      // contact → lead 변환 (최신순 정렬)
      const leads: RecentLead[] = []
      for (const c of contacts) {
        const contactLeads = c.leads || []
        for (const l of contactLeads) {
          leads.push({
            name: c.name || '이름 없음',
            utmSource: normalizeChannel(l.utm_source),
            createdAt: l.created_at || c.created_at,
            phoneNumber: c.phone_number || '',
          })
        }
      }
      // 최신순 정렬, 최대 8건
      leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setRecentLeads(leads.slice(0, 8))
    } catch {
      setRecentLeads([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetch_() }, [fetch_])

  return { recentLeads, loading, refetch: fetch_ }
}

// ─── 퍼널 + 채널 + 시술별 매출 ───
export function useFunnelChannelData(clientId: number | null, startDate: string, endDate: string) {
  const [funnel, setFunnel] = useState<any>(null)
  const [channel, setChannel] = useState<any[]>([])
  const [treatmentData, setTreatmentData] = useState<{ name: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const qs = buildQs({ startDate, endDate, client_id: clientId })

      const [funnelRes, channelRes, treatmentRes] = await Promise.allSettled([
        fetch(`/api/dashboard/funnel${qs}`).then(r => r.json()),
        fetch(`/api/dashboard/channel${qs}`).then(r => r.json()),
        fetch(`/api/dashboard/treatment-revenue${qs}`).then(r => r.json()),
      ])

      if (funnelRes.status === 'fulfilled') setFunnel(funnelRes.value)
      if (channelRes.status === 'fulfilled') setChannel(Array.isArray(channelRes.value) ? channelRes.value : [])

      // 시술별 매출 (payments 테이블 직접 조회 — KPI 매출과 동일 기준)
      if (treatmentRes.status === 'fulfilled') {
        setTreatmentData(Array.isArray(treatmentRes.value) ? treatmentRes.value : [])
      }
    } finally {
      setLoading(false)
    }
  }, [clientId, startDate, endDate])

  useEffect(() => { fetch_() }, [fetch_])

  return { funnel, channel, treatmentData, loading, refetch: fetch_ }
}
