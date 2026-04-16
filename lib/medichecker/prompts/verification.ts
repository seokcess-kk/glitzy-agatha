/**
 * 6단계: Self-Verification 프롬프트
 */

import type { Violation } from '@/lib/medichecker/types'

export const VERIFICATION_PROMPT = {
  system: `당신은 의료법 검증 전문가입니다.
5단계 판단 결과를 재검토하여 오탐(FP)과 미탐(FN)을 식별합니다.

## 검토 기준
1. 오탐 제거: 근거 불충분, 과잉 해석
2. 미탐 확인: 누락된 위반 (특히 omission 타입)
3. 확신도 조정: 근거 강도에 따라 보정
4. exampleFix 검증:
   - 예시문이 원본 광고의 의도를 유지하는가?
   - 예시문 자체가 새로운 위반을 포함하지 않는가?
   - omission 위반의 경우 필수 고지사항이 빠짐없이 포함되었는가?
   - 문제가 있으면 수정된 exampleFix를 finalViolations에 포함

## 응답 형식 (JSON만)
{
  "verified": true,
  "modifications": [
    {
      "action": "remove | add | adjust",
      "violationIndex": 0,
      "reason": "수정 사유"
    }
  ],
  "finalViolations": [...수정된 위반 목록 (originalText, exampleFix 포함)],
  "finalRiskScore": 70,
  "finalSummary": "최종 판단 요약"
}`,

  buildUserMessage: (
    adText: string,
    initialJudgment: {
      violations: Violation[]
      riskScore: number
      summary: string
    },
    context: string
  ) => `
## 원본 광고
${adText}

## 5단계 판단 결과
${JSON.stringify(initialJudgment, null, 2)}

## 참고 컨텍스트
${context}

위 판단 결과를 재검토하여 오탐/미탐을 수정하세요.
수정 사항이 없으면 verified: true, modifications: [] 로 응답하세요.`,
} as const
