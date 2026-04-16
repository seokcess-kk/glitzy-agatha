'use client'
import { useState, useRef, useCallback } from 'react'
import type { VerifyResult, VerifyStage, VerifyProgress, AdType } from '@/lib/medichecker/types'

const STAGES_ORDER: VerifyStage[] = [
  'keyword_scan', 'classification', 'query_rewrite',
  'search', 'relation_enrichment', 'judgment', 'verification',
]

const TIMEOUT_MS = 120_000

interface UseVerificationOptions {
  clinicId?: number | null
}

interface UseVerificationReturn {
  result: VerifyResult | null
  progress: Map<VerifyStage, VerifyProgress>
  isLoading: boolean
  error: string | null
  currentStage: VerifyStage | null
  verify: (text: string, adType: AdType) => Promise<void>
  abort: () => void
  reset: () => void
}

export function useVerification(options?: UseVerificationOptions): UseVerificationReturn {
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [progress, setProgress] = useState<Map<VerifyStage, VerifyProgress>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStage, setCurrentStage] = useState<VerifyStage | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    setResult(null)
    setProgress(new Map())
    setIsLoading(false)
    setError(null)
    setCurrentStage(null)
  }, [])

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsLoading(false)
  }, [])

  const verify = useCallback(async (text: string, adType: AdType) => {
    // 이전 요청 취소
    abort()

    setIsLoading(true)
    setError(null)
    setResult(null)
    setProgress(new Map())
    setCurrentStage(null)

    const controller = new AbortController()
    abortRef.current = controller

    // 타임아웃 설정
    timeoutRef.current = setTimeout(() => {
      controller.abort()
      setError('검증 시간이 초과되었습니다. 다시 시도해 주세요.')
      setIsLoading(false)
    }, TIMEOUT_MS)

    try {
      const urlParams = new URLSearchParams()
      if (options?.clinicId) {
        urlParams.set('clinic_id', String(options.clinicId))
      }
      const queryString = urlParams.toString()
      const url = `/api/medichecker/verify${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, adType }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody.error || `검증 요청 실패 (${response.status})`)
      }

      if (!response.body) {
        throw new Error('스트리밍 응답을 받을 수 없습니다.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6).trim()
          if (!dataStr || dataStr === '[DONE]') continue

          try {
            const data = JSON.parse(dataStr)

            if (data.type === 'progress') {
              const stage = data.stage as VerifyStage
              const progressData: VerifyProgress = {
                stage,
                status: data.status,
                partialResult: data.partialResult,
              }

              setProgress(prev => {
                const next = new Map(prev)
                next.set(stage, progressData)
                return next
              })

              if (data.status === 'running') {
                setCurrentStage(stage)
              }

              // 이전 단계들을 'done'으로 표시
              if (data.status === 'running') {
                const stageIdx = STAGES_ORDER.indexOf(stage)
                if (stageIdx > 0) {
                  setProgress(prev => {
                    const next = new Map(prev)
                    for (let i = 0; i < stageIdx; i++) {
                      const prevStage = STAGES_ORDER[i]
                      if (!next.has(prevStage) || next.get(prevStage)?.status !== 'done') {
                        next.set(prevStage, { stage: prevStage, status: 'done' })
                      }
                    }
                    return next
                  })
                }
              }
            }

            if (data.type === 'result') {
              setResult(data.result as VerifyResult)
              // 모든 단계를 완료로 표시
              setProgress(prev => {
                const next = new Map(prev)
                for (const s of STAGES_ORDER) {
                  next.set(s, { stage: s, status: 'done' })
                }
                return next
              })
              setCurrentStage(null)
            }

            if (data.type === 'error') {
              throw new Error(data.error || '검증 중 오류가 발생했습니다.')
            }
          } catch (parseErr) {
            // JSON 파싱 실패 시 무시 (부분 데이터일 수 있음)
            if (parseErr instanceof Error && parseErr.message !== '검증 중 오류가 발생했습니다.' && !parseErr.message.includes('검증')) {
              continue
            }
            throw parseErr
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          // 사용자가 취소한 경우 - 이미 처리됨
          return
        }
        setError(err.message)
      } else {
        setError('알 수 없는 오류가 발생했습니다.')
      }
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      abortRef.current = null
      setIsLoading(false)
    }
  }, [abort, options?.clinicId])

  return {
    result,
    progress,
    isLoading,
    error,
    currentStage,
    verify,
    abort,
    reset,
  }
}
