/**
 * 외부 API 호출용 클라이언트
 * - 타임아웃 설정
 * - 재시도 로직 (exponential backoff)
 * - 구조화된 로깅
 */

import { createLogger } from './logger'

export interface FetchOptions extends RequestInit {
  timeout?: number        // 타임아웃 (ms), 기본 30초
  retries?: number        // 재시도 횟수, 기본 3회
  retryDelay?: number     // 초기 재시도 대기 (ms), 기본 1초
  service?: string        // 서비스 이름 (로깅용)
}

export interface FetchWithRetryResult {
  response: Response
  attempts: number
}

export interface FetchResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
  attempts: number
}

// 재시도 가능한 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

// 재시도 가능한 에러인지 확인
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // 타임아웃, 네트워크 오류
    return error.name === 'AbortError' ||
           error.message.includes('fetch failed') ||
           error.message.includes('network')
  }
  return false
}

// 대기 함수
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry-After 헤더에서 대기 시간 추출 (초 단위)
 */
function parseRetryAfter(response: Response): number | null {
  const retryAfter = response.headers.get('Retry-After')
  if (!retryAfter) return null

  // 숫자인 경우 (초)
  const seconds = parseInt(retryAfter, 10)
  if (!isNaN(seconds)) return seconds * 1000

  // HTTP 날짜 형식인 경우
  const date = Date.parse(retryAfter)
  if (!isNaN(date)) {
    const waitMs = date - Date.now()
    return waitMs > 0 ? waitMs : null
  }

  return null
}

/**
 * 재시도 로직이 포함된 fetch 함수
 * @returns 응답과 실제 시도 횟수를 포함한 결과
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<FetchWithRetryResult> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    service = 'API',
    ...fetchOptions
  } = options

  const logger = createLogger(service)
  let lastError: Error | null = null
  let attempt = 0

  while (attempt <= retries) {
    attempt++
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // 성공 또는 재시도 불가능한 오류
      if (response.ok || !RETRYABLE_STATUS_CODES.includes(response.status)) {
        if (!response.ok) {
          logger.warn('Request failed with non-retryable status', { status: response.status })
        }
        return { response, attempts: attempt }
      }

      // 재시도 가능한 오류
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
      logger.warn(`Attempt ${attempt}/${retries + 1} failed`, { status: response.status })

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt <= retries) {
        // Retry-After 헤더 처리 (429 Too Many Requests)
        let waitTime = retryDelay * Math.pow(2, attempt - 1)
        if (response.status === 429) {
          const retryAfterMs = parseRetryAfter(response)
          if (retryAfterMs) {
            waitTime = Math.min(retryAfterMs, 60000) // 최대 60초
            logger.info('Rate limited, waiting', { waitTime, retryAfter: retryAfterMs })
          }
        }
        logger.debug('Retrying', { waitTime, attempt })
        await delay(waitTime)
      }

    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRetryableError(error)) {
        throw lastError
      }

      logger.warn(`Attempt ${attempt}/${retries + 1} failed`, { error: lastError.message })

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt <= retries) {
        const waitTime = retryDelay * Math.pow(2, attempt - 1)
        logger.debug('Retrying after error', { waitTime, attempt })
        await delay(waitTime)
      }
    }
  }

  throw lastError || new Error(`Request failed after ${retries + 1} attempts`)
}

/**
 * JSON 응답을 파싱하는 fetch 함수
 */
export async function fetchJSON<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const service = options.service || 'API'
  const logger = createLogger(service)
  let attempts = 0

  try {
    const startTime = Date.now()
    const { response, attempts: actualAttempts } = await fetchWithRetry(url, options)
    attempts = actualAttempts

    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      logger.error('Request failed', new Error(errorText), {
        status: response.status,
        duration,
        attempts
      })
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        statusCode: response.status,
        attempts,
      }
    }

    const data = await response.json() as T
    logger.info('Request successful', { duration, attempts })

    return {
      success: true,
      data,
      statusCode: response.status,
      attempts,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Request error', error, { attempts })
    return {
      success: false,
      error: message,
      attempts,
    }
  }
}
