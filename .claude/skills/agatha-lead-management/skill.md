---
name: agatha-lead-management
description: "Agatha 리드/전환 관리 구현 가이드. 리드 상태 전이(new→in_progress→converted/lost/hold/invalid), 전환 금액 입력, 미전환 사유, 수동 등록, 리드 중복 처리, KPI 계산(CPL/ROAS/CVR/거부율/보류율). 고객관리 페이지, 리드 API, KPI 대시보드를 구현할 때 반드시 이 스킬을 사용할 것."
---

# Agatha Lead Management Implementation Guide

## 목적

리드의 전체 라이프사이클(유입 → 전환 추적 → KPI 계산)을 올바르게 구현한다.

## 리드 상태 전이

```
new → in_progress → converted (+ 전환 금액)
                  → lost (+ 사유)
                  → hold
                  → invalid (에이전시만)
```

**상태 전이 규칙:**
- `new` → `in_progress`, `invalid`만 가능
- `in_progress` → `converted`, `lost`, `hold`만 가능
- `hold` → `in_progress`, `converted`, `lost`로 재전이 가능
- `converted`/`lost` → 변경 불가 (최종 상태)
- `invalid` → 변경 불가 (최종 상태)

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  new:         ['in_progress', 'invalid'],
  in_progress: ['converted', 'lost', 'hold'],
  hold:        ['in_progress', 'converted', 'lost'],
  converted:   [],  // 최종 상태
  lost:        [],  // 최종 상태
  invalid:     [],  // 최종 상태
}
```

## 전환 입력

```typescript
interface ConversionInput {
  status: 'in_progress' | 'converted' | 'lost' | 'hold'
  conversion_value?: number   // converted일 때 필수
  lost_reason?: string        // lost일 때 선택
  conversion_memo?: string    // 자유 텍스트
}

// 미전환 사유
type LostReason = 'no_response' | 'not_interested' | 'price_issue' 
  | 'chose_competitor' | 'bad_timing' | 'other'
```

## 수동 등록

클라이언트가 직접 리드를 등록할 때:
- 유입 경로 선택 필수 → `utm_source`에 저장 (`phone`/`visit`/`referral`/`other`)
- 전화번호로 기존 연락처 존재 여부 확인 (중복 처리)
- 새 리드 생성 시 `status: 'new'`

## 리드 중복 처리

```typescript
// 전화번호로 기존 연락처 조회
const existing = await supabase
  .from('contacts')
  .select('id')
  .eq('client_id', clientId)
  .eq('phone_number', normalizedPhone)
  .single()

if (existing.data) {
  // 기존 연락처에 새 리드 추가 (재유입)
  contactId = existing.data.id
} else {
  // 새 연락처 생성
  const { data: newContact } = await supabase
    .from('contacts')
    .insert({ client_id: clientId, phone_number: normalizedPhone, name, first_source: utmSource })
    .select('id')
    .single()
  contactId = newContact.id
}
```

## KPI 계산

```typescript
// 광고 효율
const CPL  = totalSpend / totalLeads
const ROAS = (totalConversionValue / totalSpend) * 100
const CAC  = totalSpend / totalConversions
const CVR  = (totalConversions / totalLeads) * 100
const CPC  = totalSpend / totalClicks
const CTR  = (totalClicks / totalImpressions) * 100

// 전환 분석
const rejectionRate  = (lostCount / validLeads) * 100        // 거부율
const holdRate       = (holdCount / validLeads) * 100         // 보류율
const noShowRate     = (noResponseCount / validLeads) * 100   // 노쇼율
const invalidRate    = (invalidCount / totalLeads) * 100      // 무효율
const validLeadRate  = (validLeads / totalLeads) * 100        // 유효 리드율
const holdToConvert  = (holdThenConverted / holdCount) * 100  // 보류→전환율
```

## 집계 기준

모든 KPI는 다음 기준으로 필터링 가능:
- 전체 / 채널별(utm_source) / 캠페인별(utm_campaign) / 소재별(utm_content) / 랜딩페이지별(landing_page_id) / 기간별 / 클라이언트별

각 기준별로 전환율, 거부율, 보류율, 노쇼율을 함께 표시한다.
