/**
 * MediChecker 광고 검증 API (SSE 스트리밍)
 * - 인증된 사용자만 접근 가능
 * - SSE 스트리밍이므로 withClinicFilter 대신 직접 인증 처리
 * - 검증 결과를 mc_verification_logs에 저장
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClinicId } from '@/lib/session'
import { verify as verifyPipeline } from '@/lib/medichecker/verification'
import { findViolationRanges } from '@/lib/medichecker/highlight'
import { serverSupabase } from '@/lib/supabase'
import { sanitizeString } from '@/lib/security'
import { createLogger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-log'

const logger = createLogger('MediCheckerVerify')

export const maxDuration = 120

const VALID_AD_TYPES = ['blog', 'instagram', 'youtube', 'other'] as const

export async function POST(request: NextRequest) {
  try {
    // 인증 확인 (SSE는 withClinicFilter 사용 불가)
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { id: string; role: string; clinic_id: number | null }

    // clinic_staff 접근 차단 (minRole: 2)
    if (user.role === 'clinic_staff') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clinicId = await getClinicId(request.url)

    // clinic_id 필수 (테넌트 격리)
    const effectiveClinicId = clinicId ?? user.clinic_id
    if (!effectiveClinicId) {
      return Response.json({ error: 'clinic_id가 필요합니다.' }, { status: 400 })
    }

    // 입력 검증
    const body = await request.json()
    const { text, adType } = body

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'text는 필수입니다.' }, { status: 400 })
    }

    const sanitizedText = sanitizeString(text, 5000)
    if (!sanitizedText.trim()) {
      return Response.json({ error: '유효한 텍스트를 입력해주세요.' }, { status: 400 })
    }

    if (!adType || !VALID_AD_TYPES.includes(adType)) {
      return Response.json(
        { error: `유효한 adType이 필요합니다. (${VALID_AD_TYPES.join(', ')})` },
        { status: 400 }
      )
    }

    const encoder = new TextEncoder()
    const startTime = Date.now()

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          const result = await verifyPipeline(
            { text: sanitizedText, adType },
            (progress) => sendEvent({ type: 'progress', ...progress })
          )

          // 위반 범위 하이라이트 계산
          const ranges = findViolationRanges(sanitizedText, result.violations)

          const processingTimeMs = Date.now() - startTime

          // mc_verification_logs에 저장
          const supabase = serverSupabase()
          const { data: insertedLog, error: insertError } = await supabase
            .from('mc_verification_logs')
            .insert({
              clinic_id: effectiveClinicId,
              user_id: parseInt(user.id, 10),
              ad_text: sanitizedText,
              ad_type: adType,
              risk_score: result.riskScore ?? null,
              violation_count: result.violations?.length ?? 0,
              violations: result.violations ?? [],
              summary: result.summary ?? null,
              metadata: { ranges },
              processing_time_ms: processingTimeMs,
            })
            .select('id')
            .single()

          if (insertError) {
            logger.error('검증 로그 저장 실패', insertError, { clinicId: effectiveClinicId })
          }

          // 활동 로그 기록
          logActivity(supabase, {
            userId: user.id,
            clinicId: effectiveClinicId,
            action: 'medichecker_verify',
            targetTable: 'mc_verification_logs',
            targetId: insertedLog?.id ?? null,
            detail: { adType, riskScore: result.riskScore, violationCount: result.violations.length },
          })

          sendEvent({
            type: 'result',
            result: {
              ...result,
              violations: ranges,
              metadata: { ...result.metadata, totalTimeMs: processingTimeMs },
            },
          })
        } catch (error) {
          logger.error('검증 처리 중 오류', error, { clinicId: effectiveClinicId })
          sendEvent({
            type: 'error',
            error: error instanceof Error ? error.message : '검증 중 오류가 발생했습니다.',
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    logger.error('요청 처리 실패', error)
    return Response.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
