# Phase 2: 핵심 기능 개발

> 기간: 2026-03-14 ~ 2026-03-16 | 상태: 완료/동결

KPI 대시보드, UTM 링크, 랜딩 페이지, 광고 소재, 어드민 분리, 리드 필터 등 핵심 기능 개발 기록

---

## P2: KPI 대시보드 개선 (2026-03-14)

### 목표
KPI 대시보드에 기간 선택, 채널별 성과 테이블, 전기 대비 변화율 표시 기능 추가

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/api/dashboard/kpi/route.ts` | compare 모드 추가, fetchMetrics 함수 추출, 전기 대비 변화율 계산 |
| `app/(dashboard)/page.tsx` | 기간 선택 UI (Select), 채널별 테이블, KPI trend 연동 |

### 구현 내용

#### 1. KPI API 개선
```typescript
// compare=true 시 전기 데이터와 변화율 함께 반환
GET /api/dashboard/kpi?startDate=...&compare=true

// 응답 예시
{
  cpl: 25000,
  roas: 1.5,
  // ...
  comparison: {
    cpl: -5.2,    // 전기 대비 5.2% 감소 (좋음)
    roas: 12.3,   // 전기 대비 12.3% 증가 (좋음)
    // ...
  }
}
```

#### 2. 기간 선택 UI
- Select 드롭다운: 7일 / 14일 / 30일 / 90일
- 기간 변경 시 모든 API에 startDate 파라미터 전달

#### 3. 채널별 성과 테이블
- 채널, 리드, 광고비, 결제액, CPL, ROAS, 전환율 표시
- 캠페인 테이블과 동일한 스타일

#### 4. KPI 변화율 표시
- StatsCard에 trend prop 전달
- CPL/CAC: 낮아지면 좋음 (역방향 지표)
- ROAS/매출/전환율: 높아지면 좋음

### 코드 리뷰 후 수정

| 우선순위 | 문제 | 수정 내용 |
|---------|------|----------|
| 높음 | content_posts 기간 필터 누락 | `.gte('created_at', start).lte('created_at', end)` 추가 |
| 중간 | trend/funnel API에 startDate 미적용 | 모든 API에 startDate 파라미터 추가 |
| 낮음 | TrendingUp 미사용 import | 제거 |
| 낮음 | roas 0일 때 NaN 가능성 | `kpi.roas \|\| 0` 안전 처리 |

---

## P3: UTM 링크 생성기 기능 향상 (2026-03-14)

### 목표
UTM 링크 생성기를 로컬스토리지 기반에서 DB 기반으로 업그레이드, 캠페인 템플릿 및 QR 코드 생성 기능 추가

### 신규 파일

| 파일 | 용도 |
|------|------|
| `app/api/utm/templates/route.ts` | 템플릿 CRUD API (GET/POST) |
| `app/api/utm/templates/[id]/route.ts` | 단일 템플릿 API (PUT/DELETE) |
| `app/api/utm/links/route.ts` | 링크 히스토리 API (GET/POST) |
| `app/api/utm/links/[id]/route.ts` | 단일 링크 API (DELETE) |
| `app/(dashboard)/utm/components/TemplateSelector.tsx` | 템플릿 선택/저장 UI |
| `app/(dashboard)/utm/components/QRCodeDialog.tsx` | QR 코드 생성 다이얼로그 |
| `supabase/migrations/20240315_utm_templates_links.sql` | DB 테이블 생성 SQL |

### 구현 기능
- DB 기반 템플릿 저장/불러오기 (is_default 자동 적용)
- DB 기반 링크 히스토리 (디바이스 간 공유)
- QR 코드 생성 (PNG/SVG 다운로드, 크기/색상 커스터마이징)
- 멀티테넌트 격리 (clinic_id 기반)
- 삭제 확인 다이얼로그

---

## P4: API 기간 필터 통일 (2026-03-14)

### 목표
대시보드 기간 선택이 모든 API에 적용되도록 startDate 파라미터 통일

### API startDate 지원 현황 (완료)

| API | 지원 | 비고 |
|-----|------|------|
| `/api/dashboard/kpi` | ✅ | compare 모드 포함 |
| `/api/dashboard/channel` | ✅ | |
| `/api/dashboard/campaign` | ✅ | |
| `/api/dashboard/funnel` | ✅ | |
| `/api/dashboard/trend` | ✅ | 이번 작업에서 추가 |
| `/api/content/analytics` | ✅ | 이번 작업에서 추가 |
| `/api/leads` | ✅ | 이번 작업에서 추가 (limit 파라미터도 추가) |

---

## P5: 메뉴 구조 개선 (2026-03-14)

### 목표
사용자 플로우와 권한 기반으로 메뉴 구조 재설계

### 메뉴 그룹화
```
📊 대시보드

────────── 고객 관리 ──────────
👥 고객(CDP)
📅 예약/결제
💬 챗봇 현황
📝 리드 등록 ← 신규 추가

