---
name: agatha-api
description: "Agatha API 개발 패턴. Next.js API Routes 작성법, 인증 미들웨어(withClientFilter, withSuperAdmin), 응답 포맷(apiSuccess/apiError), 입력 검증(sanitizeString, parseId), 에러 처리 패턴. API 라우트를 만들거나 수정할 때, 인증/권한 로직을 구현할 때 반드시 이 스킬을 사용할 것."
---

# Agatha API Development Patterns

## 목적

Agatha의 모든 API 라우트가 일관된 패턴으로 구현되도록 하는 가이드.

## API 라우트 구조

```
app/api/
├── auth/[...nextauth]/route.ts    # NextAuth 설정
├── admin/
│   ├── clients/route.ts           # 클라이언트 CRUD
│   ├── users/route.ts             # 사용자 관리
│   ├── ad-creatives/route.ts      # 광고 소재
│   ├── landing-pages/route.ts     # 랜딩페이지
│   └── utm/route.ts               # UTM 관리
├── ads/
│   ├── stats/route.ts             # 광고 통계
│   ├── platform-summary/route.ts  # 플랫폼 요약
│   └── sync/route.ts              # 수동 동기화
├── campaigns/route.ts             # 캠페인
├── customers/
│   ├── leads/route.ts             # 리드 CRUD
│   └── contacts/route.ts          # 고객DB
├── dashboard/
│   ├── kpi/route.ts               # KPI 계산
│   ├── trend/route.ts             # 트렌드
│   └── funnel/route.ts            # 퍼널
├── monitoring/
│   ├── keywords/route.ts          # 키워드 관리
│   └── rankings/route.ts          # 순위 기록
├── webhook/lead/route.ts          # 리드 웹훅 수신
├── invitations/route.ts           # 초대 관리
└── cron/
    ├── sync-ads/route.ts          # 광고 동기화 (06:00)
    └── send-reports/route.ts      # 리포트 발송 (08:00)
```

## 인증 미들웨어 패턴

```typescript
// lib/api-middleware.ts

// 모든 인증된 사용자 허용 + client_id 필터 자동 적용
export async function withClientFilter(
  req: NextRequest,
  handler: (session: Session, clientId: number | null) => Promise<Response>
)

// superadmin만 허용
export async function withSuperAdmin(
  req: NextRequest,
  handler: (session: Session) => Promise<Response>
)

// client_admin 이상만 허용
export async function withClientAdmin(
  req: NextRequest,
  handler: (session: Session, clientId: number) => Promise<Response>
)
```

## 사용 예시

```typescript
// app/api/customers/leads/route.ts
import { withClientFilter } from '@/lib/api-middleware'
import { apiSuccess, apiError } from '@/lib/api-response'
import { sanitizeString, parseId } from '@/lib/security'

export async function GET(req: NextRequest) {
  return withClientFilter(req, async (session, clientId) => {
    const { searchParams } = new URL(req.url)
    const status = sanitizeString(searchParams.get('status') || '')
    
    // client_id 필터 필수
    let query = supabase.from('leads').select('*')
    if (clientId) query = query.eq('client_id', clientId)
    if (status) query = query.eq('status', status)
    
    const { data, error } = await query
    if (error) return apiError('리드 조회 실패', 500)
    return apiSuccess(data)
  })
}
```

## 응답 포맷

```typescript
// 성공
apiSuccess(data)           // { success: true, data: ... }
apiSuccess(data, 201)      // 생성 성공

// 에러
apiError('메시지', 400)    // { success: false, error: '메시지' }
apiError('권한 없음', 403)
```

## 입력 검증

```typescript
sanitizeString(input)  // XSS 방지, 특수문자 제거
parseId(input)         // 숫자 ID 검증, NaN 시 null 반환
sanitizeUrl(input)     // URL 검증 (&는 유지)
```

## KST 타임존

```typescript
import { getKstDateString, getKstDayStartISO } from '@/lib/date'
// 날짜는 항상 KST 기준
// toISOString().split('T')[0] 사용 금지
```
