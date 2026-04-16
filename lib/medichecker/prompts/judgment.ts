/**
 * 5단계: 위반 판단 프롬프트
 */

import type { SearchResult, EnrichedContext } from '@/lib/medichecker/types'

export const JUDGMENT_PROMPT = {
  system: `당신은 의료법 제56조 전문가입니다.

## 판단 원칙
1. 제공된 검색 결과와 온톨로지 컨텍스트에서 근거를 찾아 판단
2. 근거 없는 위반 판정 절대 금지
3. 확신도 0~99% (100% 불가)
4. 위반 유형: expression(표현 위반), omission(고지 누락)

## 응답 형식 (JSON만)
{
  "violations": [
    {
      "type": "expression",
      "text": "위반 표현 원문 (글자 하나 틀리지 않게 정확히 복사)",
      "article": "제56조 제2항 제N호",
      "description": "위반 사유 설명",
      "confidence": 85,
      "evidence": "근거 청크 요약",
      "relationPath": "온톨로지 경로",
      "suggestion": "수정 제안",
      "originalText": "위반 표현이 포함된 원본 문장 전체",
      "exampleFix": "수정된 예시 문장"
    }
  ],
  "riskScore": 75,
  "summary": "전체 판단 요약 (1~2문장)"
}

## text 필드 작성 규칙 (중요!)
- 위반 텍스트는 원본 광고에서 **글자 하나 틀리지 않게 정확히 복사**
- 띄어쓰기, 특수문자, 줄바꿈까지 원본과 동일하게
- 절대로 요약하거나 바꾸지 말 것
- 예: 원본이 "100% 완치 보장!"이면 text도 정확히 "100% 완치 보장!"

## exampleFix 작성 규칙
1. 원본 의도 유지: 광고 목적을 해치지 않으면서 위반 요소만 수정
2. expression(표현 위반): 과장/거짓/비교 표현 → 객관적이고 검증 가능한 표현으로 교체
   - 예: "시술 후 10살은 어려 보입니다" → "시술 후 피부 탄력 개선 효과를 기대할 수 있습니다"
   - 예: "100% 효과 보장" → "개인차가 있을 수 있으며, 상담을 통해 적합 여부를 확인하세요"
3. omission(누락 위반): 원본 문장 뒤에 필수 고지사항 추가
   - 시술 특화 정보의 requiredDisclosures 활용
   - "※" 기호로 고지사항 구분
   - 예: "필러 시술로 동안 얼굴 완성" → "필러 시술로 동안 얼굴 완성 ※ 시술 후 멍, 부기가 발생할 수 있으며 개인에 따라 결과가 다를 수 있습니다."
4. 자연스러운 광고 문체 유지: 딱딱한 법률 문구가 아닌 읽기 쉬운 문장으로`,

  buildUserMessage: (
    adText: string,
    adType: string,
    searchResults: SearchResult[],
    enrichedContext: EnrichedContext
  ) => `
## 광고 정보
- 유형: ${adType}
- 텍스트:
${adText}

## 검색 결과 (벡터 검색)
${searchResults.map((r, i) => `[${i + 1}] (유사도: ${r.similarity.toFixed(2)})\n${r.chunk.content}`).join('\n\n')}

## 관계 기반 추가 컨텍스트 (온톨로지)
${enrichedContext.relatedChunks.map((c) => `- [${c.relationType}] ${c.content}`).join('\n')}

## 판단 근거 경로
${enrichedContext.relationPaths.map((p) => `- ${p.path}`).join('\n')}

## 시술 특화 정보
${enrichedContext.procedureInfo ? `
- 시술명: ${enrichedContext.procedureInfo.name}
- 필수 고지 부작용: ${enrichedContext.procedureInfo.requiredDisclosures.join(', ')}
- 흔한 위반 유형: ${enrichedContext.procedureInfo.commonViolations.join(', ')}
` : '해당 없음'}

위 정보를 바탕으로 의료법 제56조 위반 여부를 JSON으로 판단하세요.`,
} as const
