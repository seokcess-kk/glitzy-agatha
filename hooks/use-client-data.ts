'use client'

/**
 * useClientData — 클라이언트 컴포넌트용 범용 데이터 패칭 훅.
 *
 * 컴포넌트마다 반복되던 의식(useState loading/error/data + useEffect fetch +
 * `?client_id=` 수동 부착 + 에러 처리)을 한 곳으로 모은 seam.
 *   - selectedClientId 를 ClientContext 에서 내부적으로 읽어 자동 부착 (호출처 누출 제거).
 *   - 빈/`undefined`/`null` 파라미터는 자동 생략.
 *   - 파라미터/클라이언트 변경 시 이전 요청은 AbortController 로 취소 (race 방지).
 *   - 에러 시 이전 data 는 유지 (기존 컴포넌트들의 `.catch(()=>{})` 동작과 동일).
 *
 * 동작은 기존 컴포넌트의 raw fetch 와 동일하게 유지한다(재시도/타임아웃은 이 seam 이
 * 자리잡은 뒤 한 곳에서 fetchJSON 으로 올릴 수 있다 — 지금은 의도적으로 미적용).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient } from '@/components/ClientContext'

export type ClientDataParams = Record<string, string | number | boolean | null | undefined>

export interface UseClientDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** 수동 재조회 (예: 변경 후). 진행 중 요청과 무관하게 새로 호출. */
  refetch: () => void
}

function buildQuery(params: ClientDataParams, clientId: number | null): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  if (clientId) qs.set('client_id', String(clientId))
  const str = qs.toString()
  return str ? `?${str}` : ''
}

export function useClientData<T = unknown>(
  path: string,
  params: ClientDataParams = {},
  options?: { enabled?: boolean },
): UseClientDataResult<T> {
  const { selectedClientId } = useClient()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const enabled = options?.enabled ?? true

  // 파라미터 객체를 안정적인 키로 직렬화 (deps 안정성)
  const paramsKey = JSON.stringify(params)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const parsed = JSON.parse(paramsKey) as ClientDataParams
        const url = `${path}${buildQuery(parsed, selectedClientId)}`
        const res = await fetch(url, { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as T
        setData(body)
        setLoading(false)
      } catch (e) {
        if (signal.aborted) return // 새 요청이 대체 — 상태는 그쪽이 소유
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    },
    [path, paramsKey, selectedClientId],
  )

  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    abortRef.current = ctrl
    run(ctrl.signal)
    return () => ctrl.abort()
  }, [run, enabled])

  const refetch = useCallback(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    run(ctrl.signal)
  }, [run])

  return { data, loading, error, refetch }
}
