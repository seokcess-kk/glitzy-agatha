'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { createLogger } from '@/lib/logger'

const logger = createLogger('WebVitals')

export function WebVitals() {
  useReportWebVitals((metric) => {
    const { name, value, rating } = metric

    // 개발 환경: 콘솔 출력
    if (process.env.NODE_ENV === 'development') {
      const color = rating === 'good' ? '\x1b[32m' : rating === 'needs-improvement' ? '\x1b[33m' : '\x1b[31m'
      // eslint-disable-next-line no-console
      console.log(`${color}[WebVitals] ${name}: ${Math.round(value)}ms (${rating})\x1b[0m`)
      return
    }

    // 프로덕션: 서버 로그 (poor 등급만 기록하여 노이즈 최소화)
    if (rating === 'poor') {
      logger.warn('Poor Web Vital', { name, value: Math.round(value), rating })
    }
  })

  return null
}
