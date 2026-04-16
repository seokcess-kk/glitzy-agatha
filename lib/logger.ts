/**
 * 구조화된 로깅 모듈
 * - 일관된 로그 형식
 * - 컨텍스트 정보 포함
 * - 프로덕션/개발 환경 구분
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  service?: string
  action?: string
  userId?: string
  clinicId?: number | null
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const isDev = process.env.NODE_ENV !== 'production'

/**
 * 로그 엔트리 포맷팅
 */
function formatLogEntry(entry: LogEntry): string {
  if (isDev) {
    // 개발 환경: 읽기 쉬운 형식
    const contextStr = entry.context
      ? ` | ${Object.entries(entry.context)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(' ')}`
      : ''
    const errorStr = entry.error ? ` | Error: ${entry.error.message}` : ''
    return `[${entry.level.toUpperCase()}] ${entry.message}${contextStr}${errorStr}`
  }

  // 프로덕션: JSON 형식 (로그 수집 도구 호환)
  return JSON.stringify(entry)
}

/**
 * 로그 출력
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: isDev ? error.stack : undefined,
    }
  }

  const formatted = formatLogEntry(entry)

  switch (level) {
    case 'debug':
      if (isDev) console.debug(formatted)
      break
    case 'info':
      console.info(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'error':
      console.error(formatted)
      break
  }
}

/**
 * 디버그 로그 (개발 환경에서만 출력)
 */
function logDebug(message: string, context?: LogContext): void {
  log('debug', message, context)
}

/**
 * 정보 로그
 */
function logInfo(message: string, context?: LogContext): void {
  log('info', message, context)
}

/**
 * 경고 로그
 */
function logWarn(message: string, context?: LogContext): void {
  log('warn', message, context)
}

/**
 * 에러 로그
 */
function logError(message: string, error?: Error | unknown, context?: LogContext): void {
  const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined
  log('error', message, context, err)
}

/**
 * 서비스별 로거 생성
 */
export function createLogger(service: string) {
  return {
    debug: (message: string, context?: Omit<LogContext, 'service'>) =>
      logDebug(message, { service, ...context }),
    info: (message: string, context?: Omit<LogContext, 'service'>) =>
      logInfo(message, { service, ...context }),
    warn: (message: string, context?: Omit<LogContext, 'service'>) =>
      logWarn(message, { service, ...context }),
    error: (message: string, error?: Error | unknown, context?: Omit<LogContext, 'service'>) =>
      logError(message, error, { service, ...context }),
  }
}