────────── 마케팅 분석 ──────────
📈 광고 성과
🎬 콘텐츠 분석
🔍 콘텐츠 모니터링
📰 언론보도

────────── 슈퍼어드민 ──────────
🔗 UTM 생성기
⚙️ 어드민 관리
```

---

## P6-B: 고객 여정 타임라인 개선 (2026-03-15)

### 목표
고객 상세 패널의 여정 타임라인을 개선하여 유입→예약→상담→결제까지의 전체 여정을 직관적으로 시각화

### 신규 컴포넌트: CustomerJourney

#### 이벤트 유형별 설정

| 유형 | 아이콘 | 색상 | 상태별 변형 |
|------|--------|------|------------|
| 유입 (inflow) | MousePointerClick | brand-500 | - |
| 챗봇 (chatbot) | MessageSquare | emerald-500 (발송), slate-600 (대기) | 발송/대기 |
| 예약 (booking) | CalendarCheck | blue-500 (확정), amber-500 (대기), purple-500 (방문), red-500 (노쇼), slate-600 (취소) | 상태별 |
| 상담 (consultation) | Users | purple-500 | - |
| 결제 (payment) | CreditCard | emerald-400 | - |

### 코드 품질 개선
- 날짜 null/invalid 시 안전 처리 (`formatDate()`)
- 챗봇 이벤트 정렬 안정화 (`typeOrder` 기반)
- 접근성 속성 추가 (`role="list"`, `aria-label`)

### 커밋
```
84f68d3 feat: P6-B 고객 여정 타임라인 컴포넌트 개선
```

---

## P7: 랜딩 페이지 관리 및 리드 수집 연동 (2026-03-15)

### 목표
- 기존 HTML 랜딩 페이지 파일들을 프로젝트에서 서빙
- 슈퍼관리자가 각 랜딩 페이지에 병원(clinic_id) 배정
- URL에 `?id=고유번호`로 랜딩 페이지 식별
- 폼 제출 시 `/api/webhook/lead` API로 리드 + 설문 응답(JSONB) 수집

### URL 형식
```
/lp?id=1001&utm_source=meta&utm_medium=cpc&utm_campaign=march_promo
```

### DB 테이블

**landing_pages** (신규)
```sql
CREATE TABLE landing_pages (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  file_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**leads 테이블 수정**
```sql
ALTER TABLE leads ADD COLUMN custom_data JSONB DEFAULT '{}';
ALTER TABLE leads ADD COLUMN landing_page_id INTEGER REFERENCES landing_pages(id);
```

### 광고 소재 관리 추가 (P7-B)

**ad_creatives** 테이블
```sql
CREATE TABLE ad_creatives (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  landing_page_id INTEGER REFERENCES landing_pages(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  utm_content VARCHAR(100) NOT NULL,
  platform VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 주요 기능
1. 광고 소재 CRUD + 병원 배정 + 랜딩 페이지 연결
2. 랜딩 페이지 CRUD + 활성/비활성 토글
3. 동적 랜딩 페이지 서빙 (/lp?id=X) + clinic_id/landing_page_id 주입
4. 리드 수집 (custom_data JSONB)
5. UTM 페이지 연동 (소재 선택 → utm_content + 랜딩 페이지 자동 설정)
6. 고객 상세에서 유입 랜딩 페이지/설문 응답/마케팅 동의 표시

---

## P8: 광고 소재 UTM 확장 및 어드민 메뉴 분리 (2026-03-15)

### 목표
1. 광고 소재에 전체 UTM 파라미터 저장 기능 추가
2. 어드민 관리 탭들을 별도 페이지로 분리

### 메뉴 구조 변경

**변경 전:**
```
슈퍼어드민
├── UTM 생성기
└── 어드민 관리 (탭: 병원/계정/랜딩페이지/소재)
```

**변경 후:**
```
슈퍼어드민
├── UTM 생성기
├── 광고 소재
├── 랜딩 페이지
├── 병원 관리
└── 계정 관리
```

### 전체 플로우 (완성)
```
1. 광고 소재 등록 (/admin/ad-creatives)
   └─ UTM 파라미터 전체 입력 (source, medium, campaign, content, term)
   └─ 랜딩 페이지 연결
        ↓
2. UTM 생성기에서 소재 선택 (/utm)
   └─ 모든 UTM 값 자동 적용
   └─ clinic_id 자동 설정
        ↓
3. 링크 생성 & 저장
   └─ 생성된 URL 복사/QR 생성
   └─ 히스토리에 저장 (clinic_id 포함)
        ↓
4. 랜딩 페이지 유입 → 리드 수집
   └─ 설문 응답 custom_data JSONB 저장
   └─ landing_page_id 연결
        ↓
5. 리드 관리 (/leads)
   └─ 유입 랜딩 페이지 확인
   └─ 설문 응답 확인
```

---

## P9: 랜딩 페이지 Hydration 에러 수정 (2026-03-15)

### 문제
서버 컴포넌트에서 `dangerouslySetInnerHTML`로 HTML을 직접 렌더링 시 Hydration 에러 발생

### 해결
iframe 방식으로 변경: 클라이언트 컴포넌트 + `/api/lp/render` API에서 HTML 서빙

### 커밋
```
d0b4ae6 fix: 랜딩 페이지 Hydration 에러 수정
```

---

## P10: UTM 생성기 히스토리 UI 개선 (2026-03-15)

### UI 개선 사항

| 항목 | 변경 전 | 변경 후 |
|------|--------|--------|
| 기본 상태 | 접힘 | 펼침 |
| 제목 | "URL 히스토리" | "생성된 UTM 목록" |
| 검색 | 없음 | 라벨, 소스, 캠페인, 콘텐츠 검색 가능 |
| UTM 표시 | URL만 표시 | source, medium, campaign, content 태그 표시 |
| 시간 표시 | 날짜만 | 날짜 + 시간 상세 표시 |
| 액션 | 복사, 불러오기 | 복사, 불러오기, 열기 |

### 코드 품질 개선
- 필터 로직 중복 제거 → `filteredLinks` useMemo 통합
- handleLoadLink 쿼리 파라미터 보존 (UTM 제외 후 `?id=X` 유지)
- `DATE_FORMAT_OPTIONS` 상수 추출

### 커밋
```
de4ec90 feat: UTM 생성기 히스토리 UI 개선
add7816 refactor: UTM 생성기 코드 품질 개선
```

---

## P11: 랜딩 페이지 성과 대시보드 (2026-03-16)

### 목표
랜딩 페이지별 리드 수, 예약 전환율, 결제 전환율, 매출을 한눈에 확인

### 성과 통계 API
```
GET /api/admin/landing-pages/stats?startDate=...&endDate=...
→ [{ landing_page_id, lead_count, booking_count, paying_customers, revenue, booking_rate, conversion_rate }]
```
- leads, payments, bookings 3개 테이블 병렬 조회
- first-touch 귀속 방식 (최초 유입 LP에 예약/결제 귀속)
- clinic_id 기반 멀티테넌트 격리

### 테이블 컬럼 추가
| 컬럼 | 표시 | 클릭 동작 |
|------|------|----------|
| 리드 | `{count}건` | `/leads?landing_page_id={id}`로 이동 |
| 예약 | `{count}({rate}%)` | - |
| 결제 | `{count}({rate}%)` | - |
| 매출 | `₩{amount}` | - |

---

## P12: 리드 페이지 필터 강화 (2026-03-16)

### 목표
랜딩 페이지별, 캠페인별 리드 필터링 기능 추가

### API 필터 파라미터 추가
```
GET /api/leads?landing_page_id=1&utm_campaign=march_promo&endDate=2026-03-31
```

### 필터 UI
- 채널 필터 (기존) + 랜딩페이지 필터 + 캠페인 필터
- 필터 초기화 버튼 (활성 필터 1개 이상 시 표시)
- URL `?landing_page_id=X` 파라미터 지원 (P11 연동)

### 크로스 페이지 연동
```
랜딩 페이지 관리 → 리드 수 클릭 → /leads?landing_page_id=X → 해당 LP 리드만 표시
```

---

## 전체 시스템 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                        슈퍼어드민 관리                           │
├─────────────────────────────────────────────────────────────────┤
│  1. 광고 소재 등록 (/admin/ad-creatives)                         │
│     └─ UTM 전체 입력 (source, medium, campaign, content, term)  │
│     └─ 랜딩 페이지 연결                                          │
│                              ↓                                   │
│  2. UTM 생성기 (/utm)                                            │
│     └─ 소재 선택 → 모든 UTM 값 자동 적용                          │
│     └─ 랜딩 페이지 URL 자동 생성                                  │
│     └─ QR 코드 생성/복사                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 플로우                             │
├─────────────────────────────────────────────────────────────────┤
│  3. 광고 클릭 → 랜딩 페이지 (/lp?id=X&utm_source=...&...)        │
│     └─ iframe으로 HTML 렌더링                                    │
│     └─ window.__LP_DATA__ 주입 (clinicId, landingPageId)        │
│                              ↓                                   │
│  4. 설문 진행 & 폼 제출                                          │
│     └─ /api/webhook/lead 호출                                   │
│     └─ custom_data (설문 응답) JSONB 저장                        │
│     └─ landing_page_id, UTM 파라미터 저장                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        리드 관리                                 │
├─────────────────────────────────────────────────────────────────┤
│  5. 리드 관리 (/leads)                                           │
│     └─ 유입 랜딩 페이지 표시                                      │
│     └─ 설문 응답 표시 (step1~5)                                  │
│     └─ 마케팅 수신 동의 표시                                      │
│     └─ 고객 여정 타임라인                                        │
└─────────────────────────────────────────────────────────────────┘
```
